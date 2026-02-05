import { Redirect, useLocalSearchParams } from "expo-router";

export default function RenamePlaylistRedirect() {
  const { playlistId, currentName } = useLocalSearchParams<{
    playlistId: string;
    currentName: string;
  }>();

  return (
    <Redirect
      href={{
        pathname: "/create-playlist",
        params: { mode: "rename", playlistId, currentName },
      }}
    />
  );
}
