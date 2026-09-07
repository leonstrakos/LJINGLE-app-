// ljinglePortalDirectSendTrueCapsuleR2:service
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { bookApi } from './bookApi';
import { collectionApi } from './collectionApi';
import { mediaApi } from './mediaApi';
import { gameApi } from '../games/services/gameApi';
import { getDatabase } from '../storage/database';
import {
  addCollectionToMemoryCapsule,
  createMemoryCapsule,
  deleteMemoryCapsule,
  getMemoryCapsule,
  isMemoryCapsuleLocked,
  markMemoryCapsuleOpened,
  sealMemoryCapsule,
} from './memoryCapsules';
import {
  buildPortableCollectionPackage,
  inspectPortablePackage,
} from './portableExport';
import { importPortablePackage } from './portableImport';
import {
  importSocialCollection,
  snapshotBook,
  snapshotCollectionById,
  snapshotGame,
  snapshotMedia,
} from './socialProjection';
import type {
  PortalShareCandidate,
  SocialCollectionSnapshot,
  SocialMemoryCapsuleImage,
  SocialMemoryCapsuleSnapshot,
} from '../types/social';

const MAX_DIRECT_JSON_CHARS = 4_200_000;
const CAPSULE_IMAGE_DIRECTORY = 'memory-capsule-images';

type DirectPayload =
  | {
      entityType: 'BOOK' | 'MEDIA' | 'GAME';
      entity: ReturnType<typeof snapshotBook>;
    }
  | {
      entityType: 'COLLECTION';
      entity: SocialCollectionSnapshot;
    }
  | {
      entityType: 'CAPSULE';
      entity: SocialMemoryCapsuleSnapshot;
    };

function id(prefix: string) {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function assertTransportSize(value: unknown) {
  const length = JSON.stringify(value).length;
  if (length > MAX_DIRECT_JSON_CHARS) {
    throw new Error(
      'Ova pošiljka je prevelika za direct Jingle (' +
        Math.ceil(length / 1024 / 1024) +
        ' MB JSON). Smanji slike ili sadržaj kapsule.',
    );
  }
}

function mimeFor(fileName: string | null, mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return mimeType;
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Slika se nije mogla učitati.'));
    reader.readAsDataURL(blob);
  });
}

async function imageToTransport(image: {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  caption: string | null;
  position: number;
}): Promise<SocialMemoryCapsuleImage> {
  let dataUrl = image.uri;
  if (!dataUrl.startsWith('data:image/')) {
    if (Platform.OS === 'web') {
      const response = await fetch(image.uri);
      if (!response.ok) throw new Error('Slika kapsule se nije mogla učitati.');
      dataUrl = await blobToDataUrl(await response.blob());
    } else {
      const base64 = await FileSystem.readAsStringAsync(image.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      dataUrl =
        'data:' +
        mimeFor(image.fileName, image.mimeType) +
        ';base64,' +
        base64;
    }
  }
  return {
    fileName: image.fileName,
    mimeType: image.mimeType,
    caption: image.caption,
    position: image.position,
    dataUrl,
  };
}

export function isSocialMemoryCapsuleSnapshot(
  value: unknown,
): value is SocialMemoryCapsuleSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SocialMemoryCapsuleSnapshot>;
  return (
    typeof item.title === 'string' &&
    typeof item.sealedAt === 'string' &&
    Boolean(item.backingPackage) &&
    Array.isArray(item.linkedPackages) &&
    Array.isArray(item.images)
  );
}

export function isSocialMemoryCapsuleLocked(
  value: unknown,
  now = new Date(),
) {
  if (!isSocialMemoryCapsuleSnapshot(value) || !value.openOn) return false;
  const localToday =
    String(now.getFullYear()).padStart(4, '0') +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0');
  return value.openOn > localToday;
}

export function directJingleTitle(entity: unknown) {
  if (!entity || typeof entity !== 'object') return 'Jingle';
  if ('name' in entity && typeof entity.name === 'string') return entity.name;
  if ('title' in entity && typeof entity.title === 'string') return entity.title;
  return 'Jingle';
}

export function hasPortableCollectionPackage(
  value: unknown,
): value is SocialCollectionSnapshot & { portablePackage: NonNullable<SocialCollectionSnapshot['portablePackage']> } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'portablePackage' in value &&
      (value as SocialCollectionSnapshot).portablePackage,
  );
}

