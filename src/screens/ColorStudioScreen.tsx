import React from "react";
import { View } from "react-native";
import { ScreenContainer, ScreenTitle } from "../components/ui";
import { ColorStudioPanel } from "../components/ColorStudioPanel";

/** Full-screen color studio for mobile / narrow windows. On a wide desktop
 * window, HomeScreen embeds <ColorStudioPanel> directly in its right-hand
 * panel instead of navigating here -- this screen is what phones and
 * anything under the desktop-layout breakpoint use. */
export function ColorStudioScreen() {
  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, padding: 20, paddingBottom: 0 }}>
        <ScreenTitle title="Color Studio" subtitle="Full manual control, or let Mura pick for you." />
        <ColorStudioPanel />
      </View>
    </ScreenContainer>
  );
}
