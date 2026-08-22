declare module 'expo-sqlite' {
  export type SQLiteBindValue = string | number | null | Uint8Array;

  export type SQLiteRunResult = {
    lastInsertRowId: number;
    changes: number;
  };

  export interface SQLiteDatabase {
    execSync(source: string): void;
    execAsync(source: string): Promise<void>;
    runSync(
      source: string,
      ...params: Array<SQLiteBindValue | SQLiteBindValue[] | Record<string, SQLiteBindValue>>
    ): SQLiteRunResult;
    runAsync(
      source: string,
      ...params: Array<SQLiteBindValue | SQLiteBindValue[] | Record<string, SQLiteBindValue>>
    ): Promise<SQLiteRunResult>;
    getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null>;
    getFirstSync<T>(source: string, ...params: SQLiteBindValue[]): T | null;
    getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
    withExclusiveTransactionAsync(task: (transaction: SQLiteDatabase) => Promise<void>): Promise<void>;
  }

  export function openDatabaseSync(databaseName: string): SQLiteDatabase;
  export function openDatabaseAsync(databaseName: string): Promise<SQLiteDatabase>;
}
