import type { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useSettings } from "@/features/settings";
import { Header } from "@/shared/components/Header";
import { n } from "@/shared/utils";

interface ContentContainerProps {
  headerTitle?: string;
  children?: ReactNode;
  hideBackButton?: boolean;
  onBackPress?: () => void;
  headerIcon?: keyof typeof MaterialIcons.glyphMap;
  headerIconPress?: () => void;
  headerIconShowLength?: number;
  style?: StyleProp<ViewStyle>;
  onTitlePress?: () => void;
}

export default function ContentContainer({
  headerTitle,
  children,
  hideBackButton = false,
  onBackPress,
  headerIcon,
  headerIconPress,
  headerIconShowLength = 1,
  style,
  onTitlePress,
}: ContentContainerProps) {
  const { invertColors } = useSettings();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: invertColors ? "white" : "black" },
      ]}
    >
      {headerTitle && (
        <Header
          backEvent={onBackPress}
          headerTitle={headerTitle}
          hideBackButton={hideBackButton}
          iconName={headerIcon}
          iconShowLength={headerIconShowLength}
          onIconPress={headerIconPress}
          onTitlePress={onTitlePress}
        />
      )}
      <View style={[styles.content, style]}>{children ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingHorizontal: n(37),
    paddingTop: n(14),
    gap: n(47),
  },
});
