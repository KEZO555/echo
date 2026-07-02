import React from "react";
import { Text as DefaultText, type TextProps } from "react-native";
import { useSettings } from "@/features/settings";
import { getAppFontFamily } from "@/shared/utils/appFont";

interface StyledTextProps extends TextProps {
  children: React.ReactNode;
}

export const StyledText = React.memo(function StyledText({
  style,
  ...rest
}: StyledTextProps) {
  const { invertColors } = useSettings();
  return (
    <DefaultText
      style={[
        // Resolved at render time: the system Akkurat font (matching the
        // built-in LightOS tools) is only known after startup detection.
        {
          fontFamily: getAppFontFamily(),
          color: invertColors ? "black" : "white",
        },
        style,
      ]}
      {...rest}
    />
  );
});
