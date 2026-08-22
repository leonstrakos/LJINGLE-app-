import * as SQLite from 'expo-sqlite';

// sqliteSingleConnectionV1
//
// One JS wrapper -> one native SQLite connection for the entire
// application runtime.
//
// useNewConnection is deliberate:
// a fresh JS runtime must not inherit expo-sqlite's cached native
// wrapper for life_catalogue.db if Android left that wrapper poisoned.
//
// We intentionally DO NOT close this connection manually.
// It belongs to the lifetime of the JS runtime.
const DATABASE_NAME = 'life_catalogue.db';

type OpenDatabaseSyncWithOptions = (
  databaseName: string,
  options?: {
    enableChangeListener?: boolean;
    useNewConnection?: boolean;
  },
  directory?: string,
) => SQLite.SQLiteDatabase;

// Some older local expo-sqlite declaration shims in this project do
// not expose SQLiteOpenOptions even though SDK 54 supports it at runtime.
const openDatabaseSyncWithOptions =
  SQLite.openDatabaseSync as unknown as OpenDatabaseSyncWithOptions;

let database: SQLite.SQLiteDatabase | null = null;

export function getDatabaseConnection(): SQLite.SQLiteDatabase {
  if (!database) {
    database = openDatabaseSyncWithOptions(
      DATABASE_NAME,
      { useNewConnection: true },
    );
  }

  return database;
}
