import { MaterialIcons } from "@expo/vector-icons";
import { Image, type ImageStyle } from "expo-image";
import React, { useState } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { StyledText } from "./StyledText";

interface FallbackImageProps {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  placeholderIcon?: keyof typeof MaterialIcons.glyphMap;
  placeholderText?: string;
  placeholderIconSize?: number;
  placeholderIconColor?: string;
}

export const FallbackImage = React.memo(function FallbackImage({
  uri,
  style,
  containerStyle,
  placeholderIcon = "music-note",
  placeholderText,
  placeholderIconSize = 100,
  placeholderIconColor = "white",
}: FallbackImageProps) {
  const [hasError, setHasError] = useState(false);

  const showPlaceholder = !uri || hasError;

  if (showPlaceholder) {
    return (
      <View style={[styles.placeholderContainer, containerStyle, style]}>
        {placeholderText ? (
          <StyledText
            style={[
              styles.placeholderText,
              { fontSize: placeholderIconSize * 0.6 },
            ]}
          >
            {placeholderText}
          </StyledText>
        ) : (
          <MaterialIcons
            color={placeholderIconColor}
            name={placeholderIcon}
            size={placeholderIconSize}
          />
        )}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Image
        cachePolicy="disk"
        onError={() => setHasError(true)}
        source={{ uri }}
        style={style}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  placeholderContainer: {
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "white",
  },
});
