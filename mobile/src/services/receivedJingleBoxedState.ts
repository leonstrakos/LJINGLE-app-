// receivedJingleBoxedStateR4
import { getDatabase } from '../storage/database';

type Row = {
  jingle_id: string;
  opened_at: string;
};

async function databaseWithBoxedState() {
  const database = await getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS received_jingle_boxed_opened (
      jingle_id TEXT PRIMARY KEY NOT NULL,
      opened_at TEXT NOT NULL
    );
  `);
  return database;
}

export async function getOpenedReceivedJingleIds() {
  const database = await databaseWithBoxedState();
  const rows = await database.getAllAsync<Row>(
    'SELECT jingle_id, opened_at FROM received_jingle_boxed_opened ORDER BY opened_at DESC',
  );
  return new Set(rows.map((row) => String(row.jingle_id)));
}

export async function markReceivedJingleOpened(jingleId: string) {
  const clean = jingleId.trim();
  if (!clean) return;
  const database = await databaseWithBoxedState();
  await database.runAsync(
    `INSERT OR REPLACE INTO received_jingle_boxed_opened (jingle_id, opened_at) VALUES (?, ?)`,
    clean,
    new Date().toISOString(),
  );
}

export async function forgetReceivedJingleOpened(jingleId: string) {
  const clean = jingleId.trim();
  if (!clean) return;
  const database = await databaseWithBoxedState();
  await database.runAsync(
    'DELETE FROM received_jingle_boxed_opened WHERE jingle_id = ?',
    clean,
  );
}
