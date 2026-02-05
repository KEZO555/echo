import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useCredentials } from "@/features/credentials";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { n } from "@/shared/utils";

export default function ErrorScreen() {
  const router = useRouter();
  const { invertColors } = useSettings();
  const { clearCredentials } = useCredentials();
  const params = useLocalSearchParams<{
    title: string;
    message: string;
    buttonText?: string;
  }>();

  const handleDismiss = async () => {
    await clearCredentials();
    router.replace("/login");
  };

  const textColor = invertColors ? "black" : "white";

  return (
    <ContentContainer
      headerTitle={params.title || "Error"}
      hideBackButton={true}
    >
      <StyledText style={styles.messageText}>{params.message}</StyledText>

      <View style={styles.buttonContainer}>
        <HapticPressable onPress={handleDismiss} style={styles.button}>
          <StyledText style={[styles.buttonText, { color: textColor }]}>
            {params.buttonText || "OK"}
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
