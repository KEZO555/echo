import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

const STEP_MINUTES = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 180;
const DEFAULT_MINUTES = 15;

interface SleepTimerPopupProps {
  visible: boolean;
  activeEndAt: number | null;
  activeEndOfTrack: boolean;
  onStart: (minutes: number) => void;
  onStartEndOfTrack: () => void;
  onTurnOff: () => void;
  onClose: () => void;
}

const clampToStep = (minutes: number): number => {
  const rounded = Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(Math.max(rounded, MIN_MINUTES), MAX_MINUTES);
};

const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatRemaining = (ms: number): string => {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
};

export function SleepTimerPopup({
  visible,
  activeEndAt,
  activeEndOfTrack,
  onStart,
  onStartEndOfTrack,
  onTurnOff,
  onClose,
}: SleepTimerPopupProps) {
  const { invertColors } = useSettings();
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // Seed the stepper from the running timer's remaining minutes when opened,
  // so "+/-" adjusts the current time rather than starting from scratch.
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (activeEndAt !== null) {
      const remaining = Math.ceil((activeEndAt - Date.now()) / 60_000);
      setMinutes(clampToStep(remaining));
    } else {
      setMinutes(DEFAULT_MINUTES);
    }
  }, [visible, activeEndAt]);

  // Tick the live countdown while the popup is open and a timer is running.
  useEffect(() => {
    if (!visible || activeEndAt === null) {
      setRemainingMs(null);
      return;
    }
    const update = () => setRemainingMs(Math.max(activeEndAt - Date.now(), 0));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [visible, activeEndAt]);

  const iconColor = invertColors ? "black" : "white";
  const decrement = () =>
    setMinutes((current) => Math.max(current - STEP_MINUTES, MIN_MINUTES));
  const increment = () =>
    setMinutes((current) => Math.min(current + STEP_MINUTES, MAX_MINUTES));

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable
          onPress={() => undefined}
          style={[
            styles.card,
            {
              backgroundColor: invertColors ? "white" : "black",
              borderColor: invertColors ? "black" : "white",
            },
          ]}
        >
          <StyledText style={styles.title}>Sleep Timer</StyledText>

          {remainingMs !== null && (
            <StyledText style={styles.countdown}>
              {formatRemaining(remainingMs)} left
            </StyledText>
          )}

          {activeEndOfTrack && (
            <StyledText style={styles.countdown}>
              Stopping at end of this
            </StyledText>
          )}

          <View style={styles.stepperRow}>
            <HapticPressable
              disabled={minutes <= MIN_MINUTES}
              onPress={decrement}
              style={[styles.stepButton, minutes <= MIN_MINUTES && styles.dim]}
            >
              <MaterialIcons color={iconColor} name="remove" size={n(34)} />
            </HapticPressable>

            <StyledText style={styles.value}>{minutes} min</StyledText>

            <HapticPressable
              disabled={minutes >= MAX_MINUTES}
              onPress={increment}
              style={[styles.stepButton, minutes >= MAX_MINUTES && styles.dim]}
            >
              <MaterialIcons color={iconColor} name="add" size={n(34)} />
            </HapticPressable>
          </View>

          <HapticPressable
            onPress={() => {
              onStart(minutes);
              onClose();
            }}
            style={styles.actionButton}
          >
            <StyledText style={styles.actionText}>
              {activeEndAt === null ? "Start" : "Update"}
            </StyledText>
          </HapticPressable>

          <HapticPressable
            onPress={() => {
              onStartEndOfTrack();
              onClose();
            }}
            style={styles.actionButton}
          >
            <StyledText style={styles.actionText}>End of episode</StyledText>
          </HapticPressable>

          {(activeEndAt !== null || activeEndOfTrack) && (
            <HapticPressable
              onPress={() => {
                onTurnOff();
                onClose();
              }}
              style={styles.actionButton}
            >
              <StyledText style={styles.actionText}>Turn off</StyledText>
            </HapticPressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: n(30),
  },
  card: {
    width: "100%",
    borderWidth: n(1),
    paddingVertical: n(16),
    paddingHorizontal: n(20),
  },
  title: {
    fontSize: n(16),
    opacity: 0.6,
    paddingBottom: n(12),
  },
  countdown: {
    fontSize: n(20),
    paddingBottom: n(10),
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: n(8),
  },
  stepButton: {
    paddingVertical: n(6),
    paddingHorizontal: n(10),
  },
  dim: {
    opacity: 0.3,
  },
  value: {
    fontSize: n(30),
  },
  actionButton: {
    paddingVertical: n(14),
  },
  actionText: {
    fontSize: n(22),
  },
});
