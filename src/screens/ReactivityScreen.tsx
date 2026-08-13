import React from "react";
import { View } from "react-native";
import { ScreenContainer, ScreenTitle } from "../components/ui";
import { ReactivityPanel } from "../components/ReactivityPanel";

/** Full-screen reactivity tuner for mobile / narrow windows. On a wide
 * desktop window, HomeScreen embeds <ReactivityPanel> directly in its
 * right-hand panel instead of navigating here -- this screen is what phones
 * and anything under the desktop-layout breakpoint use. */
export function ReactivityScreen() {
  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, padding: 20, paddingBottom: 0 }}>
        <ScreenTitle
          title="Reactivity"
          subtitle="Tune how the visual responds to the music -- or make it lock onto the bass/beat specifically."
        />
        <ReactivityPanel />
      </View>
    </ScreenContainer>
  );
}
