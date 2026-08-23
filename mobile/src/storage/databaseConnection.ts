import { Platform } from 'react-native';
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

type OpenDatabaseAsyncWithOptions = (
  databaseName: string,
  options?: {
    enableChangeListener?: boolean;
    useNewConnection?: boolean;
  },
  directory?: string,
) => Promise<SQLite.SQLiteDatabase>;

// Some older local expo-sqlite declaration shims in this project do
// not expose SQLiteOpenOptions even though SDK 54 supports it at runtime.
const openDatabaseSyncWithOptions =
  SQLite.openDatabaseSync as unknown as OpenDatabaseSyncWithOptions;

const openDatabaseAsyncWithOptions =
  SQLite.openDatabaseAsync as unknown as OpenDatabaseAsyncWithOptions;

let database: SQLite.SQLiteDatabase | null = null;

// sqlitePlatformConnectionV2
//
// Native keeps the synchronous fresh-connection strategy that
// fixed the Android poisoned-handle bug.
//
// Web deliberately uses expo-sqlite's async worker path instead
// of the SharedArrayBuffer-based synchronous bridge.
let webDatabasePromise:
  Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabaseConnection(): SQLite.SQLiteDatabase {
  if (!database) {
    database = openDatabaseSyncWithOptions(
      DATABASE_NAME,
      { useNewConnection: true },
    );
  }

  return database;
}

export function getDatabaseConnectionAsync():
  Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS !== 'web') {
    return Promise.resolve(
      getDatabaseConnection(),
    );
  }

  if (!webDatabasePromise) {
    webDatabasePromise =
      openDatabaseAsyncWithOptions(
        DATABASE_NAME,
        { useNewConnection: true },
      );
  }

  return webDatabasePromise;
}
