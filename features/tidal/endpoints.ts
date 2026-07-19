// Typed TIDAL OpenAPI v2 endpoint helpers.
//
// Each helper takes an access token and returns the parsed JSON:API document.
// Paths and params follow the official spec (see docs/TIDAL_API.md). Country
// code defaults are applied by the client; pass one to override.

import { tidalRequest } from "@/features/tidal/client";
import type {
  JsonApiDocument,
  JsonApiResource,
  TidalAlbum,
  TidalArtist,
  TidalPlaylist,
  TidalTrack,
  TidalTrackManifest,
  TidalUser,
} from "@/features/tidal/types";

interface BaseArgs {
  accessToken: string;
  countryCode?: string;
  signal?: AbortSignal;
}

type Include = string[];

// --- Current user -----------------------------------------------------------

export const getCurrentUser = (
  args: BaseArgs
): Promise<JsonApiDocument<TidalUser>> =>
  tidalRequest("/users/me", {
    accessToken: args.accessToken,
    signal: args.signal,
  });

// --- Search -----------------------------------------------------------------

export interface SearchArgs extends BaseArgs {
  query: string;
  include?: Include;
  explicitFilter?: "INCLUDE" | "EXCLUDE";
}

// GET /searchResults/{query} — {query} is the URL-encoded search string.
export const search = (
  args: SearchArgs
): Promise<JsonApiDocument<JsonApiResource>> =>
  tidalRequest(`/searchResults/${encodeURIComponent(args.query)}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: {
      include: args.include ?? ["tracks", "albums", "artists", "playlists"],
      explicitFilter: args.explicitFilter,
    },
  });

// --- Catalog by id ----------------------------------------------------------

interface ByIdArgs extends BaseArgs {
  id: string;
  include?: Include;
}

export const getTrack = (
  args: ByIdArgs
): Promise<JsonApiDocument<TidalTrack>> =>
  tidalRequest(`/tracks/${args.id}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: { include: args.include },
  });

export const getAlbum = (
  args: ByIdArgs
): Promise<JsonApiDocument<TidalAlbum>> =>
  tidalRequest(`/albums/${args.id}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: { include: args.include },
  });

export const getArtist = (
  args: ByIdArgs
): Promise<JsonApiDocument<TidalArtist>> =>
  tidalRequest(`/artists/${args.id}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: { include: args.include },
  });

export const getPlaylist = (
  args: ByIdArgs
): Promise<JsonApiDocument<TidalPlaylist>> =>
  tidalRequest(`/playlists/${args.id}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: { include: args.include },
  });

// --- Relationships (paginated via page[cursor]) -----------------------------

interface RelationshipArgs extends BaseArgs {
  id: string;
  cursor?: string;
  include?: Include;
}

const relationship = (
  resource: string,
  relationshipName: string,
  args: RelationshipArgs
): Promise<JsonApiDocument<JsonApiResource[]>> =>
  tidalRequest(`/${resource}/${args.id}/relationships/${relationshipName}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: {
      include: args.include,
      "page[cursor]": args.cursor,
    },
  });

export const getAlbumItems = (
  args: RelationshipArgs
): Promise<JsonApiDocument<JsonApiResource[]>> =>
  relationship("albums", "items", {
    ...args,
    include: args.include ?? ["items"],
  });

export const getArtistAlbums = (
  args: RelationshipArgs
): Promise<JsonApiDocument<JsonApiResource[]>> =>
  relationship("artists", "albums", {
    ...args,
    include: args.include ?? ["albums"],
  });

export const getPlaylistItems = (
  args: RelationshipArgs
): Promise<JsonApiDocument<JsonApiResource[]>> =>
  relationship("playlists", "items", {
    ...args,
    include: args.include ?? ["items"],
  });

// --- User favorites / collection --------------------------------------------

// Collection resources use {id}=me and expose GET/POST/DELETE on items.
const collectionResource: Record<
  "tracks" | "albums" | "artists" | "playlists",
  string
> = {
  tracks: "userCollectionTracks",
  albums: "userCollectionAlbums",
  artists: "userCollectionArtists",
  playlists: "userCollectionPlaylists",
};

export interface FavoritesArgs extends BaseArgs {
  type: keyof typeof collectionResource;
  cursor?: string;
  include?: Include;
}

export const getFavorites = (
  args: FavoritesArgs
): Promise<JsonApiDocument<JsonApiResource[]>> =>
  tidalRequest(`/${collectionResource[args.type]}/me/relationships/items`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: {
      include: args.include ?? [args.type],
      "page[cursor]": args.cursor,
    },
  });

export interface MutateFavoriteArgs extends BaseArgs {
  type: keyof typeof collectionResource;
  ids: string[];
}

const favoriteItemsBody = (
  type: keyof typeof collectionResource,
  ids: string[]
) => ({
  data: ids.map((id) => ({ type, id })),
});

export const addFavorites = (args: MutateFavoriteArgs): Promise<unknown> =>
  tidalRequest(`/${collectionResource[args.type]}/me/relationships/items`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    method: "POST",
    body: favoriteItemsBody(args.type, args.ids),
  });

export const removeFavorites = (args: MutateFavoriteArgs): Promise<unknown> =>
  tidalRequest(`/${collectionResource[args.type]}/me/relationships/items`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    method: "DELETE",
    body: favoriteItemsBody(args.type, args.ids),
  });

// --- User playlists ---------------------------------------------------------

export const getMyPlaylists = (
  args: BaseArgs & { cursor?: string }
): Promise<JsonApiDocument<TidalPlaylist[]>> =>
  tidalRequest("/playlists", {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: {
      "filter[owners.id]": "me",
      "page[cursor]": args.cursor,
    },
  });

// --- Playback ---------------------------------------------------------------

export interface TrackManifestArgs extends BaseArgs {
  id: string;
  manifestType?: "HLS" | "MPEG_DASH";
  formats?: string[];
  uriScheme?: "HTTPS" | "DATA";
  usage?: "PLAYBACK" | "DOWNLOAD";
  adaptive?: boolean;
}

// GET /trackManifests/{id} — official streaming entry point. Returns a FULL
// manifest for entitled users, otherwise a PREVIEW manifest with a
// previewReason. Requires appropriate access (see docs/TIDAL_API.md).
export const getTrackManifest = (
  args: TrackManifestArgs
): Promise<JsonApiDocument<TidalTrackManifest>> =>
  tidalRequest(`/trackManifests/${args.id}`, {
    accessToken: args.accessToken,
    countryCode: args.countryCode,
    signal: args.signal,
    query: {
      manifestType: args.manifestType ?? "HLS",
      formats: args.formats ?? ["AACLC", "FLAC"],
      uriScheme: args.uriScheme ?? "HTTPS",
      usage: args.usage ?? "PLAYBACK",
      adaptive: args.adaptive ?? true,
    },
  });
