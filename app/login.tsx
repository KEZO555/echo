import React from "react";
import {
	View,
	Button,
	StyleSheet,
	Text,
	ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledText } from "@/components/StyledText";

export default function LoginScreen() {
	const { login, isLoading, user } = useAuth();

	return (
		<View style={styles.container}>
			<TabHeader headerTitle="Welcome!" hideWaveformButton={true} />
			<View style={styles.content}>
				<StyledText style={styles.informationText}>
					Welcome to Spotify for the Light Phone III!
					{"\n"}
					{"\n"}
					This app is a Spotify client that allows you to listen to
					your Spotify library through a LightOS-themed UI.
					{"\n"}
					{"\n"}
					Important:
					{"\n"}• You must have Spotify Premium
					{"\n"}• You must have the Spotify app installed
					{"\n"}• I do not store or collect any of your data
					{"\n"}
					{"\n"}
					This app is currently in beta. No matter how big or small,
					please don't hesitate to report any bugs, issues or
					feedback!
					{"\n"}
					{"\n"}
					With love,
					{"\n"}
					Vandam
				</StyledText>
			</View>

			<HapticPressable
				onPress={login}
				style={styles.loginButton}
				disabled={isLoading}
			>
				<StyledText style={styles.loginButtonText}>Login</StyledText>
			</HapticPressable>
		</View>
	);
}

// Quick HapticPressable definition (ideally this would be imported from your components)
import { Pressable, PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { Header } from "@/components/Header";
import { TabHeader } from "@/components/TabHeader";

interface HapticPressableProps extends PressableProps {
	impactStyle?: Haptics.ImpactFeedbackStyle;
}
const HapticPressable: React.FC<HapticPressableProps> = ({
	onPress,
	impactStyle = Haptics.ImpactFeedbackStyle.Light,
	...props
}) => {
	const handlePress = (event: any) => {
		Haptics.impactAsync(impactStyle);
		if (onPress) {
			onPress(event);
		}
	};
	return <Pressable onPress={handlePress} {...props} />;
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	content: {
		flex: 1,
		backgroundColor: "black",
		alignItems: "center",
		justifyContent: "flex-start",
		width: "100%",
	},
	informationText: {
		color: "white",
		fontSize: 18,
		marginHorizontal: 40,
		marginTop: 10,
	},
	loginButton: {
		paddingVertical: 15,
		paddingHorizontal: 30,
		alignItems: "center",
		justifyContent: "center",
		minWidth: 200,
	},
	loginButtonText: {
		color: "white",
		fontSize: 40,
		textTransform: "uppercase",
	},
	buttonSpacing: {
		marginVertical: 15, // To match paddingVertical of the button for consistent spacing
	},
});
