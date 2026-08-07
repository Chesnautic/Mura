// Preload script: the only bridge between the sandboxed renderer (the Expo
// web build, with nodeIntegration off) and the main process's real
// filesystem/ffmpeg access. Everything exposed here is consumed through
// src/export/desktopBridge.ts's typed wrapper -- keep the two in sync.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("muraDesktop", {
  isAvailable: true,

  stageInputFile: (bytes, suggestedName) => ipcRenderer.invoke("mura:stageInputFile", bytes, suggestedName),
  makeTempPath: (suggestedName) => ipcRenderer.invoke("mura:makeTempPath", suggestedName),
  readFile: (filePath) => ipcRenderer.invoke("mura:readFile", filePath),
  deletePath: (target) => ipcRenderer.invoke("mura:deletePath", target),

  beginFrameSession: () => ipcRenderer.invoke("mura:beginFrameSession"),
  writeFrame: (sessionId, index, bytes) => ipcRenderer.invoke("mura:writeFrame", sessionId, index, bytes),
  finishFrameSession: (sessionId) => ipcRenderer.invoke("mura:finishFrameSession", sessionId),
  cleanupFrameSession: (sessionId) => ipcRenderer.invoke("mura:cleanupFrameSession", sessionId),

  runFfmpeg: (command) => ipcRenderer.invoke("mura:runFfmpeg", command),
  runFfprobe: (command) => ipcRenderer.invoke("mura:runFfprobe", command),

  saveFileAs: (sourcePath, suggestedName, filters) =>
    ipcRenderer.invoke("mura:saveFileAs", sourcePath, suggestedName, filters),
});
