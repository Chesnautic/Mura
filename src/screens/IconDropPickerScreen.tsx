import React from "react";
import { View } from "react-native";
import { ScreenContainer, ScreenTitle } from "../components/ui";
import { IconDropExplorer } from "../components/IconDropExplorer";

/** Full-screen icon-drop picker for mobile / narrow windows. On a wide
 * desktop window, HomeScreen embeds <IconDropExplorer> directly in its
 * right-hand panel instead of navigating here -- this screen is what phones
 * and anything under the desktop-layout breakpoint use. */
export function IconDropPickerScreen() {
  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, padding: 20, paddingBottom: 0 }}>
        <ScreenTitle title="Icon Drops" subtitle="Pick which shapes rain down, and how they fall." />
        <IconDropExplorer />
      </View>
    </ScreenContainer>
  );
}
