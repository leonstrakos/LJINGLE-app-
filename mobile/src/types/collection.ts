export type EntityReferenceType = 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY';

export type RelationType =
  | 'RELATED'
  | 'INSPIRED_BY'
  | 'ABOUT'
  | 'REFERENCES'
  | 'ADAPTATION_OF'
  | 'REMEMBERED_WITH';

export type EntityReference = {
  entityType: EntityReferenceType;
  entityId: string;
  title: string;
  subtitle: string | null;
};

export type CollectionSummary = {
  collectionId: string;
  name: string;
  description: string | null;
  symbol: string | null;
  itemCount: number;
};

export type CollectionItem = {
  itemId: string;
  entityType: EntityReferenceType;
  entityId: string;
  title: string;
  subtitle: string | null;
  position: number;
  addedAt: string;
};

export type CollectionDetail = {
  collectionId: string;
  name: string;
  description: string | null;
  symbol: string | null;
  items: CollectionItem[];
};

export type CollectionRequest = {
  name: string;
  description?: string | null;
  symbol?: string | null;
};

export type EntityLink = {
  linkId: string;
  sourceType: EntityReferenceType;
  sourceId: string;
  targetType: EntityReferenceType;
  targetId: string;
  relationType: RelationType;
  note: string | null;
  source: EntityReference;
  target: EntityReference;
  createdAt: string;
};

export const entityTypeLabels: Record<EntityReferenceType, string> = {
  BOOK: 'Knjiga',
  MEDIA: 'Film / serija',
  GAME: 'Igra',
  TOPIC: 'Tema',
  ENTRY: 'Zapis',
};

export const relationTypeLabels: Record<RelationType, string> = {
  RELATED: 'Povezano',
  INSPIRED_BY: 'Inspirirano',
  ABOUT: 'Govori o',
  REFERENCES: 'Referenca',
  ADAPTATION_OF: 'Adaptacija',
  REMEMBERED_WITH: 'Pamtim uz',
};

export const relationTypes = Object.keys(relationTypeLabels) as RelationType[];
