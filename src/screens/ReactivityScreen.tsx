import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMuraStore } from "../state/store";
import { COLORS, PillButton, ScreenContainer, ScreenTitle, SliderRow } from "../components/ui";

/**
 * Tuning screen for how the visual responds to the music. Everything here
 * maps 1:1 onto `ReactivityControls` (src/audio/types.ts), which is applied
 * identically in the live preview (VisualizerCanvas.tsx) and export
 * (frameCapture.ts) -- so a setting tuned here previews and exports the
 * same way.
 */
export function ReactivityScreen() {
  const reactivity = useMuraStore((s) => s.reactivity);
  const setReactivity = useMuraStore((s) => s.setReactivity);
  const resetReactivity = useMuraStore((s) => s.resetReactivity);

  return (
    <ScreenContainer>
      <ScreenTitle
        title="Reactivity"
        subtitle="Tune how the visual responds to the music -- or make it lock onto the bass/beat specifically."
      />

      <View style={{ marginBottom: 22 }}>
        <Text style={styles.sectionLabel}>Beat focus</Text>
        <Text style={styles.hint}>
          The main knob for "single in on the bass." Low = reacts evenly to the whole mix. High = the
          visual mostly ignores everything except bass hits and beats.
        </Text>
        <SliderRow
          label="Beat focus"
          value={reactivity.beatFocus}
          onValueChange={(v) => setReactivity({ beatFocus: v })}
          min={0}
          max={1}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <View style={styles.row}>
          <PillButton
            label="Overall sound"
            onPress={() => setReactivity({ beatFocus: 0.15 })}
            variant="ghost"
            active={reactivity.beatFocus <= 0.25}
          />
          <PillButton
            label="Balanced"
            onPress={() => setReactivity({ beatFocus: 0.35 })}
            variant="ghost"
            active={reactivity.beatFocus > 0.25 && reactivity.beatFocus < 0.7}
          />
          <PillButton
            label="Bass punch"
            onPress={() => setReactivity({ beatFocus: 0.9, bassGain: 1.6, onsetGain: 1.4 })}
            variant="accent"
            active={reactivity.beatFocus >= 0.7}
          />
        </View>
      </View>

      <View style={{ marginBottom: 22 }}>
        <Text style={styles.sectionLabel}>Frequency band gains</Text>
        <Text style={styles.hint}>Turn a band up to make it hit harder; turn it down to quiet it out.</Text>
        <SliderRow
          label="Bass"
          value={reactivity.bassGain}
          onValueChange={(v) => setReactivity({ bassGain: v })}
          min={0}
          max={2.5}
        />
        <SliderRow
          label="Mid"
          value={reactivity.midGain}
          onValueChange={(v) => setReactivity({ midGain: v })}
          min={0}
          max={2.5}
        />
        <SliderRow
          label="Treble"
          value={reactivity.trebleGain}
          onValueChange={(v) => setReactivity({ trebleGain: v })}
          min={0}
          max={2.5}
        />
        <SliderRow
          label="Beat/onset hits"
          value={reactivity.onsetGain}
          onValueChange={(v) => setReactivity({ onsetGain: v })}
          min={0}
          max={2.5}
        />
      </View>

      <View style={{ marginBottom: 22 }}>
        <Text style={styles.sectionLabel}>Look & feel</Text>
        <SliderRow
          label="Chaos"
          value={reactivity.chaos}
          onValueChange={(v) => setReactivity({ chaos: v })}
          min={0}
          max={1}
        />
        <SliderRow
          label="Glow strength"
          value={reactivity.glowStrength}
          onValueChange={(v) => setReactivity({ glowStrength: v })}
          min={0}
          max={2}
        />
        <SliderRow
          label="Particle density"
          value={reactivity.particleDensity}
          onValueChange={(v) => setReactivity({ particleDensity: v })}
          min={0}
          max={2}
        />
        <SliderRow
          label="Switch speed"
          value={reactivity.switchSpeed}
          onValueChange={(v) => setReactivity({ switchSpeed: v })}
          min={0}
          max={2}
        />
      </View>

      <PillButton label="Reset to defaults" onPress={resetReactivity} variant="ghost" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: COLORS.accent, fontWeight: "700", fontSize: 13, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  hint: { color: COLORS.textDim, fontSize: 12, marginBottom: 12, lineHeight: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
});
