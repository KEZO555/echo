import React from "react";
import { Pressable, type PressableProps, StyleSheet } from "react-native";
import { useSettings } from "@/features/settings";

export const HapticPressable = React.memo(function HapticPressable({
  style,
  onPress,
  onLongPress,
  ...rest
}: PressableProps) {
  const { triggerHaptic } = useSettings();

  return (
    <Pressable
      {...rest}
      android_disableSound={true}
      onLongPress={
        onLongPress
          ? (event) => {
              triggerHaptic();
              onLongPress(event);
            }
          : undefined
      }
      onPress={(event) => {
        triggerHaptic();
        onPress?.(event);
      }}
      // Dim briefly while pressed so every tap has instant visual feedback,
      // preserving any style (object, array, or function) the caller passed.
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        return [base, state.pressed ? styles.pressed : null];
      }}
    />
  );
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
});
