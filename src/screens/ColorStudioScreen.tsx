import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PRESET_PALETTES, rgbToHex } from "../theme/palettes";
import { useMuraStore } from "../state/store";
import { COLORS, ColorSwatchButton, PillButton, ScreenContainer, ScreenTitle } from "../components/ui";

export function ColorStudioScreen() {
  const palette = useMuraStore((s) => s.palette);
  const applyPresetPalette = useMuraStore((s) => s.applyPresetPalette);
  const randomizePalette = useMuraStore((s) => s.randomizePalette);
  const setSwatchColor = useMuraStore((s) => s.setSwatchColor);
  const addSwatch = useMuraStore((s) => s.addSwatch);
  const removeSwatch = useMuraStore((s) => s.removeSwatch);
  const setBackgroundColor = useMuraStore((s) => s.setBackgroundColor);
  const setAccentColor = useMuraStore((s) => s.setAccentColor);
  const setGlowColor = useMuraStore((s) => s.setGlowColor);

  return (
    <ScreenContainer>
      <ScreenTitle title="Color Studio" subtitle="Full manual control, or let Mura pick for you." />

      <PillButton label="Randomize colors" onPress={randomizePalette} variant="accent" />

      <View style={{ marginTop: 22 }}>
        <Text style={styles.sectionLabel}>Presets</Text>
        <View style={styles.row}>
          {Object.keys(PRESET_PALETTES).map((name) => (
            <PillButton key={name} label={name} onPress={() => applyPresetPalette(name)} variant="ghost" />
          ))}
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <Text style={styles.sectionLabel}>Core colors</Text>
        <View style={styles.row}>
          <ColorSwatchButton hex={rgbToHex(palette.background)} label="Background" onChange={setBackgroundColor} />
          <ColorSwatchButton hex={rgbToHex(palette.accent)} label="Accent" onChange={setAccentColor} />
          <ColorSwatchButton hex={rgbToHex(palette.glow)} label="Glow" onChange={setGlowColor} />
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <Text style={styles.sectionLabel}>Gradient swatches ({palette.colors.length})</Text>
        <Text style={styles.hint}>Tap a swatch to edit it. Long-press to remove.</Text>
        <View style={styles.row}>
          {palette.colors.map((c, i) => (
            <ColorSwatchButton
              key={i}
              hex={rgbToHex(c)}
              label={`#${i + 1}`}
              onChange={(hex) => setSwatchColor(i, hex)}
              onRemove={() => removeSwatch(i)}
            />
          ))}
        </View>
        <PillButton label="+ Add swatch" onPress={() => addSwatch("#ff2d95")} variant="ghost" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: COLORS.accent, fontWeight: "700", fontSize: 13, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  hint: { color: COLORS.textDim, fontSize: 12, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-start" },
});
