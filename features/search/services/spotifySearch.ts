import type { SpotifySearchResults } from "@/shared/types/spotify";
import { log, logError } from "@/shared/utils/logger";

export const searchItems = async (
	query: string,
	types: string[],
	accessToken: string | null,
	ensureValidToken?: () => Promise<string | null>
): Promise<SpotifySearchResults | null> => {
	if (!query.trim()) return null;

	let validToken = accessToken;
	if (ensureValidToken) {
		const refreshedToken = await ensureValidToken();
		if (refreshedToken) {
			validToken = refreshedToken;
		}
	}

	if (!validToken) return null;

	const typeString = types.join(",");
	const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
		query
	)}&type=${encodeURIComponent(typeString)}&limit=10`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${validToken}` },
		});
		if (!response.ok) {
			if (response.status === 401) {
				log("Search: Token expired");
			}
			return null;
		}
		return await response.json();
	} catch (error) {
		logError("Search: Search error:", error);
		return null;
	}
};
