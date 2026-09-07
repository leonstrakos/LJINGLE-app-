import type { LjinglePortablePackage } from './portablePackage';
// ljinglePortalDirectSendTrueCapsuleR2:types

export type PortalVisibility = 'PRIVATE' | 'PORTAL';

// ljinglePortalCleanMineSharedEntriesR1
export type SocialEntityKind = 'BOOK' | 'MEDIA' | 'GAME';

export type SocialEntitySource = {
  isbn?: string | null;
  tmdbId?: number | null;
  mediaType?: 'MOVIE' | 'SERIES' | null;
  igdbId?: number | null;
  platform?: string | null;
};

export type SocialEntitySnapshot = {
  entityId: string;
  kind: SocialEntityKind;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  year: number | null;
  state: string | null;
  source: SocialEntitySource;
};

export type SocialCollectionSnapshot = {
  collectionId: string;
  name: string;
  description: string | null;
  symbol: string | null;
  items: SocialEntitySnapshot[];
  portablePackage?: LjinglePortablePackage | null;
};

export type SocialMemoryCapsuleImage = {
  fileName: string | null;
  mimeType: string | null;
  caption: string | null;
  position: number;
  dataUrl: string;
};

export type SocialMemoryCapsuleSnapshot = {
  capsuleId: string;
  title: string;
  description: string | null;
  openOn: string | null;
  sealedAt: string;
  backingPackage: LjinglePortablePackage;
  linkedPackages: LjinglePortablePackage[];
  images: SocialMemoryCapsuleImage[];
};

export type SocialEntrySnapshot = {
  entryId: string;
  type: 'NOTE' | 'QUOTE' | 'OBSERVATION' | 'REVIEW' | 'PROGRESS_UPDATE';
  title: string | null;
  content: string;
  createdAt: string;
};

export type SocialProfile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  discoverable: boolean;
  updatedAt: string;
  counts: {
    entities: number;
    books: number;
    media: number;
    games: number;
    collections: number;
    entries?: number;
  };
};

export type SocialSearchResult =
  | {
      kind: 'PERSON';
      key: string;
      profile: SocialProfile;
    }
  | {
      kind: 'REMOTE_ENTITY';
      key: string;
      owner: Pick<SocialProfile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
      entity: SocialEntitySnapshot;
    }
  | {
      kind: 'REMOTE_COLLECTION';
      key: string;
      owner: Pick<SocialProfile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
      collection: SocialCollectionSnapshot;
    }
  | {
      kind: 'REMOTE_ENTRY';
      key: string;
      owner: Pick<SocialProfile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
      entry: SocialEntrySnapshot;
    };

export type SocialCatalogue = {
  profile: SocialProfile;
  entities: SocialEntitySnapshot[];
  collections: SocialCollectionSnapshot[];
  entries?: SocialEntrySnapshot[];
};

export type ReceivedJingle = {
  id: string;
  sender: Pick<SocialProfile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
  entity: SocialEntitySnapshot | SocialCollectionSnapshot | SocialMemoryCapsuleSnapshot;
  entityType: SocialEntityKind | 'COLLECTION' | 'CAPSULE';
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
  createdAt: string;
};

export type PortalShareCandidate = {
  kind: SocialEntityKind | 'COLLECTION' | 'ENTRY' | 'CAPSULE';
  id: string;
  title: string;
  subtitle: string | null;
  visible: boolean;
};
