import { StyleSheet } from "react-native";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface ButtonProps {
  text: string;
  onPress?: () => void;
}

export function StyledButton({ text, onPress }: ButtonProps) {
  return (
    <HapticPressable onPress={onPress} style={styles.button}>
      <StyledText style={styles.buttonText}>{text}</StyledText>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonText: {
    fontSize: n(30),
  },
});
