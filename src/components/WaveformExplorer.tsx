import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, type LayoutChangeEvent } from "react-native";
import { WAVEFORM_FAMILIES, WAVEFORM_PRESETS } from "../visualizer/registry";
import { useMuraStore } from "../state/store";
import { COLORS, PillButton } from "./ui";

/**
 * The Prev/Next bar + scrollable, family-grouped waveform grid. Pulled out
 * of WaveformPickerScreen.tsx (the full-screen mobile picker) so the same
 * UI can also live inline in a panel -- e.g. the desktop layout's right-hand
 * column, where there's room to show it alongside the live preview instead
 * of needing to navigate to its own screen.
 */
export function WaveformExplorer() {
  const waveformId = useMuraStore((s) => s.waveformId);
  const setWaveformId = useMuraStore((s) => s.setWaveformId);

  const scrollRef = useRef<ScrollView>(null);
  // y-offset of each family's section within the ScrollView's content, captured
  // via onLayout as it renders -- lets Prev/Next auto-scroll to the right spot
  // instead of making you hunt through the grid by hand.
  const familyOffsets = useRef<Record<string, number>>({});

  const activeIndex = Math.max(
    0,
    WAVEFORM_PRESETS.findIndex((p) => p.id === waveformId)
  );
  const activePreset = WAVEFORM_PRESETS[activeIndex] ?? WAVEFORM_PRESETS[0];

  const goTo = useCallback(
    (delta: number) => {
      const count = WAVEFORM_PRESETS.length;
      const nextIndex = ((activeIndex + delta) % count + count) % count;
      const next = WAVEFORM_PRESETS[nextIndex];
      setWaveformId(next.id);
      const y = familyOffsets.current[next.family];
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    },
    [activeIndex, setWaveformId]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.navBar}>
        <PillButton label="◀ Prev" onPress={() => goTo(-1)} variant="ghost" />
        <View style={styles.navCenter}>
          <Text style={styles.navIndex}>
            {activeIndex + 1} / {WAVEFORM_PRESETS.length}
          </Text>
          <Text style={styles.navName} numberOfLines={1}>
            {activePreset.name}
          </Text>
        </View>
        <PillButton label="Next ▶" onPress={() => goTo(1)} variant="accent" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {WAVEFORM_FAMILIES.map((family) => (
          <View
            key={family.id}
            style={{ marginBottom: 22 }}
            onLayout={(e: LayoutChangeEvent) => {
              familyOffsets.current[family.id] = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.familyLabel}>{family.label}</Text>
            <View style={styles.grid}>
              {family.presets.map((preset) => {
                const active = preset.id === waveformId;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setWaveformId(preset.id)}
                    style={[styles.card, active && styles.cardActive]}
                  >
                    <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{preset.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {preset.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 48, paddingTop: 2 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 10,
  },
  navCenter: { flex: 1, alignItems: "center" },
  navIndex: { color: COLORS.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  navName: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  familyLabel: { color: COLORS.accent, fontWeight: "700", fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  // flexBasis+flexGrow (rather than a fixed "47%") so this grid reflows
  // naturally whether it's in a full-width mobile screen or a narrow
  // desktop side panel, instead of assuming one specific container width.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    flexBasis: 140,
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardActive: { borderColor: COLORS.accent, borderWidth: 2, backgroundColor: COLORS.surfaceAlt },
  cardTitle: { color: COLORS.text, fontWeight: "700", fontSize: 13.5 },
  cardTitleActive: { color: COLORS.accent },
  cardDesc: { color: COLORS.textDim, fontSize: 11, marginTop: 4, lineHeight: 15 },
});
