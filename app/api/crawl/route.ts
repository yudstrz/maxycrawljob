import { db, init } from "@/lib/db";
import { sources } from "@/lib/sources";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("unauthorized", { status: 401 });

  await init();
  const start = new Date().toISOString();
  const result: Record<string, number | string> = {};

  await Promise.all(
    sources.map(async ([source, fetchJobs]) => {
      try {
        const jobs = await fetchJobs();
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
        result[source] = jobs.length;
      } catch (e) {
        result[source] = `error: ${e instanceof Error ? e.message : e}`;
      }
    }),
  );

  return Response.json(result);
}
