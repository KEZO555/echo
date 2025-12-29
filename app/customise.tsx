import React from "react";
import ContentContainer from "@/shared/components/ContentContainer";
import { useRouter } from "expo-router";
import { StyledButton } from "@/shared/components/StyledButton";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { useInvertColors } from "@/features/settings/contexts/InvertColorsContext";

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
