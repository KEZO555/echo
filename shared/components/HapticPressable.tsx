import { Pressable, PressableProps } from "react-native";
import { useSettings } from "@/features/settings";

export const HapticPressable = (props: PressableProps) => {
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
};
