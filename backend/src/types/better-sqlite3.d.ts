declare module 'better-sqlite3' {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement {
    run(...params: unknown[]): RunResult;
    get<T = unknown>(...params: unknown[]): T;
    all<T = unknown>(...params: unknown[]): T[];
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(command: string): void;
    close(): void;
  }

  interface DatabaseConstructor {
    new (path: string): Database;
    (path: string): Database;
  }

  const BetterSqlite3: DatabaseConstructor;
  export = BetterSqlite3;
}
