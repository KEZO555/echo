import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";

/**
 * Centered activity indicator on the themed background, shown while a screen
 * loads its first data instead of a blank frame.
 */
export function LoadingScreen() {
  const { invertColors } = useSettings();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: invertColors ? "white" : "black" },
      ]}
    >
      <ActivityIndicator
        color={invertColors ? "black" : "white"}
        size="large"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
