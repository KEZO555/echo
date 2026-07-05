import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSleepTimerStore } from "@/features/playback";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";

const SIZE = n(30);

interface SleepTimerButtonProps {
  invertColors: boolean;
  onPress: () => void;
}

// A sleep icon that, while a timer is running, sits inside a circle that
// drains from full to empty as the countdown elapses. Owns its own ticking
// state so only this button re-renders each second.
export function SleepTimerButton({
  invertColors,
  onPress,
}: SleepTimerButtonProps) {
  const endAt = useSleepTimerStore((s) => s.endAt);
  const durationMs = useSleepTimerStore((s) => s.durationMs);
  const [fraction, setFraction] = useState(1);

  useEffect(() => {
    if (endAt === null || !durationMs) {
      return;
    }
    const update = () => {
      const remaining = endAt - Date.now();
      setFraction(Math.min(Math.max(remaining / durationMs, 0), 1));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endAt, durationMs]);

  const color = invertColors ? "black" : "white";
  const isActive = endAt !== null;
  const fillHeight = Math.round(SIZE * fraction);

  return (
    <HapticPressable onPress={onPress}>
      <View style={styles.container}>
        {isActive && (
          <View style={[styles.track, { borderColor: color }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: color, height: fillHeight },
              ]}
            />
          </View>
        )}
        <MaterialIcons color={color} name="bedtime" size={n(20)} />
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    borderWidth: n(1),
    overflow: "hidden",
    justifyContent: "flex-end",
    opacity: 0.5,
  },
  fill: {
    width: "100%",
    opacity: 0.35,
  },
});
