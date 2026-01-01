import React from "react";
import ContentContainer from "@/shared/components/ContentContainer";
import { useRouter } from "expo-router";
import { StyledButton } from "@/shared/components/StyledButton";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { useSettings } from "@/features/settings";

export default function CustomiseTabsScreen() {
    const router = useRouter();
    const { invertColors, setInvertColors, hideAlbumCovers, setHideAlbumCovers, hideDetailCovers, setHideDetailCovers } = useSettings();
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

            <ToggleSwitch
                value={hideAlbumCovers}
                label="Hide Item Images"
                onValueChange={setHideAlbumCovers}
            />

            <ToggleSwitch
                value={hideDetailCovers}
                label="Hide Detail Images"
                onValueChange={setHideDetailCovers}
            />

            <StyledButton
                text="Navigation Bar"
                onPress={handleCustomiseTabs}
            />
        </ContentContainer>
    );
}
