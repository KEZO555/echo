import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { StyledText } from "./StyledText";
import { HapticPressable } from "./HapticPressable";

interface HeaderProps {
    iconName?: keyof typeof MaterialIcons.glyphMap;
    onIconPress?: () => void;
    iconShowLength?: number;
    headerTitle?: string;
    backEvent?: () => void;
    artist?: string;
}

export function ItemHeader({
    iconName,
    onIconPress,
    iconShowLength = 1,
    headerTitle,
    backEvent,
    artist,
}: HeaderProps) {
    const handleBack = backEvent
        ? backEvent
        : () => {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace("/");
            }
        };

    return (
        <View style={styles.header}>
            <HapticPressable onPress={handleBack}>
                <View style={{ width: 32, height: 32, alignItems: "center" }}>
                    <MaterialIcons
                        name="arrow-back-ios"
                        size={28}
                        color="white"
                    />
                </View>
            </HapticPressable>
            <View style={styles.titleContainer}>
                <StyledText style={styles.title} numberOfLines={1}>
                    {headerTitle}
                </StyledText>
                <StyledText style={styles.owner} numberOfLines={1}>
                    {artist}
                </StyledText>
            </View>
            {iconShowLength > 0 && iconName ? (
                <HapticPressable onPress={onIconPress}>
                    <View
                        style={{ width: 32, height: 32, alignItems: "center" }}
                    >
                        <MaterialIcons
                            name={iconName}
                            size={28}
                            color="white"
                        />
                    </View>
                </HapticPressable>
            ) : (
                <View style={{ width: 32, height: 32, alignItems: "center" }}>
                    <MaterialIcons
                        name="arrow-back-ios"
                        size={28}
                        color="black"
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 22,
        paddingVertical: 10,
        backgroundColor: "black",
        zIndex: 1,
    },
    titleContainer: {
        flex: 1,
        gap: 0,
        alignItems: "center",
    },
    title: {
        fontFamily: "PublicSans-Regular",
        fontSize: 18,
        lineHeight: 20,
    },
    owner: {
        fontFamily: "PublicSans-Regular",
        fontSize: 10,
    },
});
