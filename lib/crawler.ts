import { db, init } from "@/lib/db";
import { sources, fetchKeywordJobs } from "@/lib/sources";

export type CrawlProgress = {
  completed: number;
  total: number;
  percent: number;
  currentSource: string;
  sourceLabel: string;
  totalJobs: number;
};

export type CrawlProgressCallback = (p: CrawlProgress) => void;

export function formatSourceLabel(source: string): string {
  if (source.startsWith("greenhouse:")) {
    const slug = source.slice("greenhouse:".length);
    return `Greenhouse (${slug})`;
  }
  if (source.startsWith("lever:")) {
    const slug = source.slice("lever:".length);
    return `Lever (${slug})`;
  }
  if (source.startsWith("html:")) {
    const slug = source.slice("html:".length);
    return `HTML (${slug})`;
  }
  if (source === "remotive") return "Remotive";
  if (source === "arbeitnow") return "Arbeitnow";
  if (source === "remoteok") return "Remote OK";
  if (source === "kalibrr") return "Kalibrr";
  if (source === "dealls") return "Dealls";
  return source;
}

let activeCrawlPromise: Promise<{ start: string; totalJobs: number; result: Record<string, number | string> }> | null = null;
const progressListeners = new Set<CrawlProgressCallback>();

export async function runCrawl(onProgress?: CrawlProgressCallback) {
  if (onProgress) {
    progressListeners.add(onProgress);
  }

  if (activeCrawlPromise) {
    try {
      return await activeCrawlPromise;
    } finally {
      if (onProgress) {
        progressListeners.delete(onProgress);
      }
    }
  }

  activeCrawlPromise = (async () => {
    try {
      await init();
      const start = new Date().toISOString();
      const result: Record<string, number | string> = {};
      let totalJobs = 0;
      let completed = 0;
      const total = sources.length;

      const notify = (source: string) => {
        const payload: CrawlProgress = {
          completed,
          total,
          percent: Math.min(100, Math.round((completed / total) * 100)),
          currentSource: source,
          sourceLabel: formatSourceLabel(source),
          totalJobs,
        };
        for (const listener of progressListeners) {
          try {
            listener(payload);
          } catch {}
        }
      };

      // ponytail: collect in-memory during concurrent fetch, write to Turso in one fast consolidated batch
      const allJobs: { source: string; job: any }[] = [];
      const successfulSources: string[] = [];

      await Promise.all(
        sources.map(async ([source, fetchJobs]) => {
          try {
            const jobs = await fetchJobs();
            result[source] = jobs.length;
            totalJobs += jobs.length;
            successfulSources.push(source);
            for (const j of jobs) {
              allJobs.push({ source, job: j });
            }
          } catch (e) {
            result[source] = `error: ${e instanceof Error ? e.message : String(e)}`;
          } finally {
            completed++;
            notify(source);
          }
        }),
      );

      // Single consolidated batch write: eliminates 18 separate remote Turso roundtrips
      const statements: { sql: string; args: any[] }[] = allJobs.map(({ source, job: j }) => ({
        sql: `INSERT INTO jobs (id, source, company, title, location, url, is_intern, posted_at, seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET company=excluded.company, title=excluded.title,
                location=excluded.location, url=excluded.url, is_intern=excluded.is_intern,
                posted_at=excluded.posted_at, seen_at=excluded.seen_at`,
        args: [j.id, source, j.company, j.title, j.location, j.url, j.isIntern ? 1 : 0, j.postedAt, start],
      }));

      for (const src of successfulSources) {
        statements.push({ sql: "DELETE FROM jobs WHERE source = ? AND seen_at < ?", args: [src, start] });
      }

      statements.push({
        sql: `INSERT INTO crawl_meta (key, value, updated_at) VALUES ('last_crawl', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        args: [JSON.stringify(result), start],
      });

      for (let i = 0; i < statements.length; i += 500) {
        await db.batch(statements.slice(i, i + 500));
      }

      const finalPayload: CrawlProgress = {
        completed: total,
        total,
        percent: 100,
        currentSource: "done",
        sourceLabel: "Selesai",
        totalJobs,
      };
      for (const listener of progressListeners) {
        try {
          listener(finalPayload);
        } catch {}
      }

      return { start, totalJobs, result };
    } finally {
      activeCrawlPromise = null;
    }
  })();

  try {
    return await activeCrawlPromise;
  } finally {
    if (onProgress) {
      progressListeners.delete(onProgress);
    }
  }
}

export async function runKeywordCrawl(keyword: string): Promise<{ keyword: string; totalJobs: number }> {
  const kw = keyword.trim();
  if (!kw || kw.length < 2) return { keyword: kw, totalJobs: 0 };

  await init();
  const start = new Date().toISOString();
  const jobs = await fetchKeywordJobs(kw);

  if (jobs.length > 0) {
    const statements = jobs.map((j) => ({
      sql: `INSERT INTO jobs (id, source, company, title, location, url, is_intern, posted_at, seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET company=excluded.company, title=excluded.title,
              location=excluded.location, url=excluded.url, is_intern=excluded.is_intern,
              posted_at=excluded.posted_at, seen_at=excluded.seen_at`,
      args: [j.id, j.id.split(":")[0], j.company, j.title, j.location, j.url, j.isIntern ? 1 : 0, j.postedAt, start],
    }));

    for (let i = 0; i < statements.length; i += 500) {
      await db.batch(statements.slice(i, i + 500));
    }
  }

  return { keyword: kw, totalJobs: jobs.length };
}

