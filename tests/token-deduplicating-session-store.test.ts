import assert from "node:assert/strict";
import test from "node:test";
import { wrapSessionStoreWithTokenDedup } from "../server/tokenDeduplicatingSessionStore";

type Row = {
  sid: string;
  sess: Record<string, any>;
  expire: Date;
};

function makeFixture(initialRows: Row[]) {
  const rows = initialRows.map((row) => ({ ...row, sess: { ...row.sess } }));
  const pool = {
    async query(query: string, values: unknown[] = []) {
      if (
        query.startsWith("SELECT sid, sess") &&
        query.includes("WHERE sess->>'userId' = $1") &&
        query.includes("AND sess->>'tokenIssuedAt' = $2")
      ) {
        return {
          rows: rows.filter((row) =>
            String(row.sess.userId) === String(values[0]) &&
            String(row.sess.tokenIssuedAt) === String(values[1])
          ),
        };
      }

      if (query.startsWith("DELETE") && query.includes("AND sess->>'tokenIssuedAt' = $2")) {
        const [userId, tokenIssuedAt, keepSid] = values;
        for (let index = rows.length - 1; index >= 0; index--) {
          const row = rows[index];
          if (
            String(row.sess.userId) === String(userId) &&
            String(row.sess.tokenIssuedAt) === String(tokenIssuedAt) &&
            row.sid !== keepSid
          ) {
            rows.splice(index, 1);
          }
        }
        return { rows: [] };
      }

      if (query.startsWith("SELECT sid, sess, expire")) {
        return {
          rows: rows.filter((row) => String(row.sess.userId) === String(values[0])),
        };
      }

      if (query.startsWith('DELETE FROM "session" WHERE sid = $1')) {
        const sid = String(values[0]);
        for (let index = rows.length - 1; index >= 0; index--) {
          if (rows[index].sid === sid) rows.splice(index, 1);
        }
        return { rows: [] };
      }

      throw new Error(`Unexpected session-store query: ${query}`);
    },
  };

  const originalStore = {
    set(sid: string, sess: Record<string, any>, callback: (error?: Error) => void) {
      rows.push({ sid, sess, expire: new Date(Date.now() + 86_400_000) });
      callback();
    },
    destroy(sid: string, callback: (error?: Error) => void) {
      const index = rows.findIndex((row) => row.sid === sid);
      if (index >= 0) rows.splice(index, 1);
      callback();
    },
  };

  return {
    rows,
    store: originalStore,
    pool,
  };
}

function saveSession(store: any, sid: string, tokenIssuedAt: number): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(
      sid,
      {
        userId: "user-1",
        tokenIssuedAt,
        loginAt: new Date(tokenIssuedAt).toISOString(),
      },
      (error?: Error) => error ? reject(error) : resolve(),
    );
  });
}

test("keeps four newest devices and revokes the oldest sessions before deleting them", async () => {
  const now = Date.now();
  const initialRows = Array.from({ length: 7 }, (_, index) => {
    const tokenIssuedAt = now - (7 - index) * 1_000;
    return {
      sid: `old-${index + 1}`,
      sess: {
        userId: "user-1",
        tokenIssuedAt,
        loginAt: new Date(tokenIssuedAt).toISOString(),
      },
      expire: new Date(now + 86_400_000),
    };
  });
  const fixture = makeFixture(initialRows);
  const evicted: Array<{ sid: string; tokenIssuedAt: number | null }> = [];
  const store = wrapSessionStoreWithTokenDedup(fixture.store as any, {
    pool: fixture.pool,
    isMysql: false,
    maxDevices: 4,
    onDeviceEvicted: (event) => {
      assert(fixture.rows.some((row) => row.sid === event.sid), "revocation runs before deletion");
      evicted.push(event);
    },
  });

  await saveSession(store, "new-device", now);

  assert.equal(fixture.rows.length, 4);
  assert.equal(evicted.length, 4);
  assert.deepEqual(evicted.map((event) => event.tokenIssuedAt), [
    now - 7_000,
    now - 6_000,
    now - 5_000,
    now - 4_000,
  ]);
  assert(fixture.rows.some((row) => row.sid === "new-device"), "the new/current device remains connected");
});

test("deduplicates legacy SIDs for one Bearer token before applying the device limit", async () => {
  const now = Date.now();
  const timestampRows = [
    ["old-alias-1", 100],
    ["old-alias-2", 100],
    ["device-2", 200],
    ["device-3", 300],
    ["device-4", 400],
  ] as const;
  const fixture = makeFixture(timestampRows.map(([sid, tokenIssuedAt]) => ({
    sid,
    sess: {
      userId: "user-1",
      tokenIssuedAt,
      loginAt: new Date(tokenIssuedAt).toISOString(),
    },
    expire: new Date(now + 86_400_000),
  })));
  const evictedSids: string[] = [];
  const store = wrapSessionStoreWithTokenDedup(fixture.store as any, {
    pool: fixture.pool,
    isMysql: false,
    maxDevices: 4,
    onDeviceEvicted: ({ sid }) => { evictedSids.push(sid); },
  });

  await saveSession(store, "new-device", 500);

  assert.equal(fixture.rows.length, 4);
  assert.deepEqual(evictedSids, ["old-alias-1", "old-alias-2"]);
  assert(!fixture.rows.some((row) => row.sess.tokenIssuedAt === 100));
});

test("does not delete a session when its token revocation cannot be persisted", async () => {
  const now = Date.now();
  const fixture = makeFixture(Array.from({ length: 4 }, (_, index) => {
    const tokenIssuedAt = now - (4 - index) * 1_000;
    return {
      sid: `device-${index + 1}`,
      sess: {
        userId: "user-1",
        tokenIssuedAt,
        loginAt: new Date(tokenIssuedAt).toISOString(),
      },
      expire: new Date(now + 86_400_000),
    };
  }));
  const errors: Error[] = [];
  const store = wrapSessionStoreWithTokenDedup(fixture.store as any, {
    pool: fixture.pool,
    isMysql: false,
    maxDevices: 4,
    onDeviceEvicted: async () => { throw new Error("revocation table unavailable"); },
    errorLog: (error) => errors.push(error),
  });

  await saveSession(store, "new-device", now);

  assert.equal(fixture.rows.length, 5, "keep the old row rather than leave its token usable after deletion");
  assert.equal(errors.length, 1);
});