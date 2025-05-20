import React from "react";
import { View, StyleSheet, Text } from "react-native";

export default function SearchScreen() {
	return (
		<View style={styles.contentContainer}>
			<Text style={{ color: "white" }}>Search Screen</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	contentContainer: {
		flex: 1,
		backgroundColor: "black",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
});
