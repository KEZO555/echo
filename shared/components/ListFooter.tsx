import React from "react";
import { ActivityIndicator } from "react-native";

interface ListFooterProps {
    isLoading: boolean;
}

export function ListFooter({ isLoading }: ListFooterProps) {
    if (!isLoading) return null;
    return (
        <ActivityIndicator
            style={{ marginVertical: 20 }}
            size="large"
            color="white"
        />
    );
}
