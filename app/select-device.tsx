import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useAuth } from "@/contexts/AuthContext";
import { SpotifyDevice } from "@/types/spotify";
import { router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import CustomScrollView from "@/components/CustomScrollView";

export default function SelectDeviceScreen() {
	const { makeApiRequest, ensureValidToken } = useAuth();
	const [devices, setDevices] = useState<SpotifyDevice[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchDevices = async () => {
		setIsLoading(true);
		try {
			const data = await makeApiRequest(
				"https://api.spotify.com/v1/me/player/devices",
				"Fetch available devices"
			);
			if (data && data.devices) {
				setDevices(data.devices);
			}
		} catch (error) {
			console.error("Error fetching devices:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchDevices();
	}, []);

	const handleSelectDevice = async (deviceId: string | null) => {
		if (!deviceId) return;
		try {
			const validToken = await ensureValidToken();
			if (!validToken) return;
			await fetch("https://api.spotify.com/v1/me/player", {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${validToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ device_ids: [deviceId] }),
			});
		} catch (error) {
			console.error("Error transferring playback to device:", error);
		}
		if (router.canGoBack()) {
			router.back();
		} else {
			router.replace("/playing");
		}
	};

	if (isLoading) {
		return (
            <ContentContainer headerTitle="Select a device" >
				<ActivityIndicator size="large" color="white" />
			</ContentContainer>
		);
	}

	return (
		<ContentContainer headerTitle="Select a device" >
				<CustomScrollView
					data={devices}
					keyExtractor={(item, index) => item.id ?? index.toString()}
					renderItem={({ item }) => {
						return (
							<HapticPressable
								style={[styles.itemContainer]}
								onPress={() => handleSelectDevice(item.id)}
							>
								<StyledText
									style={[
										styles.deviceName,
										item.is_active &&
											styles.activeDeviceText,
									]}
									numberOfLines={1}
								>
									{item.name === "LightPhoneIII"
										? "Light Phone III"
										: item.name}
								</StyledText>
							</HapticPressable>
						);
					}}
				/>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	itemContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingBottom: 46,
	},
	deviceName: {
		fontSize: 30,
	},
	activeDeviceText: {
		textDecorationLine: "underline",
	},
});
