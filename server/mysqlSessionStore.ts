import session from "express-session";
import { sessionPool } from "./db";

type SessionPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

type MySqlSessionStoreOptions = {
  pool?: SessionPool;
  tableName?: string;
  errorLog?: (error: Error) => void;
};

/**
 * Minimal express-session store for MariaDB/MySQL.
 *
 * It deliberately uses the same pool adapter as the rest of the server so
 * session SQL never goes through PostgreSQL's connect-pg-simple dialect.
 */
export class MySqlSessionStore extends session.Store {
  private readonly pool: SessionPool;
  private readonly tableName: string;
  private readonly errorLog: (error: Error) => void;
  private ready: Promise<void>;

  constructor(options: MySqlSessionStoreOptions = {}) {
    super();
    this.pool = options.pool || (sessionPool as SessionPool);
    this.tableName = options.tableName || "session";
    this.errorLog = options.errorLog || ((error) => this.emit("error", error));
    this.ready = this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    try {
      await this.pool.query(
        `CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (
          sid VARCHAR(255) NOT NULL PRIMARY KEY,
          sess TEXT NOT NULL,
          expire DATETIME(3) NOT NULL,
          INDEX \`${this.tableName}_expire_idx\` (expire)
        ) ENGINE=InnoDB`,
      );
    } catch (error) {
      this.errorLog(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  get(sid: string, callback: (error: any, session?: session.SessionData | null) => void): void {
    void this.ready
      .then(async () => {
        const result = await this.pool.query(
          `SELECT sess, expire FROM \`${this.tableName}\` WHERE sid = ? LIMIT 1`,
          [sid],
        );
        const row = result.rows[0];
        if (!row || new Date(row.expire).getTime() <= Date.now()) {
          if (row) await this.destroy(sid, () => undefined);
          callback(null, null);
          return;
        }
        try {
          callback(null, JSON.parse(String(row.sess)) as session.SessionData);
        } catch {
          callback(null, null);
        }
      })
      .catch((error) => {
        this.errorLog(error instanceof Error ? error : new Error(String(error)));
        callback(error);
      });
  }

  set(sid: string, sessionData: session.SessionData, callback: (error?: any) => void = () => undefined): void {
    void this.ready
      .then(async () => {
        const cookie = sessionData.cookie as session.Cookie | undefined;
        const maxAge = cookie?.maxAge ?? 3 * 24 * 60 * 60 * 1000;
        const expire = new Date(Date.now() + maxAge);
        await this.pool.query(
          `INSERT INTO \`${this.tableName}\` (sid, sess, expire)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE sess = VALUES(sess), expire = VALUES(expire)`,
          [sid, JSON.stringify(sessionData), expire],
        );
        callback();
      })
      .catch((error) => {
        this.errorLog(error instanceof Error ? error : new Error(String(error)));
        callback(error);
      });
  }

  destroy(sid: string, callback: (error?: any) => void = () => undefined): void {
    void this.ready
      .then(async () => {
        await this.pool.query(`DELETE FROM \`${this.tableName}\` WHERE sid = ?`, [sid]);
        callback();
      })
      .catch((error) => {
        this.errorLog(error instanceof Error ? error : new Error(String(error)));
        callback(error);
      });
  }

  touch(sid: string, sessionData: session.SessionData, callback: (error?: any) => void = () => undefined): void {
    void this.ready
      .then(async () => {
        const cookie = sessionData.cookie as session.Cookie | undefined;
        const maxAge = cookie?.maxAge ?? 3 * 24 * 60 * 60 * 1000;
        await this.pool.query(
          `UPDATE \`${this.tableName}\` SET expire = ? WHERE sid = ?`,
          [new Date(Date.now() + maxAge), sid],
        );
        callback();
      })
      .catch((error) => {
        this.errorLog(error instanceof Error ? error : new Error(String(error)));
        callback(error);
      });
  }
}