import React from "react";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import ContentContainer from "@/components/ContentContainer";

export default function CustomiseTabsScreen() {
    const { preferences, updatePreference, isLoading } = useTabPreferences();

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
                value={preferences.showPlayingInNavbar}
                label="Now Playing"
                onValueChange={(value) =>
                    updatePreference("showPlayingInNavbar", value)
                }
            />
            <ToggleSwitch
                label="Liked Songs"
                value={preferences.showLikedSongs}
                onValueChange={(value) =>
                    updatePreference("showLikedSongs", value)
                }
            />
            <ToggleSwitch
                label="Artists"
                value={preferences.showArtists}
                onValueChange={(value) =>
                    updatePreference("showArtists", value)
                }
            />
            <ToggleSwitch
                label="Albums"
                value={preferences.showAlbums}
                onValueChange={(value) =>
                    updatePreference("showAlbums", value)
                }
            />
            <ToggleSwitch
                label="Podcasts"
                value={preferences.showPodcasts}
                onValueChange={(value) =>
                    updatePreference("showPodcasts", value)
                }
            />
            <ToggleSwitch
                label="Playlists"
                value={preferences.showPlaylists}
                onValueChange={(value) =>
                    updatePreference("showPlaylists", value)
                }
            />
            <ToggleSwitch
                label="Search"
                value={preferences.showSearch}
                onValueChange={(value) =>
                    updatePreference("showSearch", value)
                }
            />
        </ContentContainer>
    );
}
