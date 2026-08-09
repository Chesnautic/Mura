// Electron main process for the Mura desktop app.
//
// The renderer (everything under src/, bundled by `npx expo export --platform
// web`) never touches the real filesystem or spawns processes directly --
// that would require Node integration in the renderer, which Electron's own
// security guidance advises against. Instead the renderer only ever deals in
// bytes (Uint8Array) and blob URLs; this file does all real file I/O and
// spawns the bundled ffmpeg/ffprobe binaries, exposed to the renderer as
// `window.muraDesktop` via preload.js's contextBridge. See
// src/export/desktopBridge.ts for the renderer-side typed wrapper, and the
// README's "Desktop app" section for the full picture.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

/**
 * `npx expo export --platform web` produces a bundle whose script/asset tags
 * use absolute root paths (`/_expo/static/js/web/index-*.js`, etc.) --
 * correct for serving from a real web server's `/`, but broken under
 * Electron's `loadFile()`/`file://` protocol, where an absolute path
 * resolves to the OS filesystem root instead of the app's own dist folder
 * (the script tag would 404 silently and nothing would ever render). A tiny
 * local static server sidesteps that mismatch entirely by giving the app a
 * real `http://` origin rooted at `dist/`, exactly like any other web host
 * would. Only used for the packaged build; dev mode loads Metro's own dev
 * server directly via MURA_DEV_SERVER_URL, which already serves from `/`.
 */
function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        let filePath = path.join(rootDir, urlPath === "/" ? "index.html" : urlPath);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end();
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(rootDir, "index.html"); // SPA fallback
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err?.message ?? err));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
    server.on("error", reject);
  });
}

// ffmpeg-static/ffprobe-static resolve to a path inside node_modules; once
// packaged by electron-builder, native binaries live in
// `app.asar.unpacked` instead of inside the (non-executable) asar archive.
// See the "asarUnpack" entry in package.json's "build" config.
function unpackAsarPath(p) {
  return app.isPackaged ? p.replace("app.asar", "app.asar.unpacked") : p;
}

const FFMPEG_PATH = unpackAsarPath(require("ffmpeg-static"));
const FFPROBE_PATH = unpackAsarPath(require("ffprobe-static").path);

const TEMP_ROOT = path.join(os.tmpdir(), `mura-${process.pid}`);
const frameSessions = new Map(); // sessionId -> { dir, count }

async function ensureTempRoot() {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
}

/** Splits a command string the same way a shell would for our purposes:
 * whitespace-separated tokens, with double-quoted spans (which is all our
 * own command-building code ever produces, for paths with spaces) treated
 * as one token. No other shell features (pipes, env vars, glob expansion,
 * single quotes) are supported or needed here. */
function tokenizeCommand(command) {
  const tokens = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === " " && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function runBinary(binPath, args) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(binPath, args, { windowsHide: true });
    } catch (err) {
      resolve({ success: false, returnCode: null, stdout: "", logs: String(err?.message ?? err) });
      return;
    }
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      resolve({ success: false, returnCode: null, stdout, logs: `${stderr}\n${String(err?.message ?? err)}` });
    });
    child.on("close", (code) => {
      resolve({ success: code === 0, returnCode: code, stdout, logs: `${stdout}\n${stderr}` });
    });
  });
}

