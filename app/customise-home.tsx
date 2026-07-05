import { type HomeSectionId, useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { n } from "@/shared/utils";

interface HomeSectionConfig {
  id: HomeSectionId;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function CustomiseHomeScreen() {
  const {
    showContinueListening,
    setShowContinueListening,
    showNewEpisodes,
    setShowNewEpisodes,
    showRecentlyPlayed,
    setShowRecentlyPlayed,
    showTopTracks,
    setShowTopTracks,
    homeSectionOrder,
    reorderHomeSection,
    isLoading,
  } = useSettings();

  if (isLoading) {
    return <ContentContainer headerTitle="Home Screen" />;
  }

  const configs: Record<HomeSectionId, HomeSectionConfig> = {
    continueListening: {
      id: "continueListening",
      label: "Continue Listening",
      value: showContinueListening,
      onValueChange: setShowContinueListening,
    },
    newEpisodes: {
      id: "newEpisodes",
      label: "New Episodes",
      value: showNewEpisodes,
      onValueChange: setShowNewEpisodes,
    },
    recentlyPlayed: {
      id: "recentlyPlayed",
      label: "Recently Played",
      value: showRecentlyPlayed,
      onValueChange: setShowRecentlyPlayed,
    },
    topTracks: {
      id: "topTracks",
      label: "Top Tracks",
      value: showTopTracks,
      onValueChange: setShowTopTracks,
    },
  };

  const orderedSections = homeSectionOrder.map((id) => configs[id]);

  return (
    <ContentContainer headerTitle="Home Screen" style={{ gap: n(20) }}>
      {orderedSections.map((section, index) => (
        <ToggleSwitch
          isFirst={index === 0}
          isLast={index === orderedSections.length - 1}
          key={section.id}
          label={section.label}
          onMoveDown={() => reorderHomeSection(section.id, "down")}
          onMoveUp={() => reorderHomeSection(section.id, "up")}
          onValueChange={section.onValueChange}
          value={section.value}
        />
      ))}
    </ContentContainer>
  );
}
