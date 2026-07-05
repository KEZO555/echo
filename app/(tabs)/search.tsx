import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { usePreventDoubleTap } from "@/shared/hooks/usePreventDoubleTap";
import { n } from "@/shared/utils";
import { getAppFontFamily } from "@/shared/utils/appFont";

const NEWLINE_PATTERN = /\n/g;

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const { invertColors } = useSettings();

  const handleSubmit = usePreventDoubleTap((query?: string) => {
    const finalQuery = (query ?? searchQuery).trim();
    if (finalQuery.length > 0) {
      router.push({
        pathname: "/search-results",
        params: { query: finalQuery },
      });
    }
  });

  // Some keyboards (including the LightOS one) insert a newline instead of
  // firing onSubmitEditing, so treat a newline as pressing search.
  const handleChangeText = (text: string) => {
    if (text.includes("\n")) {
      const clean = text.replace(NEWLINE_PATTERN, "");
      setSearchQuery(clean);
      handleSubmit(clean);
      return;
    }
    setSearchQuery(text);
  };

  return (
    <ContentContainer
      headerIcon="check"
      headerIconPress={handleSubmit}
      headerIconShowLength={searchQuery.length}
      headerTitle="Search"
      hideBackButton={true}
    >
      <View
        style={[
          styles.inputContainer,
          { borderBottomColor: invertColors ? "black" : "white" },
        ]}
      >
        <TextInput
          cursorColor={invertColors ? "black" : "white"}
          enterKeyHint="search"
          onChangeText={handleChangeText}
          onSubmitEditing={() => handleSubmit()}
          placeholder="Search for something!"
          placeholderTextColor="#888"
          returnKeyType="search"
          selectionColor={invertColors ? "black" : "white"}
          style={[
            styles.input,
            { color: invertColors ? "black" : "white" },
            { fontFamily: getAppFontFamily() },
          ]}
          submitBehavior="blurAndSubmit"
          value={searchQuery}
        />
        {searchQuery.length > 0 && (
          <HapticPressable
            onPress={() => {
              setSearchQuery("");
              impactAsync(ImpactFeedbackStyle.Medium);
            }}
            style={styles.clearButton}
          >
            <MaterialIcons
              color={invertColors ? "black" : "white"}
              name="clear"
              size={n(24)}
            />
          </HapticPressable>
        )}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderBottomWidth: n(1),
  },
  input: {
    flex: 1,
    fontSize: n(24),
    paddingVertical: n(2),
    textAlign: "left",
    paddingBottom: n(6),
  },
  clearButton: {
    padding: n(5),
  },
});