function registerIpcHandlers() {
  ipcMain.handle("mura:stageInputFile", async (_evt, bytes, suggestedName) => {
    await ensureTempRoot();
    const safeName = `${Date.now()}_${suggestedName.replace(/[^\w.\-]/g, "_")}`;
    const dest = path.join(TEMP_ROOT, safeName);
    await fsp.writeFile(dest, Buffer.from(bytes));
    return dest;
  });

  ipcMain.handle("mura:makeTempPath", async (_evt, suggestedName) => {
    await ensureTempRoot();
    const safeName = `${Date.now()}_${suggestedName.replace(/[^\w.\-]/g, "_")}`;
    return path.join(TEMP_ROOT, safeName);
  });

  ipcMain.handle("mura:readFile", async (_evt, filePath) => {
    const data = await fsp.readFile(filePath);
    return new Uint8Array(data);
  });

  ipcMain.handle("mura:deletePath", async (_evt, target) => {
    await fsp.rm(target, { recursive: true, force: true });
  });

  ipcMain.handle("mura:beginFrameSession", async () => {
    await ensureTempRoot();
    const sessionId = crypto.randomUUID();
    const dir = path.join(TEMP_ROOT, `frames_${sessionId}`);
    await fsp.mkdir(dir, { recursive: true });
    frameSessions.set(sessionId, { dir });
    return sessionId;
  });

  ipcMain.handle("mura:writeFrame", async (_evt, sessionId, index, bytes) => {
    const session = frameSessions.get(sessionId);
    if (!session) throw new Error(`Unknown frame session ${sessionId}`);
    const name = `frame_${String(index).padStart(6, "0")}.png`;
    await fsp.writeFile(path.join(session.dir, name), Buffer.from(bytes));
  });

  ipcMain.handle("mura:finishFrameSession", async (_evt, sessionId) => {
    const session = frameSessions.get(sessionId);
    if (!session) throw new Error(`Unknown frame session ${sessionId}`);
    return session.dir;
  });

  ipcMain.handle("mura:cleanupFrameSession", async (_evt, sessionId) => {
    const session = frameSessions.get(sessionId);
    if (!session) return;
    frameSessions.delete(sessionId);
    await fsp.rm(session.dir, { recursive: true, force: true });
  });

  ipcMain.handle("mura:runFfmpeg", async (_evt, command) => {
    const args = tokenizeCommand(command);
    return runBinary(FFMPEG_PATH, args);
  });

  ipcMain.handle("mura:runFfprobe", async (_evt, command) => {
    const args = tokenizeCommand(command);
    const result = await runBinary(FFPROBE_PATH, args);
    // Mirrors FFprobeKit's session.getOutput() on the native side: just
    // stdout (the actual queried value), not the stderr log chatter ffprobe
    // often prints even on success.
    return result.stdout;
  });

  ipcMain.handle("mura:saveFileAs", async (_evt, sourcePath, suggestedName, filters) => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: suggestedName,
      filters,
    });
    if (canceled || !filePath) return null;
    await fsp.copyFile(sourcePath, filePath);
    return filePath;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    // A real desktop-sized default window -- not the phone-shaped one this
    // used to open at, which never left room for the desktop 3-column
    // layout (App.tsx switches to it at windowW >= 900) and made a
    // maximized window just look like a tiny phone screen glued to the
    // top-left corner with empty space around it.
    width: 1360,
    height: 860,
    minWidth: 380,
    minHeight: 700,
    backgroundColor: "#0E0818",
    title: "Mura",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Forward renderer console output (including uncaught errors) to the
  // main-process terminal -- otherwise a JS crash inside the web bundle is
  // invisible outside of DevTools, which isn't much help when diagnosing a
  // report from a packaged build. Cheap enough to leave on always.
  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    // eslint-disable-next-line no-console
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer] process gone:", details);
  });

  const devServerUrl = process.env.MURA_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else if (staticServerUrl) {
    win.loadURL(staticServerUrl);
  } else {
    // Shouldn't happen (the static server is started before createWindow),
    // but fall back to loadFile rather than showing a blank window.
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

let staticServerUrl = null;
let staticServerHandle = null;

app.whenReady().then(async () => {
  registerIpcHandlers();
  if (!process.env.MURA_DEV_SERVER_URL) {
    const { server, url } = await startStaticServer(path.join(__dirname, "..", "dist"));
    staticServerHandle = server;
    staticServerUrl = url;
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  staticServerHandle?.close();
  try {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  } catch {
    // best effort
  }
});
