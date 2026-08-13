import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { useMuraStore } from "../state/store";
import { exportVideo } from "../export/videoExporter";
import { exportAudioAsMp3 } from "../export/audioExporter";
import { isFfmpegAvailable } from "../export/ffmpegRunner";
import { COLORS, PillButton, ScreenContainer, ScreenTitle } from "../components/ui";

const NO_FFMPEG_MESSAGE =
  Platform.OS === "web"
    ? "Video/MP3 export needs the packaged Mura desktop app (it runs a real ffmpeg in the background). " +
      "You're viewing this in a plain browser tab -- see the README's 'Desktop app' section for how to " +
      "build and run the Electron app. Everything else in Mura (all 50 waveforms, icon drops, live " +
      "preview, colors) works fine right here."
    : "Video/MP3 export uses ffmpeg-kit-react-native, a native module that can't load inside Expo Go. Run " +
      "`npx expo prebuild` and open this project in a dev-client or standalone build to enable exporting. " +
      "Everything else in Mura (all 50 waveforms, icon drops, live preview, colors) works fine right here.";

// Mura's visuals are all procedurally drawn shapes/particles/glow, not
// photographic footage -- rendering them at a much higher resolution than
// the live preview doesn't add any visible detail, it just costs more time
// per frame (and, combined with a long song, more total frames). TikTok/
// Reels itself only requires the right 9:16 *shape*, not any particular
// pixel count. So the default here is sized close to the live preview
// (PHONE_PREVIEW_W in HomeScreen.tsx is 390) rather than a full 1080x1920 --
// same look, several times fewer pixels to raster per frame. The larger
// options are still here for anyone who wants to upscale for a bigger
// screen, just no longer the default.
const RESOLUTIONS: { label: string; width: number; height: number }[] = [
  { label: "720x1280 (TikTok/Reels -- fast, recommended)", width: 720, height: 1280 },
  { label: "1080x1920 (TikTok/Reels -- high-res, slower)", width: 1080, height: 1920 },
  { label: "1080x1080 (Square)", width: 1080, height: 1080 },
  { label: "1920x1080 (Landscape)", width: 1920, height: 1080 },
];

export function ExportScreen() {
  const audioSource = useMuraStore((s) => s.audioSource);
  const waveformId = useMuraStore((s) => s.waveformId);
  const palette = useMuraStore((s) => s.palette);
  const reactivity = useMuraStore((s) => s.reactivity);
  const iconDropConfig = useMuraStore((s) => s.iconDropConfig);
  const exportState = useMuraStore((s) => s.exportState);
  const setExportState = useMuraStore((s) => s.setExportState);

  const [resIndex, setResIndex] = useState(0);
  const ffmpegOk = isFfmpegAvailable();

  const runVideoExport = async () => {
    if (!audioSource) {
      Alert.alert("Pick a song first", "Choose an audio file on the Home screen before exporting.");
      return;
    }
    const res = RESOLUTIONS[resIndex];
    setExportState({ isExporting: true, progress: 0, stage: "Starting", lastError: undefined });
    try {
      const result = await exportVideo({
        audioUri: audioSource.desktopPath ?? audioSource.uri,
        waveformId,
        palette,
        reactivity,
        iconDropConfig,
        width: res.width,
        height: res.height,
        onProgress: (stage, progress) => setExportState({ stage, progress }),
      });
      setExportState({ isExporting: false, progress: 1, stage: "Done", lastResultUri: result.outputUri });
      Alert.alert(
        "Export complete",
        result.savedToChosenPath
          ? `Saved to ${result.outputUri}`
          : result.savedToLibrary
            ? "Saved to your photo library."
            : "Rendered -- the file is ready, but wasn't saved to a permanent location yet."
      );
    } catch (err: any) {
      setExportState({ isExporting: false, lastError: String(err?.message ?? err) });
      Alert.alert("Export failed", String(err?.message ?? err));
    }
  };

  const runAudioExport = async () => {
    if (!audioSource) {
      Alert.alert("Pick a song first", "Choose an audio file on the Home screen before exporting.");
      return;
    }
    setExportState({ isExporting: true, progress: 0, stage: "Encoding MP3", lastError: undefined });
    try {
      const result = await exportAudioAsMp3({ audioUri: audioSource.desktopPath ?? audioSource.uri });
      setExportState({ isExporting: false, progress: 1, stage: "Done", lastResultUri: result.outputUri });
      Alert.alert(
        "MP3 ready",
        result.savedToChosenPath
          ? `Saved to ${result.outputUri}`
          : result.savedToLibrary
            ? "Saved to your library."
            : "Rendered -- the file is ready, but wasn't saved to a permanent location yet."
      );
    } catch (err: any) {
      setExportState({ isExporting: false, lastError: String(err?.message ?? err) });
      Alert.alert("Export failed", String(err?.message ?? err));
    }
  };

  const shareLastResult = async () => {
    if (!exportState.lastResultUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exportState.lastResultUri);
    }
  };

  return (
    <ScreenContainer>
      <ScreenTitle title="Export" subtitle="Render your visualizer to video, or pull the audio as MP3." />

      {!ffmpegOk ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{Platform.OS === "web" ? "Export needs the desktop app" : "Export needs a dev build"}</Text>
          <Text style={styles.warningText}>{NO_FFMPEG_MESSAGE}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Video resolution</Text>
      <View style={styles.resList}>
        {RESOLUTIONS.map((r, i) => (
          <PillButton key={r.label} label={r.label} onPress={() => setResIndex(i)} active={i === resIndex} variant="ghost" />
        ))}
      </View>

      <View style={{ marginTop: 20, gap: 12 }}>
        <PillButton label="Export MP4 (visualizer + audio)" onPress={runVideoExport} variant="accent" />
        <PillButton label="Export audio as MP3" onPress={runAudioExport} variant="ghost" />
      </View>

      {exportState.isExporting ? (
        <View style={styles.progressBox}>
          <Text style={styles.progressStage}>{exportState.stage}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(exportState.progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(exportState.progress * 100)}%</Text>
        </View>
      ) : null}

      {exportState.lastResultUri && !exportState.isExporting ? (
        <View style={{ marginTop: 20 }}>
          <PillButton label="Share last export" onPress={shareLastResult} variant="ghost" />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: COLORS.accent, fontWeight: "700", fontSize: 13, marginBottom: 10, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  resList: { gap: 8 },
  warningBox: { backgroundColor: "#2A1830", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.accent, marginBottom: 8 },
  warningTitle: { color: COLORS.accent, fontWeight: "700", marginBottom: 6 },
  warningText: { color: COLORS.textDim, fontSize: 12.5, lineHeight: 18 },
  progressBox: { marginTop: 22 },
  progressStage: { color: COLORS.text, fontWeight: "600", marginBottom: 8 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceAlt, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.accent },
  progressPct: { color: COLORS.textDim, fontSize: 12, marginTop: 6 },
});
