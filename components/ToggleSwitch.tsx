import React from "react";
import { View, StyleSheet } from "react-native";
import { StyledText } from "./StyledText";
import { HapticPressable } from "./HapticPressable";

interface MyCustomSwitchGraphicProps {
	value: boolean;
	disabled?: boolean;
}

const CIRCLE_DIAMETER = 9.8;
const CIRCLE_BORDER = 2.5;
const LINE_WIDTH = 14.5;
const LINE_HEIGHT = 2.22;

const MyCustomSwitchGraphic = ({
	value,
	disabled,
}: MyCustomSwitchGraphicProps) => {
	const switchColor = disabled ? "#777777" : "#FFFFFF";

	const graphicStyles = StyleSheet.create({
		container: {
			flexDirection: "row",
			alignItems: "center",
		},
		circle: {
			width: CIRCLE_DIAMETER,
			height: CIRCLE_DIAMETER,
			borderRadius: CIRCLE_DIAMETER / 2,
			backgroundColor: switchColor,
		},
		hollowCircle: {
			width: CIRCLE_DIAMETER,
			height: CIRCLE_DIAMETER,
			borderRadius: CIRCLE_DIAMETER / 2,
			borderWidth: CIRCLE_BORDER,
			borderColor: switchColor,
		},
		line: {
			width: LINE_WIDTH,
			height: LINE_HEIGHT,
			backgroundColor: switchColor,
		},
	});

	return (
		<View style={graphicStyles.container}>
			{!value ? (
				<>
					<View style={graphicStyles.hollowCircle} />
					<View style={graphicStyles.line} />
				</>
			) : (
				<>
					<View style={graphicStyles.line} />
					<View style={graphicStyles.circle} />
				</>
			)}
		</View>
	);
};

interface ToggleSwitchProps {
	label: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
	disabled?: boolean;
}

export function ToggleSwitch({
	label,
	value,
	onValueChange,
	disabled = false,
}: ToggleSwitchProps) {
	return (
		<View style={styles.container}>
			<HapticPressable
				onPress={() => {
					if (!disabled) {
						onValueChange(!value);
					}
				}}
				disabled={disabled}
				style={[styles.container]}
			>
				<View style={styles.switchTouchable}>
					<MyCustomSwitchGraphic value={value} disabled={disabled} />
				</View>
				<View style={styles.textTouchable}>
					<StyledText
						style={[styles.label, disabled && styles.disabledLabel]}
					>
						{label}
					</StyledText>
				</View>
			</HapticPressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 13.5,
	},
	switchTouchable: {
		marginTop: 12,
		marginRight: 22,
		marginLeft: 26,
	},
	textTouchable: {
		flex: 1,
	},
	label: {
		color: "white",
		fontSize: 30,
	},
	disabledLabel: {
		color: "#777777",
	},
});
