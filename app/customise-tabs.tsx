import React from "react";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";

export default function CustomiseTabsScreen() {
    const { tabPreferences, updateTabPreference, isLoading } = useSettings();

    if (isLoading) {
        return (
            <ContentContainer headerTitle="Customise Tabs">
            </ContentContainer>
        );
    }

    return (
        <ContentContainer
            headerTitle="Customise Tabs"
        >
            <ToggleSwitch
                value={tabPreferences.showPlayingInNavbar}
                label="Now Playing"
                onValueChange={(value) =>
                    updateTabPreference("showPlayingInNavbar", value)
                }
            />
            <ToggleSwitch
                label="Liked Songs"
                value={tabPreferences.showLikedSongs}
                onValueChange={(value) =>
                    updateTabPreference("showLikedSongs", value)
                }
            />
            <ToggleSwitch
                label="Artists"
                value={tabPreferences.showArtists}
                onValueChange={(value) =>
                    updateTabPreference("showArtists", value)
                }
            />
            <ToggleSwitch
                label="Albums"
                value={tabPreferences.showAlbums}
                onValueChange={(value) =>
                    updateTabPreference("showAlbums", value)
                }
            />
            <ToggleSwitch
                label="Podcasts"
                value={tabPreferences.showPodcasts}
                onValueChange={(value) =>
                    updateTabPreference("showPodcasts", value)
                }
            />
            <ToggleSwitch
                label="Playlists"
                value={tabPreferences.showPlaylists}
                onValueChange={(value) =>
                    updateTabPreference("showPlaylists", value)
                }
            />
            <ToggleSwitch
                label="Search"
                value={tabPreferences.showSearch}
                onValueChange={(value) =>
                    updateTabPreference("showSearch", value)
                }
            />
        </ContentContainer>
    );
}
