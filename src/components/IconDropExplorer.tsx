import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { ICON_DROP_TYPES } from "../iconDrops/registry";
import { useMuraStore } from "../state/store";
import { COLORS, ScreenTitle, SliderRow, PillButton } from "./ui";

/** Icon-drop shape toggles + fall-physics sliders, pulled out of
 * IconDropPickerScreen.tsx (the full-screen mobile version) the same way
 * WaveformExplorer was -- so it can also live inline in the desktop
 * layout's right-hand panel. */
export function IconDropExplorer() {
  const iconDropConfig = useMuraStore((s) => s.iconDropConfig);
  const toggleIconDrop = useMuraStore((s) => s.toggleIconDrop);
  const setActiveIconDrops = useMuraStore((s) => s.setActiveIconDrops);
  const setIconDropConfig = useMuraStore((s) => s.setIconDropConfig);

  const allIds = ICON_DROP_TYPES.map((t) => t.id);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.selectRow}>
        <PillButton label="Select all" onPress={() => setActiveIconDrops(allIds)} variant="ghost" />
        <PillButton label="Select none" onPress={() => setActiveIconDrops([])} variant="ghost" />
      </View>

      <View style={styles.grid}>
        {ICON_DROP_TYPES.map((type) => {
          const active = iconDropConfig.activeShapeIds.includes(type.id);
          return (
            <Pressable
              key={type.id}
              onPress={() => toggleIconDrop(type.id)}
              style={[styles.card, active && styles.cardActive]}
            >
              <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{type.name}</Text>
              <Text style={styles.cardDesc}>{type.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 24 }}>
        <ScreenTitle title="Fall physics" />
        <SliderRow
          label="Density"
          value={iconDropConfig.density}
          min={0}
          max={3}
          onValueChange={(v) => setIconDropConfig({ density: v })}
        />
        <SliderRow
          label="Gravity"
          value={iconDropConfig.gravity}
          min={10}
          max={200}
          format={(v) => v.toFixed(0)}
          onValueChange={(v) => setIconDropConfig({ gravity: v })}
        />
        <SliderRow
          label="Sway"
          value={iconDropConfig.sway}
          min={0}
          max={150}
          format={(v) => v.toFixed(0)}
          onValueChange={(v) => setIconDropConfig({ sway: v })}
        />
        <SliderRow
          label="Base fall speed"
          value={iconDropConfig.baseSpeed}
          min={10}
          max={250}
          format={(v) => v.toFixed(0)}
          onValueChange={(v) => setIconDropConfig({ baseSpeed: v })}
        />
        <SliderRow
          label="Min size"
          value={iconDropConfig.minSize}
          min={8}
          max={120}
          format={(v) => v.toFixed(0)}
          onValueChange={(v) => setIconDropConfig({ minSize: Math.min(v, iconDropConfig.maxSize) })}
        />
        <SliderRow
          label="Max size"
          value={iconDropConfig.maxSize}
          min={8}
          max={160}
          format={(v) => v.toFixed(0)}
          onValueChange={(v) => setIconDropConfig({ maxSize: Math.max(v, iconDropConfig.minSize) })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 48 },
  selectRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
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
