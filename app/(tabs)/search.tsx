import React, { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";

export default function SearchScreen() {
	const [searchQuery, setSearchQuery] = useState("");
    const { invertColors } = useInvertColors();

	return (
        <ContentContainer 
            headerTitle="Search"
            hideBackButton={true}
            headerIcon="check"
            headerIconShowLength={searchQuery.length}
            headerIconPress={() => {
					router.push({
						pathname: "/search-results",
						params: { query: searchQuery },
					});
				}}
        >
			<View
				style={[
					styles.inputContainer,
					{ borderBottomColor: invertColors ? "black" : "white" },
				]}
			>
				<TextInput
					style={[
						styles.input,
						{ color: invertColors ? "black" : "white" },
					]}
					placeholderTextColor="#888"
					value={searchQuery}
					placeholder="Search for something!"
					onChangeText={setSearchQuery}
					cursorColor={invertColors ? "black" : "white"}
					selectionColor={invertColors ? "black" : "white"}
					onSubmitEditing={() => {
						if (searchQuery.length > 0) {
                            router.push({
                                pathname: "/search-results",
                                params: { query: searchQuery },
                            });
						}
					}}
				/>
				{searchQuery.length > 0 && (
					<HapticPressable
						style={styles.clearButton}
						onPress={() => {
							setSearchQuery("");
							Haptics.impactAsync(
								Haptics.ImpactFeedbackStyle.Medium
							);
						}}
					>
						<MaterialIcons
							name="clear"
							size={24}
							color={invertColors ? "black" : "white"}
						/>
					</HapticPressable>
				)}
			</View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		borderBottomWidth: 1,
	},
	input: {
		flex: 1,
		fontSize: 24,
		fontFamily: "PublicSans-Regular",
		paddingVertical: 2,
		textAlign: "left",
		paddingBottom: 6,
	},
	clearButton: {
		padding: 5,
	},
});
