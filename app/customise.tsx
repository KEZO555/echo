import React from "react";
import ContentContainer from "@/components/ContentContainer";
import { useRouter } from "expo-router";
import { StyledButton } from "@/components/StyledButton";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";

export default function CustomiseTabsScreen() {
    const router = useRouter();
    const { invertColors, setInvertColors } = useInvertColors();
    const handleCustomiseTabs = () => {
        router.push("/customise-tabs" as any);
    };

    return (
        <ContentContainer
            headerTitle="Customise"
        >
            <ToggleSwitch
                value={invertColors}
                label="Invert Colours"
                onValueChange={setInvertColors}
            />

            <StyledButton
                text="Tabs"
                onPress={handleCustomiseTabs}
            />
        </ContentContainer>
    );
}
