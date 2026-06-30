import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";

interface ListFilterBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function ListFilterBar({
  value,
  onChangeText,
  placeholder = "Filter",
}: ListFilterBarProps) {
  const { invertColors } = useSettings();
  const foreground = invertColors ? "black" : "white";

  return (
    <View
      style={[
        styles.container,
        { borderColor: invertColors ? "black" : "white" },
      ]}
    >
      <MaterialIcons color={foreground} name="search" size={n(22)} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={invertColors ? "#6E6E6E" : "#C1C1C1"}
        style={[styles.input, { color: foreground }]}
        value={value}
      />
      {value.length > 0 ? (
        <HapticPressable hitSlop={n(12)} onPress={() => onChangeText("")}>
          <MaterialIcons color={foreground} name="close" size={n(22)} />
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: n(1),
    paddingHorizontal: n(12),
    marginBottom: n(8),
    gap: n(8),
  },
  input: {
    flex: 1,
    fontSize: n(18),
    paddingVertical: n(8),
  },
});
