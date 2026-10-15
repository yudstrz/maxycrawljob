import { db, init } from "@/lib/db";

const PAGE = 50;
const LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  remoteok: "Remote OK",
};
const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 100);
  const intern = one(sp.kind) === "intern";
  const page = Math.max(1, parseInt(one(sp.page)) || 1);

  const where = [q && "(title LIKE ? OR company LIKE ? OR location LIKE ?)", intern && "is_intern = 1"].filter(Boolean).join(" AND ");
  const args = q ? Array(3).fill(`%${q}%`) : [];

  await init();
  const [rows, count] = await Promise.all([
    db.execute({
      sql: `SELECT id, title, company, location, url, is_intern, source, posted_at FROM jobs
            ${where && `WHERE ${where}`} ORDER BY COALESCE(posted_at, seen_at) DESC LIMIT ${PAGE + 1} OFFSET ${(page - 1) * PAGE}`,
      args,
    }),
    db.execute({ sql: `SELECT COUNT(*) AS n FROM jobs ${where && `WHERE ${where}`}`, args }),
  ]);
  const total = Number(count.rows[0].n);
  const jobs = rows.rows.slice(0, PAGE);
  const href = (p: number) => `/?${new URLSearchParams({ ...(q && { q }), ...(intern && { kind: "intern" }), page: String(p) })}`;

  return (
    <>
      <header>
        <h1>maxycrawljob</h1>
        <p>Lowongan dan magang dari job board yang menyediakan API publik. Setiap baris menaut ke halaman asli.</p>
        <form role="search">
          <input name="q" type="search" defaultValue={q} placeholder="Judul, perusahaan, lokasi" aria-label="Cari lowongan" />
          <label>
            <input name="kind" type="checkbox" value="intern" defaultChecked={intern} /> Hanya magang
          </label>
          <button>Cari lowongan</button>
        </form>
      </header>

      <main>
        <p className="count">{total} lowongan{q && <> untuk &ldquo;{q}&rdquo;</>}</p>
        {jobs.length ? (
          <ol>
            {jobs.map((j) => (
              <li key={String(j.id)}>
                <a href={String(j.url)} target="_blank" rel="noopener noreferrer">
                  {String(j.title)}
                </a>
                <span className="meta">
                  {String(j.company)}
                  {j.location ? `, ${j.location}` : ""}
                </span>
                <span className="side">
                  {j.is_intern ? <b>Magang</b> : null}
                  {j.posted_at ? <time dateTime={String(j.posted_at)}>{fmt.format(new Date(String(j.posted_at)))}</time> : null}
                  <span>{LABEL[String(j.source).split(":")[0]]}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">
            {q || intern ? (
              <>Tidak ada lowongan yang cocok. <a href="/">Hapus filter</a>.</>
            ) : (
              <>Database masih kosong. Jalankan <code>/api/crawl</code> sekali untuk mengisinya.</>
            )}
          </p>
        )}
        <nav aria-label="Halaman" className="pager">
          {page > 1 && <a href={href(page - 1)}>Halaman sebelumnya</a>}
          {rows.rows.length > PAGE && <a href={href(page + 1)}>Halaman berikutnya</a>}
        </nav>
      </main>

      <footer>
        <p>
          Sumber data: Greenhouse dan Lever (job board resmi perusahaan),{" "}
          <a href="https://remotive.com">Remotive</a> (tertunda hingga 24 jam), <a href="https://arbeitnow.com">Arbeitnow</a>,{" "}
          <a href="https://remoteok.com">Remote OK</a>.
        </p>
      </footer>
    </>
  );
}
