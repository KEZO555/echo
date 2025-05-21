import React, { useState, useCallback } from "react";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

export default function NamePlaylistScreen() {
    const [playlistName, setPlaylistName] = useState("");
    const router = useRouter();
    const { accessToken, user, fetchPlaylists } = useAuth();

    useFocusEffect(
        useCallback(() => {
            setPlaylistName("");
        }, [])
    );

    const handleCreatePlaylist = async () => {
        if (!playlistName.trim()) {
            Alert.alert(
                "Playlist Name Required",
                "Please enter a name for your playlist."
            );
            return;
        }

        if (!accessToken || !user || !user.id) {
            Alert.alert(
                "Authentication Error",
                "Could not create playlist. Please try logging in again."
            );
            console.error(
                "Create Playlist Error: Missing accessToken or user ID"
            );
            return;
        }

        try {
            const response = await fetch(
                `https://api.spotify.com/v1/users/${user.id}/playlists`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: playlistName,
                        public: false,
                    }),
                }
            );

            if (response.ok) {
                const newPlaylist = await response.json();
                console.log("Playlist created successfully:", newPlaylist);
                if (fetchPlaylists) {
                    await fetchPlaylists();
                }
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace("/(tabs)/playlists");
                }
            } else {
                const errorData = await response.json();
                Alert.alert(
                    "Error Creating Playlist",
                    errorData?.error?.message || "An unknown error occurred."
                );
                console.error("Error creating playlist:", errorData);
            }
        } catch (error) {
            Alert.alert(
                "Network Error",
                "Could not connect to Spotify. Please check your connection."
            );
            console.error("Network error creating playlist:", error);
        }
    };

    return (
        <>
            <Stack.Screen />
            <View style={styles.container}>
                <Header
                    iconName="check"
                    iconShowLength={playlistName.length}
                    headerTitle="Name your Playlist"
                    onIconPress={handleCreatePlaylist}
                />

                <View style={styles.content}>
                    <TextInput
                        style={styles.input}
                        onChangeText={setPlaylistName}
                        value={playlistName}
                        placeholder="Enter playlist name"
                        placeholderTextColor="#888"
                        autoFocus={true}
                        cursorColor="white"
                        selectionColor="white"
                        onSubmitEditing={handleCreatePlaylist}
                    />
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",
    },
    content: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "center",
        padding: 20,
    },
    input: {
        width: "90%",
        borderBottomWidth: 1,
        borderBottomColor: "white",
        color: "white",
        fontSize: 24,
        fontFamily: "PublicSans-Regular",
        paddingVertical: 2,
        textAlign: "left",
    },
});
