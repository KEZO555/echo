// Spotify API Types
export interface SpotifyImage {
    url: string;
    height?: number;
    width?: number;
}

export interface SpotifyFollowers {
    href?: string;
    total: number;
}

export interface SpotifyPlaylistOwner {
    display_name?: string;
    id: string;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string | null;
    images: SpotifyImage[];
    owner: SpotifyPlaylistOwner;
    tracks: {
        href: string;
        total: number;
    };
    public?: boolean;
    collaborative: boolean;
    uri: string;
    href: string;
}

export interface SpotifyPlaylistsResponse {
    href: string;
    items: SpotifyPlaylist[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Albums
export interface SpotifyArtistSimple {
    external_urls: { spotify: string };
    href: string;
    id: string;
    name: string;
    type: string;
    uri: string;
}

export interface SpotifyAlbum {
    album_type: string;
    total_tracks: number;
    available_markets: string[];
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: string;
    type: string;
    uri: string;
    artists: SpotifyArtistSimple[];
    tracks?: SpotifyAlbumTracks;
}

export interface SpotifyArtist {
    external_urls: string;
    followers: SpotifyFollowers;
    genres: string[];
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    popularity: number;
    type: string;
    uri: string;
}

export interface SpotifyArtists {
    href: string;
    limit: number;
    next: string | null;
    cursors: Cursor;
    total: number;
    items: SpotifyArtist[];
}

export interface Cursor {
    after: string;
    before: string;
}

export interface SpotifyFollowedArtistsResponse {
    artists: SpotifyArtists;
}

export interface SpotifyAlbumTracks {
    href: string;
    items: SpotifyTrackSimple[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    uri: string;
}

export interface SpotifyTrackSimple {
    artists: SpotifyArtistSimple[];
    available_markets: string[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    external_urls: { spotify: string };
    href: string;
    id: string;
    is_local: boolean;
    name: string;
    preview_url: string | null;
    track_number: number;
    type: string;
    uri: string;
    album?: SpotifyAlbum;
    isEpisode?: boolean;
}

export interface SpotifySavedAlbum {
    added_at: string;
    album: SpotifyAlbum;
}

export interface SpotifySavedAlbumsResponse {
    href: string;
    items: SpotifySavedAlbum[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export interface SpotifyArtistAlbumsResponse {
    href: string;
    items: SpotifyAlbumSimple[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export interface SavedTrackObject {
    added_at: string;
    track: SpotifyTrackSimple;
}

export interface SavedTracksResponse {
    href: string;
    items: SavedTrackObject[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Podcasts
export interface SpotifyShow {
    id: string;
    name: string;
    description: string;
    html_description?: string;
    publisher: string;
    images: SpotifyImage[];
    total_episodes: number;
    uri: string;
    href: string;
    media_type: string;
    explicit: boolean;
    type: string;
    languages: string[];
    episodes?: SpotifyShowEpisodes;
}

export interface SpotifyEpisode {
    id: string;
    name: string;
    description: string;
    html_description?: string;
    duration_ms: number;
    release_date: string;
    release_date_precision: string;
    uri: string;
    href: string;
    type: string;
    images: SpotifyImage[];
    explicit: boolean;
    is_externally_hosted: boolean;
    is_playable: boolean;
    language?: string;
    languages?: string[];
    resume_point?: {
        fully_played: boolean;
        resume_position_ms: number;
    };
    show?: SpotifyShow;
    isEpisode?: boolean;
}

export interface SpotifyShowEpisodes {
    href: string;
    items: SpotifyEpisode[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export interface SpotifySavedShow {
    added_at: string;
    show: SpotifyShow;
}

export interface SpotifySavedShowsResponse {
    href: string;
    items: SpotifySavedShow[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

export interface SpotifySavedEpisode {
    added_at: string;
    episode: SpotifyEpisode;
}

export interface SpotifySavedEpisodesResponse {
    href: string;
    items: SpotifySavedEpisode[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Player / Devices
export interface SpotifyDevice {
    id: string | null;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number | null;
    supports_volume: boolean;
    uri: string;
}

export interface SpotifyDevicesResponse {
    devices: SpotifyDevice[];
}

export interface SpotifyRepeatState {
    state: "off" | "track" | "context";
}

export interface SpotifyCurrentlyPlaying {
    timestamp: number;
    context: SpotifyPlaybackContext | null;
    progress_ms: number | null;
    is_playing: boolean;
    item: SpotifyTrackSimple | SpotifyEpisode | null;
    currently_playing_type: "track" | "episode" | "ad" | "unknown";
    actions: { disallows: Record<string, boolean> };
    device: SpotifyDevice;
    shuffle_state: boolean;
    repeat_state: SpotifyRepeatState["state"];
}

export interface SpotifyPlaybackContext {
    type: "album" | "artist" | "playlist" | "show";
    href: string;
    external_urls: { spotify: string };
    uri: string;
}

// Spotify API Types - Search
export interface SpotifyAlbumSimple {
    album_type: string;
    total_tracks: number;
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: string;
    type: "album";
    uri: string;
    artists: SpotifyArtistSimple[];
}

export interface SpotifyTrack {
    album: SpotifyAlbumSimple;
    artists: SpotifyArtistSimple[];
    available_markets: string[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    external_ids: { isrc?: string; ean?: string; upc?: string };
    external_urls: { spotify: string };
    href: string;
    id: string;
    is_local: boolean;
    name: string;
    popularity: number;
    preview_url: string | null;
    track_number: number;
    type: "track";
    uri: string;
}

export interface SpotifyPlaylistSimple {
    collaborative: boolean;
    description: string | null;
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    owner: SpotifyPlaylistOwner;
    public: boolean | null;
    snapshot_id: string;
    tracks: {
        href: string;
        total: number;
    };
    type: "playlist";
    uri: string;
}

export interface SpotifySearchResults {
    tracks?: {
        href: string;
        items: SpotifyTrack[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
    albums?: {
        href: string;
        items: SpotifyAlbumSimple[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
    artists?: {
        href: string;
        items: SpotifyArtist[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
    playlists?: {
        href: string;
        items: SpotifyPlaylistSimple[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
    shows?: {
        href: string;
        items: SpotifyShow[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
}

