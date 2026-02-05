import React from "react";
import { Pressable, PressableProps } from "react-native";
import { useSettings } from "@/features/settings";

export const HapticPressable = React.memo(function HapticPressable(props: PressableProps) {
    const { triggerHaptic } = useSettings();

    return (
        <Pressable
            {...props}
            onPress={(event) => {
                triggerHaptic();
                props.onPress?.(event);
            }}
            android_disableSound={true}
        />
    );
});
