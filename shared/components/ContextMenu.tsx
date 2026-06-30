import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

export interface ContextMenuAction {
  label: string;
  onPress: () => void;
}

interface ContextMenuProps {
  visible: boolean;
  title?: string;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({
  visible,
  title,
  actions,
  onClose,
}: ContextMenuProps) {
  const { invertColors } = useSettings();

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: invertColors ? "white" : "black",
              borderColor: invertColors ? "black" : "white",
            },
          ]}
        >
          {title ? (
            <StyledText numberOfLines={1} style={styles.title}>
              {title}
            </StyledText>
          ) : null}
          <ScrollView
            bounces={false}
            overScrollMode="never"
            style={styles.scroll}
          >
            {actions.map((action) => (
              <HapticPressable
                key={action.label}
                onPress={action.onPress}
                style={styles.row}
              >
                <StyledText numberOfLines={2} style={styles.item}>
                  {action.label}
                </StyledText>
              </HapticPressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: n(30),
  },
  card: {
    width: "100%",
    maxHeight: "70%",
    borderWidth: n(1),
    paddingVertical: n(12),
    paddingHorizontal: n(20),
  },
  scroll: {
    flexGrow: 0,
  },
  title: {
    fontSize: n(16),
    opacity: 0.6,
    paddingBottom: n(8),
  },
  row: {
    paddingVertical: n(14),
  },
  item: {
    fontSize: n(22),
  },
});
