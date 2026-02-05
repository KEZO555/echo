import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useCredentials } from "@/features/credentials";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { n } from "@/shared/utils";

type SetupStep = "clientId" | "clientSecret";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const { credentials, isConfigured, saveCredentials, clearCredentials } =
    useCredentials();
  const { invertColors } = useSettings();

  const [step, setStep] = useState<SetupStep>("clientId");
  const [clientId, setClientId] = useState(credentials?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const textColor = invertColors ? "black" : "white";
  const borderColor = invertColors ? "black" : "white";

  const handleClientIdNext = () => {
    if (clientId.trim()) {
      setStep("clientSecret");
    }
  };

  const handleSaveCredentials = async () => {
    if (!clientSecret.trim()) return;

    setIsSaving(true);
    try {
      await saveCredentials({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToSetup = async () => {
    await clearCredentials();
    setStep("clientSecret");
  };

  if (!isConfigured) {
    if (step === "clientId") {
      return (
        <ContentContainer
          headerIcon="arrow-forward"
          headerIconPress={handleClientIdNext}
          headerIconShowLength={clientId.trim().length}
          headerTitle="Client ID"
          hideBackButton={true}
        >
          <View
            style={[styles.inputContainer, { borderBottomColor: borderColor }]}
          >
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              cursorColor={textColor}
              onChangeText={setClientId}
              onSubmitEditing={handleClientIdNext}
              placeholder="Enter your Client ID"
              placeholderTextColor="#888"
              selectionColor={textColor}
              style={[styles.input, { color: textColor }]}
              value={clientId}
            />
            {clientId.length > 0 && (
              <HapticPressable
                onPress={() => {
                  setClientId("");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                style={styles.clearButton}
              >
                <MaterialIcons color={textColor} name="clear" size={n(24)} />
              </HapticPressable>
            )}
          </View>
        </ContentContainer>
      );
    }

    return (
      <ContentContainer
        headerIcon="arrow-forward"
        headerIconPress={handleSaveCredentials}
        headerIconShowLength={clientSecret.trim().length}
        headerTitle="Client Secret"
        hideBackButton={false}
        onBackPress={() => setStep("clientId")}
      >
        <View
          style={[styles.inputContainer, { borderBottomColor: borderColor }]}
        >
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            cursorColor={textColor}
            onChangeText={setClientSecret}
            onSubmitEditing={handleSaveCredentials}
            placeholder="Enter your Client Secret"
            placeholderTextColor="#888"
            selectionColor={textColor}
            style={[styles.input, { color: textColor }]}
            value={clientSecret}
          />
          {clientSecret.length > 0 && (
            <HapticPressable
              onPress={() => {
                setClientSecret("");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={styles.clearButton}
            >
              <MaterialIcons color={textColor} name="clear" size={n(24)} />
            </HapticPressable>
          )}
        </View>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerTitle="Login"
      hideBackButton={false}
      onBackPress={handleBackToSetup}
    >
      <StyledText style={styles.informationText}>
        Welcome to Echo!
        {"\n"}
        {"\n"}
        If there are any issues, please don't hesitate to let me know via
        GitHub.
        {"\n"}
        {"\n"}
        If you'd like to support development, please consider sponsoring me on
        GitHub. Any support helps keep the project going and is greatly
        appreciated! :)
        {"\n"}
        {"\n"}
        With love,
        {"\n"}
        Vandam
      </StyledText>

      <View style={styles.buttonContainer}>
        <HapticPressable
          disabled={isLoading}
          onPress={login}
          style={styles.loginButton}
        >
          <StyledText style={styles.loginButtonText}>Login</StyledText>
        </HapticPressable>
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  informationText: {
    fontSize: n(18),
    marginHorizontal: 0,
    marginTop: n(10),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderBottomWidth: n(1),
  },
  input: {
    flex: 1,
    fontSize: n(24),
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(2),
    textAlign: "left",
    paddingBottom: n(6),
  },
  clearButton: {
    padding: n(5),
  },
  buttonContainer: {
    width: "100%",
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  loginButton: {
    paddingVertical: n(15),
    paddingHorizontal: n(30),
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: n(200),
  },
  loginButtonText: {
    fontSize: n(40),
    textTransform: "uppercase",
  },
});
