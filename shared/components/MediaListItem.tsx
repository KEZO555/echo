import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, type ImageStyle } from "expo-image";
import React, { useState } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useSettings } from "@/features/settings";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
import { n } from "@/shared/utils";

interface MediaListItemProps {
  primaryText: string;
  secondaryText?: string;
  imageUri?: string;
  placeholderIcon?: keyof typeof MaterialIcons.glyphMap;
  forceShowImage?: boolean;
  disabled?: boolean;
  primaryLines?: number;
  onPress: () => void;
  onLongPress?: () => void;
  imageStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
}

export const MediaListItem = React.memo(function MediaListItem({
  primaryText,
  secondaryText,
  imageUri,
  placeholderIcon = "music-note",
  forceShowImage = false,
  disabled = false,
  primaryLines = 1,
  onPress,
  onLongPress,
  imageStyle,
  style,
}: MediaListItemProps) {
  const { hideAlbumCovers, invertColors } = useSettings();
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !imageUri || imageError;
  const shouldShowImage = forceShowImage || !hideAlbumCovers;

  return (
    <HapticPressable
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={[
        styles.itemContainer,
        // Multi-line rows top-align the thumbnail with the first line of text
        // instead of centering it against the taller title+subtitle block.
        primaryLines > 1 && styles.itemContainerTop,
        disabled && styles.disabledContainer,
        style,
      ]}
    >
      {shouldShowImage &&
        (showPlaceholder ? (
          <View style={[styles.placeholderImageContainer, imageStyle]}>
            <MaterialIcons
              color={disabled ? "#666" : "white"}
              name={placeholderIcon}
              size={n(24)}
            />
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image
              cachePolicy="disk"
              onError={() => setImageError(true)}
              source={{ uri: imageUri }}
              style={[styles.image, imageStyle]}
            />
          </View>
        ))}
      <View style={styles.textContainer}>
        <StyledText numberOfLines={primaryLines} style={styles.primaryText}>
          {primaryText}
        </StyledText>
        {secondaryText && (
          <StyledText
            numberOfLines={1}
            style={[
              styles.secondaryText,
              { color: getSecondaryContentColor(invertColors) },
            ]}
          >
            {secondaryText}
          </StyledText>
        )}
      </View>
    </HapticPressable>
  );
});

const styles = StyleSheet.create({
  itemContainer: {
    minHeight: n(50),
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  itemContainerTop: {
    alignItems: "flex-start",
  },
  imageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
    position: "relative",
  },
  image: {
    width: n(50),
    height: n(50),
  },
  placeholderImageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 0,
    paddingRight: n(10),
  },
  // LightOS list metrics: "ParagraphWide" (25, 2% spacing) for primary,
  // "Detail" (20) for secondary.
  primaryText: {
    fontSize: n(25),
    lineHeight: n(28),
    letterSpacing: n(0.5),
  },
  secondaryText: {
    fontSize: n(20),
    lineHeight: n(23),
  },
  disabledContainer: {
    opacity: 0.3,
  },
});
