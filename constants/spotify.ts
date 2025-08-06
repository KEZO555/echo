export const SPOTIFY_CLIENT_ID = "2f20bc972e764706956ba7b59648b707";

export const SPOTIFY_SCOPES = [
    "user-read-email",
    "user-library-read",
    "user-library-modify",
    "user-read-recently-played",
    "user-top-read",
    "user-follow-read",
    "user-follow-modify",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-modify-playback-state",
    "user-read-playback-state",
    "streaming",
];

export const REDIRECT_URI = "spotify-light://callback";

export const TOKEN_SWAP_URL = "https://spotifylightrefresh.netlify.app/swap";
export const TOKEN_REFRESH_URL =
    "https://spotifylightrefresh.netlify.app/refresh";

// Storage Keys
export const AUTH_TOKEN_KEY = "spotifyAuthToken";
export const REFRESH_TOKEN_KEY = "spotifyRefreshToken";
export const USER_INFO_KEY = "spotifyUserInfo";
export const TOKEN_EXPIRY_KEY = "spotifyTokenExpiry";
export const PLAYLISTS_KEY = "spotifyPlaylists";
export const ALBUMS_KEY = "spotifyAlbums";
export const ARTISTS_KEY = "spotifyArtists";
export const SAVED_TRACKS_KEY = "spotifySavedTracks";
export const ALBUM_DETAIL_KEY_PREFIX = "spotifyAlbumDetail_";
