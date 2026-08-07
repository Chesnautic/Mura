import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { WaveformPickerScreen } from "../screens/WaveformPickerScreen";
import { IconDropPickerScreen } from "../screens/IconDropPickerScreen";
import { ColorStudioScreen } from "../screens/ColorStudioScreen";
import { ReactivityScreen } from "../screens/ReactivityScreen";
import { ExportScreen } from "../screens/ExportScreen";
import { COLORS } from "../components/ui";

export type RootStackParamList = {
  Home: undefined;
  Waveforms: undefined;
  IconDrops: undefined;
  Colors: undefined;
  Reactivity: undefined;
  Export: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { color: COLORS.text },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Waveforms" component={WaveformPickerScreen} options={{ title: "Waveforms" }} />
      <Stack.Screen name="IconDrops" component={IconDropPickerScreen} options={{ title: "Icon Drops" }} />
      <Stack.Screen name="Colors" component={ColorStudioScreen} options={{ title: "Color Studio" }} />
      <Stack.Screen name="Reactivity" component={ReactivityScreen} options={{ title: "Reactivity" }} />
      <Stack.Screen name="Export" component={ExportScreen} options={{ title: "Export" }} />
    </Stack.Navigator>
  );
}
