// memoryCapsuleBoxedV1
export type MemoryCapsule = {
  capsuleId: string;
  backingCollectionId: string;
  title: string;
  description: string | null;
  openOn: string | null;
  // ljingleMemoryCapsuleTrueSealR8:types
  sealedAt: string | null;
  openedAt: string | null;
  createdAt: string;
  modifiedAt: string;
  itemCount: number;
  imageCount: number;
  collectionCount: number;
};

export type MemoryCapsuleImage = {
  imageId: string;
  capsuleId: string;
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  caption: string | null;
  position: number;
  createdAt: string;
};

export type MemoryCapsuleCollection = {
  collectionId: string;
  name: string;
  description: string | null;
  symbol: string | null;
  itemCount: number;
  position: number;
};

export type MemoryCapsuleDetail = MemoryCapsule & {
  images: MemoryCapsuleImage[];
  collections: MemoryCapsuleCollection[];
};

export type MemoryCapsuleInput = {
  title: string;
  description?: string | null;
  openOn?: string | null;
};
