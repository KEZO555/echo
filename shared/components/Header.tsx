import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface HeaderProps {
  iconName?: keyof typeof MaterialIcons.glyphMap;
  onIconPress?: () => void;
  iconShowLength?: number;
  headerTitle?: string;
  backEvent?: () => void;
  hideBackButton?: boolean;
  onTitlePress?: () => void;
}

export const Header = React.memo(function Header({
  iconName,
  onIconPress,
  iconShowLength = 1,
  headerTitle,
  backEvent,
  hideBackButton = false,
  onTitlePress,
}: HeaderProps) {
  const { invertColors } = useSettings();
  const handleBack = backEvent
    ? backEvent
    : () => {
        if (router.canGoBack()) {
          router.back();
        }
      };

  const iconColor = invertColors ? "black" : "white";

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: invertColors ? "white" : "black" },
      ]}
    >
      {hideBackButton ? (
        <View style={styles.iconContainerLeft} />
      ) : (
        <HapticPressable onPress={handleBack}>
          <View style={styles.iconContainerLeft}>
            <MaterialIcons
              color={iconColor}
              name="arrow-back-ios"
              size={n(28)}
            />
          </View>
        </HapticPressable>
      )}

      {onTitlePress ? (
        <HapticPressable onPress={onTitlePress} style={styles.titlePressable}>
          <StyledText numberOfLines={1} style={styles.titleText}>
            {headerTitle}
          </StyledText>
        </HapticPressable>
      ) : (
        <StyledText
          numberOfLines={1}
          style={[styles.titleText, styles.titleMaxWidth]}
        >
          {headerTitle}
        </StyledText>
      )}
      {iconShowLength > 0 && iconName ? (
        <HapticPressable onPress={onIconPress}>
          <View style={styles.iconContainerRight}>
            <MaterialIcons color={iconColor} name={iconName} size={n(28)} />
          </View>
        </HapticPressable>
      ) : (
        <View style={styles.iconContainerRight} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: n(22),
    paddingVertical: n(5),
    zIndex: 1,
  },
  iconContainerLeft: {
    width: n(32),
    height: n(32),
    alignItems: "center",
    paddingTop: n(6),
    paddingRight: n(4),
  },
  iconContainerRight: {
    width: n(32),
    height: n(32),
    alignItems: "center",
    paddingTop: n(6),
    paddingLeft: n(4),
  },
  titlePressable: {
    maxWidth: "75%",
  },
  titleText: {
    fontSize: n(20),
    fontFamily: "PublicSans-Regular",
    paddingTop: n(2),
  },
  titleMaxWidth: {
    maxWidth: "75%",
  },
});
