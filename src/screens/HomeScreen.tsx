import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VisualizerCanvas } from "../visualizer/VisualizerCanvas";
import { useLiveAudioFeatures } from "../audio/useLiveAudioFeatures";
import { useMuraStore } from "../state/store";
import { getWaveformPreset, WAVEFORM_PRESETS } from "../visualizer/registry";
import { COLORS, PillButton, ScreenContainer } from "../components/ui";
import { WaveformExplorer } from "../components/WaveformExplorer";
import { IconDropExplorer } from "../components/IconDropExplorer";
import { ColorStudioPanel } from "../components/ColorStudioPanel";
import { ReactivityPanel } from "../components/ReactivityPanel";
import { getDesktopBridge } from "../export/desktopBridge";
import type { RootStackParamList } from "../navigation/RootNavigator";

// Which single control panel is showing in the desktop layout's right-hand
// column. Exactly one of these is ever visible at a time -- switching is
// local state, never navigation, so the left rail and the live preview in
// the center column stay on screen the whole time.
type DesktopPanel = "waveforms" | "iconDrops" | "colors" | "reactivity";

const PANEL_TITLES: Record<DesktopPanel, string> = {
  waveforms: `Waveforms (${WAVEFORM_PRESETS.length})`,
  iconDrops: "Icon Drops",
  colors: "Color Studio",
  reactivity: "Reactivity",
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// Below this window width, Mura uses the phone-style single-column layout
// (the same one Expo Go/a real phone gets). At or above it -- a resized or
// maximized desktop window -- it switches to a three-column layout: nav on
// the left, a fixed phone-sized preview in the middle, and the waveform
// picker on the right, since there's room to show all of it directly
// instead of navigating between full-screen phone-shaped pages.
const DESKTOP_BREAKPOINT = 900;
const PHONE_PREVIEW_W = 390;
const PHONE_PREVIEW_H = Math.round(PHONE_PREVIEW_W * 1.15);

export function HomeScreen({ navigation }: Props) {
  const { width: windowW } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === "web" && windowW >= DESKTOP_BREAKPOINT;
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>("waveforms");

  const waveformId = useMuraStore((s) => s.waveformId);
  const palette = useMuraStore((s) => s.palette);
  const reactivity = useMuraStore((s) => s.reactivity);
  const iconDropConfig = useMuraStore((s) => s.iconDropConfig);
  const audioSource = useMuraStore((s) => s.audioSource);
  const setAudioSource = useMuraStore((s) => s.setAudioSource);
  const randomizeWaveform = useMuraStore((s) => s.randomizeWaveform);
  const randomizePalette = useMuraStore((s) => s.randomizePalette);

  const player = useAudioPlayer(null, { updateInterval: 300 });
  const status = useAudioPlayerStatus(player);
  const features = useLiveAudioFeatures(player);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  useEffect(() => {
    if (audioSource) {
      player.replace({ uri: audioSource.uri });
      hasLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSource?.uri]);

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    // On native, `asset.uri` is already a real file:// path ffmpeg can read
    // directly. On web (the desktop app), it's a blob: URL -- fine for the
    // <audio> element, but useless to the real ffmpeg process running in
    // Electron's main process, which needs an actual path on disk. So on
    // desktop we additionally copy the picked file's bytes into a real temp
    // file via the bridge and remember that path for analysis/export.
    const desktop = Platform.OS === "web" ? getDesktopBridge() : null;
    let desktopPath: string | undefined;
    if (desktop && asset.file) {
      const bytes = new Uint8Array(await asset.file.arrayBuffer());
      desktopPath = await desktop.stageInputFile(bytes, asset.name ?? "audio");
    }

    setAudioSource({ uri: asset.uri, name: asset.name ?? "Untitled", desktopPath });
  };

  const preset = getWaveformPreset(waveformId);

  if (isDesktopLayout) {
    return (
      <SafeAreaView style={styles.desktopSafe} edges={["top", "left", "right"]}>
        <View style={styles.desktopRoot}>
          <View style={styles.leftRail}>
            <Text style={styles.brand}>Mura</Text>
            <Text style={styles.tagline}>{preset.name}</Text>
            <Pressable onPress={() => navigation.navigate("Export")} style={[styles.exportBtn, { marginTop: 14 }]}>
              <Text style={styles.exportBtnText}>Export</Text>
            </Pressable>

            <View style={styles.railSection}>
              <PillButton
                label="Waveforms"
                onPress={() => setDesktopPanel("waveforms")}
                variant="ghost"
                active={desktopPanel === "waveforms"}
              />
              <PillButton
                label="Icon Drops"
                onPress={() => setDesktopPanel("iconDrops")}
                variant="ghost"
                active={desktopPanel === "iconDrops"}
              />
              <PillButton
                label="Color Studio"
                onPress={() => setDesktopPanel("colors")}
                variant="ghost"
                active={desktopPanel === "colors"}
              />
              <PillButton
                label="Reactivity"
                onPress={() => setDesktopPanel("reactivity")}
                variant="ghost"
                active={desktopPanel === "reactivity"}
              />
            </View>

            <View style={styles.railSection}>
              <PillButton label="Shuffle waveform" onPress={() => randomizeWaveform(WAVEFORM_PRESETS.map((p) => p.id))} />
              <PillButton label="Randomize colors" onPress={randomizePalette} />
            </View>
          </View>

          <View style={styles.centerColumn}>
            <View
              style={[
                styles.canvasWrap,
                { width: PHONE_PREVIEW_W, height: PHONE_PREVIEW_H, backgroundColor: rgbCss(palette.background) },
              ]}
            >
              <VisualizerCanvas
                width={PHONE_PREVIEW_W}
                height={PHONE_PREVIEW_H}
                waveformId={waveformId}
                palette={palette}
                reactivity={reactivity}
                iconDropConfig={iconDropConfig}
                featuresSource={features}
              />
            </View>

            <View style={[styles.transportRow, { width: PHONE_PREVIEW_W }]}>
              <Pressable style={styles.pickBtn} onPress={pickAudio}>
                <Text style={styles.pickBtnText} numberOfLines={1}>
                  {audioSource ? audioSource.name : "Choose a song"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.playBtn}
                disabled={!audioSource}
                onPress={() => (status.playing ? player.pause() : player.play())}
              >
                <Text style={styles.playBtnText}>{status.playing ? "Pause" : "Play"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <Text style={styles.rightPanelTitle}>{PANEL_TITLES[desktopPanel]}</Text>
            {desktopPanel === "waveforms" && <WaveformExplorer />}
            {desktopPanel === "iconDrops" && <IconDropExplorer />}
            {desktopPanel === "colors" && <ColorStudioPanel />}
            {desktopPanel === "reactivity" && <ReactivityPanel />}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Mura</Text>
          <Text style={styles.tagline}>{preset.name}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Export")} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>Export</Text>
        </Pressable>
      </View>

      <View style={[styles.canvasWrap, { width: windowW - 32, height: Math.round((windowW - 32) * 1.15), backgroundColor: rgbCss(palette.background) }]}>
        <VisualizerCanvas
          width={windowW - 32}
          height={Math.round((windowW - 32) * 1.15)}
          waveformId={waveformId}
          palette={palette}
          reactivity={reactivity}
          iconDropConfig={iconDropConfig}
          featuresSource={features}
        />
      </View>

      <View style={styles.transportRow}>
        <Pressable style={styles.pickBtn} onPress={pickAudio}>
          <Text style={styles.pickBtnText}>{audioSource ? audioSource.name : "Choose a song"}</Text>
        </Pressable>
        <Pressable
          style={styles.playBtn}
          disabled={!audioSource}
          onPress={() => (status.playing ? player.pause() : player.play())}
        >
          <Text style={styles.playBtnText}>{status.playing ? "Pause" : "Play"}</Text>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        <PillButton label="Shuffle waveform" onPress={() => randomizeWaveform(WAVEFORM_PRESETS.map((p) => p.id))} />
        <PillButton label="Randomize colors" onPress={randomizePalette} />
      </View>

      <View style={styles.navRow}>
        <PillButton label="Waveforms (50)" onPress={() => navigation.navigate("Waveforms")} variant="ghost" />
        <PillButton label="Icon Drops" onPress={() => navigation.navigate("IconDrops")} variant="ghost" />
        <PillButton label="Color Studio" onPress={() => navigation.navigate("Colors")} variant="ghost" />
        <PillButton label="Reactivity" onPress={() => navigation.navigate("Reactivity")} variant="ghost" />
      </View>
    </ScreenContainer>
  );
}

function rgbCss([r, g, b]: readonly [number, number, number]) {
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brand: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  tagline: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
  exportBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, alignSelf: "flex-start" },
  exportBtnText: { color: "#1A0A12", fontWeight: "700" },
  canvasWrap: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transportRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 14 },
  pickBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickBtnText: { color: COLORS.text, fontWeight: "600" },
  playBtn: { backgroundColor: COLORS.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 },
  playBtnText: { color: "#1A0A12", fontWeight: "700" },
  quickRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 14, flexWrap: "wrap" },
  navRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 10, flexWrap: "wrap" },

  // --- desktop (wide window) layout ---
  desktopSafe: { flex: 1, backgroundColor: COLORS.bg },
  desktopRoot: { flex: 1, flexDirection: "row" },
  leftRail: {
    width: 240,
    padding: 20,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  railSection: { marginTop: 24, gap: 10, alignItems: "flex-start" },
  centerColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  rightPanel: {
    width: 380,
    padding: 20,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  rightPanelTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginBottom: 14 },
});
