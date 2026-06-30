import AutoScroll from "@homielab/react-native-auto-scroll";
import { useCallback, useState } from "react";
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
} from "react-native";
import { n } from "@/shared/utils";
import { StyledText } from "./StyledText";

interface MarqueeTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  msPerChar?: number;
  delay?: number;
  isActive?: boolean;
}

export function MarqueeText({
  children,
  style,
  msPerChar = 380,
  delay = 1800,
  isActive = true,
}: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  const shouldScroll =
    isActive && textWidth > containerWidth + 5 && containerWidth > 0;
  const duration = children.length * msPerChar;

  return (
    <View onLayout={handleContainerLayout} style={styles.container}>
      <View pointerEvents="none" style={styles.measuringContainer}>
        <StyledText onLayout={handleTextLayout} style={style}>
          {children}
        </StyledText>
      </View>

      {shouldScroll ? (
        <AutoScroll
          delay={delay}
          duration={duration}
          endPaddingWidth={n(25)}
          style={styles.scrollContainer}
        >
          <StyledText style={style}>{children}</StyledText>
        </AutoScroll>
      ) : (
        <StyledText numberOfLines={1} style={style}>
          {children}
        </StyledText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  measuringContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0,
  },
  scrollContainer: {
    width: "100%",
  },
});
