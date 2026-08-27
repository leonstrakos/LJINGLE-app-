export type PortableEntityKind =
  | 'ENTRY'
  | 'FREQUENCY'
  | 'COLLECTION'
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC';

export type PortableAsset = {
  assetId: string;
  kind: 'IMAGE' | 'AUDIO';
  name: string;
  mimeType: string | null;
  byteLength: number | null;
  base64: string | null;
};

export type PortableObject = {
  portableId: string;
  entityType: PortableEntityKind;
  sourceId: string;
  title: string;
  subtitle: string | null;
  jingle: boolean;
  data: Record<string, unknown>;
  assetIds: string[];

  // V2: stable identity survives repeated exports/imports.
  originId?: string | null;
};

export type PortableRelationship = {
  sourcePortableId: string;
  targetPortableId: string;
  relationType: string;
  note: string | null;
};

export type PortableProvenance = {
  sourceApp: 'LJingle';
  sourceKind: 'LOCAL_ARCHIVE';
  exportedAt: string;
  graphModel: 'DIRECTED_V1';
};

export type PortableVisualManifest = {
  style: 'ARCHIVE_CARD_V1';
  objectCount: number;
  relationshipCount: number;
  imageCount: number;
  audioCount: number;
  senderJingleCount: number;
};

export type LjinglePortablePackage = {
  format: 'ljingle';

  // V1 remains readable. New exports are V2.
  version: 1;

  packageId: string;
  createdAt: string;
  rootPortableId: string;
  title: string;
  kind: PortableEntityKind;
  objects: PortableObject[];
  relationships: PortableRelationship[];
  assets: PortableAsset[];

  provenance?: PortableProvenance;
  visual?: PortableVisualManifest;
};
