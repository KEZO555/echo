// JSON:API primitives and TIDAL resource attribute shapes.
//
// TIDAL's OpenAPI v2 returns JSON:API documents (data / attributes /
// relationships / included / links). The attribute shapes below cover the
// fields Tide uses; they intentionally allow unknown extras via index
// signatures so forward-compatible fields don't require type churn.

export interface JsonApiResourceIdentifier {
  id: string;
  type: string;
}

export interface JsonApiLinks {
  self?: string;
  next?: string;
  [key: string]: string | undefined;
}

export interface JsonApiRelationship {
  data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  links?: JsonApiLinks;
}

export interface JsonApiResource<TAttributes = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: TAttributes;
  relationships?: Record<string, JsonApiRelationship>;
}

export interface JsonApiDocument<TData> {
  data: TData;
  included?: JsonApiResource[];
  links?: JsonApiLinks;
}

// An image/artwork link as returned in resource attributes (imageLinks etc.).
export interface TidalImageLink {
  href: string;
  meta?: { width?: number; height?: number };
}

export interface TidalExternalLink {
  href: string;
  meta?: { type?: string };
}

export interface TidalUserAttributes {
  username?: string;
  country?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface TidalArtistAttributes {
  name: string;
  popularity?: number;
  imageLinks?: TidalImageLink[];
  externalLinks?: TidalExternalLink[];
  [key: string]: unknown;
}

export interface TidalAlbumAttributes {
  title: string;
  barcodeId?: string;
  numberOfVolumes?: number;
  numberOfItems?: number;
  duration?: string;
  releaseDate?: string;
  copyright?: string;
  explicit?: boolean;
  popularity?: number;
  availability?: string[];
  mediaTags?: string[];
  imageLinks?: TidalImageLink[];
  externalLinks?: TidalExternalLink[];
  [key: string]: unknown;
}

export interface TidalTrackAttributes {
  title: string;
  version?: string;
  isrc?: string;
  duration?: string;
  copyright?: string;
  explicit?: boolean;
  popularity?: number;
  availability?: string[];
  mediaTags?: string[];
  imageLinks?: TidalImageLink[];
  externalLinks?: TidalExternalLink[];
  [key: string]: unknown;
}

export interface TidalPlaylistAttributes {
  name: string;
  description?: string;
  duration?: string;
  numberOfItems?: number;
  privacy?: string;
  playlistType?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  imageLinks?: TidalImageLink[];
  externalLinks?: TidalExternalLink[];
  [key: string]: unknown;
}

// GET /trackManifests/{id}
export type TidalManifestType = "HLS" | "MPEG_DASH";
export type TidalAudioFormat =
  | "HEAACV1"
  | "AACLC"
  | "FLAC"
  | "FLAC_HIRES"
  | "EAC3_JOC";
export type TidalTrackPresentation = "FULL" | "PREVIEW";
export type TidalPreviewReason =
  | "FULL_REQUIRES_SUBSCRIPTION"
  | "FULL_REQUIRES_PURCHASE"
  | "FULL_REQUIRES_HIGHER_ACCESS_TIER";

export interface TidalTrackManifestAttributes {
  // The manifest URI: an HTTPS URL, or an inline data: URI when uriScheme=DATA.
  uri: string;
  formats?: TidalAudioFormat[];
  hash?: string;
  drmData?: unknown;
  trackPresentation?: TidalTrackPresentation;
  previewReason?: TidalPreviewReason;
  albumAudioNormalizationData?: unknown;
  trackAudioNormalizationData?: unknown;
  [key: string]: unknown;
}

export type TidalUser = JsonApiResource<TidalUserAttributes>;
export type TidalArtist = JsonApiResource<TidalArtistAttributes>;
export type TidalAlbum = JsonApiResource<TidalAlbumAttributes>;
export type TidalTrack = JsonApiResource<TidalTrackAttributes>;
export type TidalPlaylist = JsonApiResource<TidalPlaylistAttributes>;
export type TidalTrackManifest = JsonApiResource<TidalTrackManifestAttributes>;
