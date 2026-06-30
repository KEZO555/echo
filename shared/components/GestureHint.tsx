import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

export function GestureHint() {
  const { invertColors, hasSeenGestureHint, setHasSeenGestureHint, isLoading } =
    useSettings();

  const visible = !(isLoading || hasSeenGestureHint);

  const dismiss = () => setHasSeenGestureHint(true);

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={visible}
    >
      <Pressable onPress={dismiss} style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: invertColors ? "white" : "black",
              borderColor: invertColors ? "black" : "white",
            },
          ]}
        >
          <StyledText style={styles.title}>Quick tip</StyledText>
          <StyledText style={styles.body}>
            Tap an item to play it. Hold an item for more options like adding to
            the queue or a playlist.
          </StyledText>
          <HapticPressable onPress={dismiss} style={styles.button}>
            <StyledText style={styles.buttonText}>Got it</StyledText>
          </HapticPressable>
        </View>
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
    paddingVertical: n(20),
    paddingHorizontal: n(24),
  },
  title: {
    fontSize: n(22),
    paddingBottom: n(12),
  },
  body: {
    fontSize: n(16),
    lineHeight: n(22),
    paddingBottom: n(20),
  },
  button: {
    alignSelf: "flex-end",
    paddingVertical: n(6),
    paddingHorizontal: n(12),
  },
  buttonText: {
    fontSize: n(18),
  },
});
