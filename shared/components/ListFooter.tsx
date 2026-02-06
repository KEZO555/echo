import { ActivityIndicator } from "react-native";
import { n } from "@/shared/utils";

interface ListFooterProps {
  isLoading: boolean;
}

export function ListFooter({ isLoading }: ListFooterProps) {
  if (!isLoading) {
    return null;
  }
  return (
    <ActivityIndicator
      color="white"
      size="large"
      style={{ marginVertical: n(20) }}
    />
  );
}
