// collectionBigBoxesV1
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';

// ljingleCurrentTsErrorsFixR1: Expo SQLite transaction compatibility
type BigBoxDatabase = Awaited<ReturnType<typeof getDatabase>>;

async function writeBigBoxAtomically(
  database: BigBoxDatabase,
  task: (transaction: BigBoxDatabase) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await task(database);
    return;
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await task(transaction);
  });
}

export type CollectionBigBox = {
  bigBoxId: string;
  name: string;
  symbol: string;
  position: number;
  collectionIds: string[];
};

export type CollectionBigBoxInput = {
  name: string;
  symbol?: string | null;
  collectionIds?: string[];
};

type BoxRow = {
  box_id: string;
  name: string;
  symbol: string | null;
  position: number;
};

type MemberRow = {
  box_id: string;
  collection_id: string;
  position: number;
};

function requiredName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Naziv Big Boxa je obavezan.');
  return trimmed;
}

function normalizeSymbol(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  return trimmed ? Array.from(trimmed).slice(0, 2).join('') : '▣';
}

function uniqueIds(ids: string[] | undefined) {
  return [...new Set((ids || []).map((id) => id.trim()).filter(Boolean))];
}

function id() {
  return (
    'bigbox-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 9)
  );
}

async function rowsToBoxes(
  boxRows: BoxRow[],
  memberRows: MemberRow[],
): Promise<CollectionBigBox[]> {
  const members = new Map<string, string[]>();

  for (const row of memberRows) {
    const list = members.get(row.box_id) || [];
    list.push(row.collection_id);
    members.set(row.box_id, list);
  }

  return boxRows.map((row) => ({
    bigBoxId: row.box_id,
    name: row.name,
    symbol: normalizeSymbol(row.symbol),
    position: Number(row.position || 0),
    collectionIds: members.get(row.box_id) || [],
  }));
}

export async function getCollectionBigBoxes() {
  const database = await getDatabase();
  const [boxes, members] = await Promise.all([
    database.getAllAsync<BoxRow>(
      `SELECT box_id, name, symbol, position
         FROM collection_big_boxes
        ORDER BY position, created_at, name COLLATE NOCASE`,
    ),
    database.getAllAsync<MemberRow>(
      `SELECT box_id, collection_id, position
         FROM collection_big_box_items
        ORDER BY box_id, position, created_at`,
    ),
  ]);

  return rowsToBoxes(boxes, members);
}

async function rewriteMembers(
  database: Awaited<ReturnType<typeof getDatabase>>,
  boxId: string,
  collectionIds: string[],
  now: string,
) {
  const ids = uniqueIds(collectionIds);

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM collection_big_box_items
        WHERE collection_id IN (${placeholders})`,
      ...ids,
    );
  }

  await database.runAsync(
    'DELETE FROM collection_big_box_items WHERE box_id=?',
    boxId,
  );

  for (let index = 0; index < ids.length; index += 1) {
    await database.runAsync(
      `INSERT INTO collection_big_box_items
        (box_id, collection_id, position, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      boxId,
      ids[index]!,
      index,
      now,
      now,
    );
  }
}

export async function createCollectionBigBox(
  input: CollectionBigBoxInput,
) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const boxId = id();

  await writeBigBoxAtomically(database, async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO collection_big_boxes
        (box_id, name, symbol, position, created_at, modified_at)
       VALUES (
         ?, ?, ?,
         (SELECT COALESCE(MAX(position) + 1, 0) FROM collection_big_boxes),
         ?, ?
       )`,
      boxId,
      requiredName(input.name),
      normalizeSymbol(input.symbol),
      now,
      now,
    );

    await rewriteMembers(
      database,
      boxId,
      input.collectionIds || [],
      now,
    );
  });

  return getCollectionBigBoxes();
}

export async function updateCollectionBigBox(
  boxId: string,
  input: CollectionBigBoxInput,
) {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await writeBigBoxAtomically(database, async (transaction) => {
    await transaction.runAsync(
      `UPDATE collection_big_boxes
          SET name=?, symbol=?, modified_at=?
        WHERE box_id=?`,
      requiredName(input.name),
      normalizeSymbol(input.symbol),
      now,
      boxId,
    );

    await rewriteMembers(
      database,
      boxId,
      input.collectionIds || [],
      now,
    );
  });

  return getCollectionBigBoxes();
}

export async function deleteCollectionBigBox(boxId: string) {
  const database = await getDatabase();
  await database.runAsync(
    'DELETE FROM collection_big_boxes WHERE box_id=?',
    boxId,
  );
  return getCollectionBigBoxes();
}

export async function moveCollectionToBigBox(
  collectionId: string,
  boxId: string,
) {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await writeBigBoxAtomically(database, async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM collection_big_box_items WHERE collection_id=?',
      collectionId,
    );

    const positionRow = await transaction.getFirstAsync<{ next_position: number }>(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next_position
         FROM collection_big_box_items
        WHERE box_id=?`,
      boxId,
    );

    await transaction.runAsync(
      `INSERT INTO collection_big_box_items
        (box_id, collection_id, position, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      boxId,
      collectionId,
      Number(positionRow?.next_position || 0),
      now,
      now,
    );
  });

  return getCollectionBigBoxes();
}

export async function reorderCollectionBigBox(
  boxId: string,
  collectionIds: string[],
) {
  const database = await getDatabase();
  const ids = uniqueIds(collectionIds);
  const current = await database.getAllAsync<{ collection_id: string }>(
    `SELECT collection_id
       FROM collection_big_box_items
      WHERE box_id=?
      ORDER BY position, created_at`,
    boxId,
  );

  const currentIds = current.map((row) => row.collection_id);
  if (
    currentIds.length !== ids.length ||
    currentIds.some((value) => !ids.includes(value))
  ) {
    throw new Error(
      'Big Box se promijenio tijekom uređivanja. Osvježi i pokušaj ponovno.',
    );
  }

  const now = new Date().toISOString();
  await writeBigBoxAtomically(database, async (transaction) => {
    for (let index = 0; index < ids.length; index += 1) {
      await transaction.runAsync(
        `UPDATE collection_big_box_items
            SET position=?, modified_at=?
          WHERE box_id=? AND collection_id=?`,
        index,
        now,
        boxId,
        ids[index]!,
      );
    }
  });

  return getCollectionBigBoxes();
}
