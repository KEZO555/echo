export const formatDuration = (ms: number, includeHours = false): string => {
	const totalSeconds = Math.floor(ms / 1000);

	if (includeHours) {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		const parts: string[] = [];
		if (hours > 0) {
			parts.push(`${hours}h`);
		}
		if (minutes > 0) {
			parts.push(`${minutes}m`);
		}
		if (seconds > 0 || totalSeconds === 0) {
			parts.push(`${seconds}s`);
		}

		return parts.join(" ");
	}

	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export const getArtistNames = (artists: { name: string }[]): string => {
	return artists.map((artist) => artist.name).join(", ");
};
