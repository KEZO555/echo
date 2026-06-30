import React from "react";
import { Pressable, type PressableProps } from "react-native";
import { useSettings } from "@/features/settings";

export const HapticPressable = React.memo(function HapticPressable(
  props: PressableProps
) {
  const { triggerHaptic } = useSettings();

  return (
    <Pressable
      {...props}
      android_disableSound={true}
      onLongPress={
        props.onLongPress
          ? (event) => {
              triggerHaptic();
              props.onLongPress?.(event);
            }
          : undefined
      }
      onPress={(event) => {
        triggerHaptic();
        props.onPress?.(event);
      }}
    />
  );
});
