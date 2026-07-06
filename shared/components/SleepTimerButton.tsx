import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSleepTimerStore } from "@/features/playback";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";

const SIZE = n(28);

interface SleepTimerButtonProps {
  invertColors: boolean;
  onPress: () => void;
}

// The moon (sleep) icon itself represents the countdown: while a timer runs it
// starts as a full bright moon and drains from the top down to a faint outline
// as the time elapses. Owns its own ticking state so only this button
// re-renders each second.
export function SleepTimerButton({
  invertColors,
  onPress,
}: SleepTimerButtonProps) {
  const endAt = useSleepTimerStore((s) => s.endAt);
  const durationMs = useSleepTimerStore((s) => s.durationMs);
  const endOfTrack = useSleepTimerStore((s) => s.endOfTrack);
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
  const isActive = endAt !== null || endOfTrack;

  if (!isActive) {
    return (
      <HapticPressable hitSlop={n(8)} onPress={onPress}>
        <View style={styles.container}>
          <MaterialIcons color={color} name="bedtime" size={SIZE} />
        </View>
      </HapticPressable>
    );
  }

  const fillHeight = Math.round(SIZE * fraction);

  return (
    <HapticPressable hitSlop={n(8)} onPress={onPress}>
      <View style={styles.container}>
        {/* The moon keeps its full shape at all times: this dimmed moon stays
            visible as the outline while the bright fill drains away inside
            it. */}
        <View style={styles.faintLayer}>
          <MaterialIcons color={color} name="bedtime" size={SIZE} />
        </View>
        {/* Remaining time: a bright moon clipped from the bottom, shrinking
            from full height to nothing as the countdown elapses. */}
        <View style={[styles.fillClip, { height: fillHeight }]}>
          <View style={styles.fillInner}>
            <MaterialIcons color={color} name="bedtime" size={SIZE} />
          </View>
        </View>
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
  faintLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.4,
  },
  fillClip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  fillInner: {
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
