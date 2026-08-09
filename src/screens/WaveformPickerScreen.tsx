import React from "react";
import { View } from "react-native";
import { WAVEFORM_FAMILIES, WAVEFORM_PRESETS } from "../visualizer/registry";
import { ScreenContainer, ScreenTitle } from "../components/ui";
import { WaveformExplorer } from "../components/WaveformExplorer";

/** Full-screen waveform picker for mobile / narrow windows. On a wide
 * desktop window, HomeScreen embeds <WaveformExplorer> directly in its
 * right-hand panel instead of navigating here -- this screen is what phones
 * and anything under the desktop-layout breakpoint use. */
export function WaveformPickerScreen() {
  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, padding: 20, paddingBottom: 0 }}>
        <ScreenTitle
          title="Waveforms"
          subtitle={`${WAVEFORM_PRESETS.length} types across ${WAVEFORM_FAMILIES.length} families`}
        />
        <WaveformExplorer />
      </View>
    </ScreenContainer>
  );
}
