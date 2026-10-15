import { db, init } from "@/lib/db";
import { sources } from "@/lib/sources";

export async function runCrawl() {
  await init();
  const start = new Date().toISOString();
  const result: Record<string, number | string> = {};
  let totalJobs = 0;

  await Promise.all(
    sources.map(async ([source, fetchJobs]) => {
      try {
        const jobs = await fetchJobs();
        if (jobs.length > 0) {
          await db.batch([
            ...jobs.map((j) => ({
              sql: `INSERT INTO jobs (id, source, company, title, location, url, is_intern, posted_at, seen_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET company=excluded.company, title=excluded.title,
                      location=excluded.location, url=excluded.url, is_intern=excluded.is_intern,
                      posted_at=excluded.posted_at, seen_at=excluded.seen_at`,
              args: [j.id, source, j.company, j.title, j.location, j.url, j.isIntern ? 1 : 0, j.postedAt, start],
            })),
            { sql: "DELETE FROM jobs WHERE source = ? AND seen_at < ?", args: [source, start] },
          ]);
        }
        result[source] = jobs.length;
        totalJobs += jobs.length;
      } catch (e) {
        result[source] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }),
  );

  await db.execute({
    sql: `INSERT INTO crawl_meta (key, value, updated_at) VALUES ('last_crawl', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    args: [JSON.stringify(result), start],
  });

  return { start, totalJobs, result };
}
