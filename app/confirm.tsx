import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { n } from "@/shared/utils";

export default function ConfirmScreen() {
  const router = useRouter();
  const { invertColors } = useSettings();
  const params = useLocalSearchParams<{
    title: string;
    message: string;
    confirmText: string;
    action: string;
  }>();

  const handleConfirm = () => {
    router.navigate({
      pathname: "/(tabs)/settings",
      params: { confirmed: "true", action: params.action },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  const textColor = invertColors ? "black" : "white";

  return (
    <ContentContainer
      headerTitle={params.title || "Confirm"}
      hideBackButton={false}
      onBackPress={handleCancel}
    >
      <StyledText style={styles.messageText}>{params.message}</StyledText>

      <View style={styles.buttonContainer}>
        <HapticPressable onPress={handleConfirm} style={styles.button}>
          <StyledText style={[styles.buttonText, { color: textColor }]}>
            {params.confirmText || "Confirm"}
          </StyledText>
        </HapticPressable>
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  messageText: {
    fontSize: n(18),
    marginHorizontal: 0,
    marginTop: n(10),
  },
  buttonContainer: {
    width: "100%",
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  button: {
    paddingVertical: n(15),
    paddingHorizontal: n(30),
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: n(200),
  },
  buttonText: {
    fontSize: n(40),
    textTransform: "uppercase",
  },
});
