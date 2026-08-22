import { Platform } from 'react-native';

import { getDatabase } from './database';

type Row = Record<string, unknown>;
type Database = Awaited<ReturnType<typeof getDatabase>>;

export type BackupInspection = {
  version: number;
  exportedAt: string | null;
  tableCount: number;
  rowCount: number;
  tableNames: string[];
  legacy: boolean;
};

type ParsedBackup = {
  version: number;
  exportedAt: string | null;
  tables: Record<string, Row[]>;
  legacy: boolean;
};

function quoteIdentifier(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSON nije valjan.');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Ovo nije valjan LJingle backup.');
  }

  const root = raw as Record<string, unknown>;
  const version = typeof root.version === 'number' ? root.version : 1;
  const exportedAt = typeof root.exportedAt === 'string' ? root.exportedAt : null;

  // Current V2: { app, version: 2, tables }
  // Older calm V1: { version: 1, tables }
  // Older settings V1: { app, version: 1, data }
  const candidate =
    root.tables && typeof root.tables === 'object' && !Array.isArray(root.tables)
      ? root.tables
      : root.data && typeof root.data === 'object' && !Array.isArray(root.data)
        ? root.data
        : null;

  if (!candidate) throw new Error('JSON nema backup tablice.');

  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(candidate as Record<string, unknown>)) {
    if (!Array.isArray(rows)) throw new Error(`Backup tablica "${name}" nije valjana.`);
    tables[name] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Backup tablica "${name}" sadrži nevaljan redak.`);
      }
      return row as Row;
    });
  }

  const names = Object.keys(tables);
  if (!names.length) throw new Error('Backup je prazan.');

  return {
    version,
    exportedAt,
    tables,
    legacy: version < 2 || !('tables' in root),
  };
}

export function inspectLocalBackup(text: string): BackupInspection {
  const backup = parseBackup(text);
  const tableNames = Object.keys(backup.tables).sort();
  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    tableCount: tableNames.length,
    rowCount: tableNames.reduce((sum, name) => sum + backup.tables[name]!.length, 0),
    tableNames,
    legacy: backup.legacy,
  };
}

async function appTableNames(database: Database) {
  const rows = await database.getAllAsync<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name`,
  );
  return rows.map((row) => row.name).filter(Boolean);
}

async function tableColumns(database: Database, table: string) {
  const rows = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${quoteIdentifier(table)})`,
  );
  return new Set(rows.map((row) => row.name));
}

function sqliteValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  throw new Error('Backup sadrži vrijednost koju SQLite ne može vratiti.');
}

async function atomic(database: Database, task: (db: Database) => Promise<void>) {
  if (Platform.OS === 'web') {
    await task(database);
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

export async function exportLocalData() {
  const database = await getDatabase();
  const names = await appTableNames(database);
  const tables: Record<string, Row[]> = {};

  for (const table of names) {
    tables[table] = await database.getAllAsync<Row>(
      `SELECT * FROM ${quoteIdentifier(table)}`,
    );
  }

  return JSON.stringify({
    app: 'LJingle',
    version: 2,
    exportedAt: new Date().toISOString(),
    tables,
  });
}

export async function importLocalData(text: string) {
  const backup = parseBackup(text);
  const database = await getDatabase();
  const existing = await appTableNames(database);
  const existingSet = new Set(existing);
  const targetTables = Object.keys(backup.tables).filter((name) => existingSet.has(name));

  if (!targetTables.length) {
    throw new Error('Backup nema nijednu tablicu koju ova verzija aplikacije može vratiti.');
  }

  // Native SQLite can safely disable FK checks outside the transaction, perform the
  // replacement atomically, validate the resulting graph, then re-enable them.
  if (Platform.OS !== 'web') await database.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await atomic(database, async (transaction) => {
      for (const table of [...targetTables].reverse()) {
        await transaction.runAsync(`DELETE FROM ${quoteIdentifier(table)}`);
      }

      for (const table of targetTables) {
        const allowed = await tableColumns(transaction, table);
        for (const row of backup.tables[table]!) {
          const columns = Object.keys(row).filter((column) => allowed.has(column));
          if (!columns.length) continue;
          const sql =
            `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) ` +
            `VALUES (${columns.map(() => '?').join(', ')})`;
          await transaction.runAsync(
            sql,
            ...columns.map((column) => sqliteValue(row[column])),
          );
        }
      }

      if (Platform.OS !== 'web') {
        const violations = await transaction.getAllAsync<Record<string, unknown>>(
          'PRAGMA foreign_key_check;',
        );
        if (violations.length) {
          throw new Error(
            'Backup nije kompatibilan s trenutnom bazom (foreign-key provjera nije prošla). Ništa nije promijenjeno.',
          );
        }
      }
    });
  } finally {
    if (Platform.OS !== 'web') await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}
