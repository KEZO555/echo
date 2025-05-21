import React, { useState } from "react";
import { View, StyleSheet, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { Header } from "@/components/Header";
import { TabHeader } from "@/components/TabHeader";

export default function SearchScreen() {
	const [searchQuery, setSearchQuery] = useState("");

	return (
		<View style={styles.container}>
			<TabHeader
				headerTitle="Search"
				rightIconName="check"
				rightOnIconPress={() => {
					router.push({
						pathname: "/search-results",
						params: { query: searchQuery },
					});
				}}
				iconShowLength={searchQuery.length}
			/>
			<View style={styles.content}>
				<TextInput
					style={styles.input}
					placeholderTextColor="#888"
					value={searchQuery}
					placeholder="Search for something!"
					onChangeText={setSearchQuery}
					cursorColor="white"
					selectionColor="white"
					onSubmitEditing={() => {
						if (searchQuery.length > 0) {
							router.push({
								pathname: "/search-results",
								params: { query: searchQuery },
							});
						}
					}}
				/>
			</View>
		</View>
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
		backgroundColor: "black",
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
