import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let ready: Promise<unknown> | undefined;
export const init = () =>
  (ready ??= db.batch([
    `CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      is_intern INTEGER NOT NULL DEFAULT 0,
      posted_at TEXT,
      seen_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS jobs_posted ON jobs(posted_at DESC)`,
    `CREATE TABLE IF NOT EXISTS wishlist (
      owner TEXT NOT NULL,
      job_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (owner, job_id)
    )`,
    `CREATE TABLE IF NOT EXISTS crawl_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ]));
