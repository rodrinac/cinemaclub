import Database from "better-sqlite3";

class MockSQLiteDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(":memory:");
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    this.db.prepare("BEGIN IMMEDIATE").run();
    try {
      const result = await task();
      this.db.prepare("COMMIT").run();
      return result;
    } catch (err) {
      try {
        this.db.prepare("ROLLBACK").run();
      } catch {
        // ignore if rollback fails
      }
      throw err;
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      lastInsertRowId: Number(info.lastInsertRowid),
      changes: info.changes,
    };
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) ?? null;
  }
}

let mockInstance: MockSQLiteDatabase | null = null;

export const openDatabaseAsync = async (): Promise<MockSQLiteDatabase> => {
  if (!mockInstance) {
    mockInstance = new MockSQLiteDatabase();
  }
  return mockInstance;
};

export const resetMockDatabase = () => {
  mockInstance = new MockSQLiteDatabase();
};
