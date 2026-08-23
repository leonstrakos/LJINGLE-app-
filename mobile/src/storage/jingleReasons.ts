// jingleReasonBindFixV2
import { getDatabase } from './database';

export type JingleReasonEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME';

export type JingleReason = {
  entityType: JingleReasonEntityType;
  entityId: string;
  reason: string;
  createdAt: string;
  modifiedAt: string;
};

let schemaPromise:
  Promise<void> | null = null;

async function ensureJingleReasonSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const database =
        await getDatabase();

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS jingle_reasons (
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL,
          modified_at TEXT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        );

        CREATE INDEX IF NOT EXISTS
          idx_jingle_reasons_entity
          ON jingle_reasons(entity_type, entity_id);
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

/**
 * jingleReasonStorageV1
 *
 * Uses the canonical getDatabase() connection.
 *
 * NEVER open SQLite from this module.
 */
export async function getJingleReason(
  entityType: JingleReasonEntityType,
  entityId: string,
) {
  await ensureJingleReasonSchema();

  const database =
    await getDatabase();

  const row =
    await database.getFirstAsync<{
      reason: string;
      created_at: string;
      modified_at: string;
    }>(
      `
        SELECT
          reason,
          created_at,
          modified_at
        FROM jingle_reasons
        WHERE entity_type = ?
          AND entity_id = ?
        LIMIT 1
      `,
      entityType,
      entityId,
    );

  if (!row) {
    return null;
  }

  return {
    entityType,
    entityId,
    reason: row.reason,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  } satisfies JingleReason;
}

export async function setJingleReason(
  entityType: JingleReasonEntityType,
  entityId: string,
  reasonRaw: string,
) {
  await ensureJingleReasonSchema();

  const database =
    await getDatabase();

  const reason =
    reasonRaw.trim();

  if (!reason) {
    await database.runAsync(
      `
        DELETE FROM jingle_reasons
        WHERE entity_type = ?
          AND entity_id = ?
      `,
      entityType,
      entityId,
    );

    return null;
  }

  const now =
    new Date().toISOString();

  await database.runAsync(
    `
      INSERT INTO jingle_reasons (
        entity_type,
        entity_id,
        reason,
        created_at,
        modified_at
      )
      VALUES (?, ?, ?, ?, ?)

      ON CONFLICT(entity_type, entity_id)
      DO UPDATE SET
        reason = excluded.reason,
        modified_at = excluded.modified_at
    `,
    entityType,
    entityId,
    reason,
    now,
    now,
  );

  return getJingleReason(
    entityType,
    entityId,
  );
}

export async function deleteJingleReason(
  entityType: JingleReasonEntityType,
  entityId: string,
) {
  await ensureJingleReasonSchema();

  const database =
    await getDatabase();

  await database.runAsync(
    `
      DELETE FROM jingle_reasons
      WHERE entity_type = ?
        AND entity_id = ?
    `,
    entityType,
      entityId,
  );
}