export async function buildDirectPayloadForCandidate(
  candidate: PortalShareCandidate,
): Promise<DirectPayload> {
  if (candidate.kind === 'CAPSULE') {
    const capsule = await getMemoryCapsule(candidate.id);
    if (!capsule.sealedAt) {
      throw new Error('Prvo zapečati Memory Capsule pa je onda pošalji.');
    }
    const [backingPackage, linkedPackages, images] = await Promise.all([
      buildPortableCollectionPackage(capsule.backingCollectionId),
      Promise.all(
        capsule.collections.map((collection) =>
          buildPortableCollectionPackage(collection.collectionId),
        ),
      ),
      Promise.all(capsule.images.map(imageToTransport)),
    ]);
    const entity: SocialMemoryCapsuleSnapshot = {
      capsuleId: capsule.capsuleId,
      title: capsule.title,
      description: capsule.description,
      openOn: capsule.openOn,
      sealedAt: capsule.sealedAt,
      backingPackage,
      linkedPackages,
      images,
    };
    assertTransportSize(entity);
    return { entityType: 'CAPSULE', entity };
  }

  if (candidate.kind === 'COLLECTION') {
    const [legacy, portablePackage] = await Promise.all([
      snapshotCollectionById(candidate.id),
      buildPortableCollectionPackage(candidate.id),
    ]);
    const entity: SocialCollectionSnapshot = {
      ...legacy,
      portablePackage,
    };
    assertTransportSize(entity);
    return { entityType: 'COLLECTION', entity };
  }

  if (candidate.kind === 'BOOK') {
    const item = (await bookApi.getAll()).find((book) => book.bookId === candidate.id);
    if (!item) throw new Error('Knjiga više ne postoji.');
    return { entityType: 'BOOK', entity: snapshotBook(item) };
  }

  if (candidate.kind === 'MEDIA') {
    const item = (await mediaApi.getAll()).find((media) => media.mediaId === candidate.id);
    if (!item) throw new Error('Film / serija više ne postoji.');
    return { entityType: 'MEDIA', entity: snapshotMedia(item) };
  }

  if (candidate.kind === 'GAME') {
    const item = (await gameApi.getAll()).find((game) => game.gameId === candidate.id);
    if (!item) throw new Error('Igra više ne postoji.');
    return { entityType: 'GAME', entity: snapshotGame(item) };
  }

  throw new Error('Direct send za ovaj tip još nije omogućen.');
}

export async function importDirectSocialCollection(
  snapshot: SocialCollectionSnapshot,
) {
  if (!snapshot.portablePackage) return importSocialCollection(snapshot);
  inspectPortablePackage(JSON.stringify(snapshot.portablePackage));
  return importPortablePackage(snapshot.portablePackage);
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) throw new Error('Primljena slika kapsule nije valjani image data URL.');
  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64) {
    throw new Error('Primljena slika kapsule nema MIME/base64 payload.');
  }
  return { mimeType, base64: base64.replace(/\s+/g, '') };
}

function extensionForMime(mimeType: string) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/heic') return '.heic';
  if (mimeType === 'image/heif') return '.heif';
  return '.jpg';
}

async function persistReceivedCapsuleImage(
  capsuleId: string,
  image: SocialMemoryCapsuleImage,
) {
  const parsed = parseImageDataUrl(image.dataUrl);
  let uri = image.dataUrl;
  if (Platform.OS !== 'web') {
    if (!FileSystem.documentDirectory) throw new Error('Lokalna mapa aplikacije nije dostupna.');
    const directory = FileSystem.documentDirectory + CAPSULE_IMAGE_DIRECTORY + '/';
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    uri = directory + id('capsule-received') + extensionForMime(parsed.mimeType);
    await FileSystem.writeAsStringAsync(uri, parsed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  const database = await getDatabase();
  const now = new Date().toISOString();
  try {
    await database.runAsync(
      'INSERT INTO memory_capsule_images ' +
        '(image_id, capsule_id, uri, file_name, mime_type, ' +
        'caption, position, created_at, modified_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id('capsule-img-row'),
      capsuleId,
      uri,
      image.fileName,
      image.mimeType || parsed.mimeType,
      image.caption,
      image.position,
      now,
      now,
    );
  } catch (error) {
    if (Platform.OS !== 'web' && uri !== image.dataUrl) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function importSocialMemoryCapsule(
  snapshot: SocialMemoryCapsuleSnapshot,
) {
  if (!isSocialMemoryCapsuleSnapshot(snapshot)) throw new Error('Primljena Memory Capsule nije valjana.');
  inspectPortablePackage(JSON.stringify(snapshot.backingPackage));
  for (const pack of snapshot.linkedPackages) inspectPortablePackage(JSON.stringify(pack));

  const created = await createMemoryCapsule({
    title: snapshot.title,
    description: snapshot.description,
    openOn: snapshot.openOn,
  });

  try {
    const beforeCollections = new Set(
      (await collectionApi.getAll()).map((collection) => collection.collectionId),
    );
    const backingResult = await importPortablePackage(snapshot.backingPackage);
    if (!backingResult.collectionId) throw new Error('Backing Memory Box nije uvezen.');
    const importedBacking = await collectionApi.getById(backingResult.collectionId);
    for (const item of importedBacking.items) {
      await collectionApi.addItem(
        created.backingCollectionId,
        item.entityType,
        item.entityId,
      );
    }
    if (!beforeCollections.has(backingResult.collectionId)) {
      await collectionApi.remove(backingResult.collectionId);
    }

    for (const image of snapshot.images) {
      await persistReceivedCapsuleImage(created.capsuleId, image);
    }

    for (const pack of snapshot.linkedPackages) {
      const linked = await importPortablePackage(pack);
      if (linked.collectionId) {
        await addCollectionToMemoryCapsule(created.capsuleId, linked.collectionId);
      }
    }

    let sealed = await sealMemoryCapsule(created.capsuleId);
    if (!isMemoryCapsuleLocked(sealed)) {
      sealed = await markMemoryCapsuleOpened(created.capsuleId);
    }
    return sealed;
  } catch (error) {
    await deleteMemoryCapsule(created.capsuleId).catch(() => undefined);
    throw error;
  }
}
