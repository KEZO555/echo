import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface HeaderProps {
  leftIconName?: keyof typeof MaterialIcons.glyphMap;
  onLeftIconPress?: () => void;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  onIconPress?: () => void;
  iconShowLength?: number;
  iconLoading?: boolean;
  headerTitle?: string;
  backEvent?: () => void;
  hideBackButton?: boolean;
  onTitlePress?: () => void;
  showNowPlaying?: boolean;
}

export const Header = React.memo(function Header({
  leftIconName,
  onLeftIconPress,
  iconName,
  onIconPress,
  iconShowLength = 1,
  iconLoading = false,
  headerTitle,
  backEvent,
  hideBackButton = false,
  onTitlePress,
  showNowPlaying = false,
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
  let leftSlot = <View style={styles.iconContainerLeft} />;
  let actionSlot: React.ReactNode = null;
  const nowPlayingSlot = showNowPlaying ? (
    <HapticPressable onPress={() => router.push("/playing")}>
      <View style={styles.iconContainerRightIcon}>
        <MaterialIcons color={iconColor} name="graphic-eq" size={n(28)} />
      </View>
    </HapticPressable>
  ) : null;

  if (hideBackButton) {
    if (leftIconName) {
      leftSlot = (
        <HapticPressable onPress={onLeftIconPress}>
          <View style={styles.iconContainerLeft}>
            <MaterialIcons color={iconColor} name={leftIconName} size={n(28)} />
          </View>
        </HapticPressable>
      );
    }
  } else {
    leftSlot = (
      <HapticPressable onPress={handleBack}>
        <View style={styles.iconContainerLeft}>
          <MaterialIcons color={iconColor} name="arrow-back-ios" size={n(28)} />
        </View>
      </HapticPressable>
    );
  }

  if (iconLoading) {
    actionSlot = (
      <View style={styles.iconContainerRightIcon}>
        <ActivityIndicator
          color={iconColor}
          size="small"
          style={styles.loadingSpinner}
        />
      </View>
    );
  } else if (iconShowLength > 0 && iconName) {
    actionSlot = (
      <HapticPressable onPress={onIconPress}>
        <View style={styles.iconContainerRightIcon}>
          <MaterialIcons color={iconColor} name={iconName} size={n(28)} />
        </View>
      </HapticPressable>
    );
  }

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: invertColors ? "white" : "black" },
      ]}
    >
      <View style={[styles.side, styles.sideLeft]}>{leftSlot}</View>

      {onTitlePress ? (
        <HapticPressable onPress={onTitlePress} style={styles.titleWrap}>
          <StyledText numberOfLines={1} style={styles.titleText}>
            {headerTitle}
          </StyledText>
        </HapticPressable>
      ) : (
        <StyledText
          numberOfLines={1}
          style={[styles.titleText, styles.titleWrap]}
        >
          {headerTitle}
        </StyledText>
      )}

      <View style={[styles.side, styles.sideRight]}>
        {actionSlot}
        {nowPlayingSlot}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: n(22),
    paddingVertical: n(5),
    zIndex: 1,
  },
  side: {
    width: n(84),
    flexDirection: "row",
    alignItems: "center",
  },
  sideLeft: {
    justifyContent: "flex-start",
  },
  sideRight: {
    justifyContent: "flex-end",
    gap: n(14),
  },
  titleWrap: {
    flex: 1,
  },
  iconContainerLeft: {
    width: n(32),
    height: n(32),
    alignItems: "center",
    paddingTop: n(6),
    paddingRight: n(4),
  },
  iconContainerRightIcon: {
    width: n(32),
    height: n(32),
    alignItems: "center",
    paddingTop: n(6),
    paddingLeft: n(4),
  },
  loadingSpinner: {
    marginTop: n(4),
  },
  titleText: {
    fontSize: n(20),
    fontFamily: "PublicSans-Regular",
    paddingTop: n(2),
    textAlign: "center",
  },
});
