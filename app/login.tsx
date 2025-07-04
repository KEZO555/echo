import React from "react";
import { View, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledText } from "@/components/StyledText";
import { HapticPressable } from "@/components/HapticPressable";
import ContentContainer from "@/components/ContentContainer";

export default function LoginScreen() {
	const { login, isLoading } = useAuth();

	return (
		<ContentContainer headerTitle="Login" hideBackButton={true}>
            <StyledText style={styles.informationText}>
                Welcome to the beta testing of a Spotify client for the
                Light Phone III!
                {"\n"}
                {"\n"}
                No matter how big or small, please don't hesitate to report
                any bugs, issues or feedback!
                {"\n"}
                {"\n"}
                With love,
                {"\n"}
                Vandam
            </StyledText>

            <View style={{ width: "100%", flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
                <HapticPressable
                    onPress={login}
                    style={styles.loginButton}
                    disabled={isLoading}
                >
                    <StyledText style={styles.loginButtonText}>Login</StyledText>
                </HapticPressable>
            </View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	informationText: {
		fontSize: 18,
		marginHorizontal: 0,
		marginTop: 10,
	},
	loginButton: {
		paddingVertical: 15,
		paddingHorizontal: 30,
		alignItems: "center",
		justifyContent: "flex-end",
		minWidth: 200,
	},
	loginButtonText: {
		fontSize: 40,
		textTransform: "uppercase",
	},
});
