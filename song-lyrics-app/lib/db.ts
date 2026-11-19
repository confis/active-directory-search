import { createClient, type Client } from "@libsql/client";

// libSQL client — storage resolution:
//  1. DATABASE_URL (recommended in production): a persistent libSQL/Turso URL
//     (libsql://...) together with DATABASE_AUTH_TOKEN. Real, shared persistence.
//  2. Otherwise a local SQLite file. On Vercel the project dir is read-only, so
//     we use /tmp there (NOTE: /tmp is ephemeral and resets — fine for trying it
//     out, but set DATABASE_URL for durable storage). Locally we use data/songs.db.
function resolveUrl(): string {
  // Accept either our own names or the ones the Turso Vercel integration injects.
  const remote = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (remote) return remote;
  if (process.env.VERCEL) return "file:/tmp/songs.db";
  return "file:data/songs.db";
}

const url = resolveUrl();
const authToken =
  process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

declare global {
  // eslint-disable-next-line no-var
  var __libsqlClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __dbReady: Promise<void> | undefined;
}

const client: Client =
  global.__libsqlClient ?? createClient({ url, authToken });
if (!global.__libsqlClient) global.__libsqlClient = client;

async function init(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      source_url TEXT,
      lyrics TEXT NOT NULL,
      chorus TEXT,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

export function ready(): Promise<void> {
  if (!global.__dbReady) global.__dbReady = init();
  return global.__dbReady;
}

export default client;
