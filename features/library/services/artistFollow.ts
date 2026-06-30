import { apiDelete, apiGet, apiPut } from "@/shared/utils/api-client";

const FOLLOWING_BASE = "https://api.spotify.com/v1/me/following";

export const followArtist = (artistId: string): Promise<boolean> =>
  apiPut(`${FOLLOWING_BASE}?type=artist&ids=${artistId}`);

export const unfollowArtist = (artistId: string): Promise<boolean> =>
  apiDelete(`${FOLLOWING_BASE}?type=artist&ids=${artistId}`);

export const checkIfFollowingArtist = async (
  artistId: string
): Promise<boolean> => {
  const data = await apiGet<boolean[]>(
    `${FOLLOWING_BASE}/contains?type=artist&ids=${artistId}`
  );
  return data ? (data[0] ?? false) : false;
};
