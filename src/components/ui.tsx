import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import ColorPicker, { Panel1, HueSlider, Preview, Swatches } from "reanimated-color-picker";

export const COLORS = {
  bg: "#0E0818",
  surface: "#1A1128",
  surfaceAlt: "#241636",
  border: "#3A2856",
  text: "#F5F1FF",
  textDim: "#B5A8CC",
  accent: "#FF2D95",
};

export function ScreenContainer({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Wrapper style={{ flex: 1 }} contentContainerStyle={scroll ? styles.scrollContent : undefined}>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PillButton({
  label,
  onPress,
  active = false,
  variant = "default",
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  variant?: "default" | "accent" | "ghost";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        variant === "accent" && styles.pillAccent,
        variant === "ghost" && styles.pillGhost,
        active && styles.pillActive,
      ]}
    >
      <Text style={[styles.pillText, variant === "accent" && styles.pillTextAccent]}>{label}</Text>
    </Pressable>
  );
}

export function SliderRow({
  label,
  value,
  onValueChange,
  min = 0,
  max = 2,
  format,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{format ? format(value) : value.toFixed(2)}</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onValueChange}
        minimumValue={min}
        maximumValue={max}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.accent}
      />
    </View>
  );
}

export function ColorSwatchButton({
  hex,
  label,
  onChange,
  onRemove,
}: {
  hex: string;
  label?: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignItems: "center", marginRight: 14, marginBottom: 14 }}>
      <Pressable
        onPress={() => setOpen(true)}
        onLongPress={onRemove}
        style={[styles.swatch, { backgroundColor: hex }]}
      />
      {label ? <Text style={styles.swatchLabel}>{label}</Text> : null}
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ColorPicker value={hex} onCompleteJS={(colors) => onChange(colors.hex)} style={{ width: "100%" }}>
              <Preview style={{ marginBottom: 16 }} />
              <Panel1 style={{ marginBottom: 16 }} />
              <HueSlider style={{ marginBottom: 16 }} />
              <Swatches />
            </ColorPicker>
            <PillButton label="Done" onPress={() => setOpen(false)} variant="accent" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 20, paddingBottom: 48 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: COLORS.textDim, fontSize: 14, marginTop: 4 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "flex-start",
  },
  pillAccent: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillGhost: { backgroundColor: "transparent", borderColor: COLORS.border },
  pillActive: { borderColor: COLORS.accent, borderWidth: 2 },
  pillText: { color: COLORS.text, fontWeight: "600", fontSize: 13 },
  pillTextAccent: { color: "#1A0A12" },
  sliderLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sliderLabel: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  sliderValue: { color: COLORS.textDim, fontSize: 12 },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  swatchLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border },
});
