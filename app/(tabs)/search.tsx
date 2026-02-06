import { MaterialIcons } from "@expo/vector-icons";
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { usePreventDoubleTap } from "@/shared/hooks/usePreventDoubleTap";
import { n } from "@/shared/utils";

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const { invertColors } = useSettings();

  const handleSubmit = usePreventDoubleTap(() => {
    if (searchQuery.length > 0) {
      router.push({
        pathname: "/search-results",
        params: { query: searchQuery },
      });
    }
  });

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
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSubmit}
          placeholder="Search for something!"
          placeholderTextColor="#888"
          selectionColor={invertColors ? "black" : "white"}
          style={[styles.input, { color: invertColors ? "black" : "white" }]}
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
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(2),
    textAlign: "left",
    paddingBottom: n(6),
  },
  clearButton: {
    padding: n(5),
  },
});
