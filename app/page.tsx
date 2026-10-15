import { cookies } from "next/headers";
import { db, init } from "@/lib/db";
import { INDONESIA_SQL } from "@/lib/region";
import { toggleWishlist, triggerCrawl } from "./actions";

const PAGE = 50;
const LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  remoteok: "Remote OK",
  kalibrr: "Kalibrr",
  dealls: "Dealls",
};

const fmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function formatRelativeTime(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  return fmt.format(new Date(isoString));
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 100);
  const intern = one(sp.kind) === "intern";
  const region = ["id", "world"].includes(one(sp.region)) ? one(sp.region) : "";
  const saved = one(sp.saved) === "1";
  const owner = (await cookies()).get("owner")?.value ?? "";

  const w: string[] = [];
  const a: string[] = [];
  if (q) {
    w.push("(title LIKE ? OR company LIKE ? OR location LIKE ?)");
    a.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (intern) w.push("is_intern = 1");
  if (region === "id") w.push(`(${INDONESIA_SQL})`);
  if (region === "world") w.push(`NOT (${INDONESIA_SQL})`);
  if (saved) {
    w.push("id IN (SELECT job_id FROM wishlist WHERE owner = ?)");
    a.push(owner);
  }
  const where = w.length ? `WHERE ${w.join(" AND ")}` : "";

  await init();
  const count = await db.execute({ sql: `SELECT COUNT(*) AS n FROM jobs ${where}`, args: a });
  const total = Number(count.rows[0].n);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(one(sp.page)) || 1));

  const [rows, mine, metaRes] = await Promise.all([
    db.execute({
      sql: `SELECT id, title, company, location, url, is_intern, source, posted_at,
                   id IN (SELECT job_id FROM wishlist WHERE owner = ?) AS saved
            FROM jobs ${where} ORDER BY COALESCE(posted_at, seen_at) DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
      args: [owner, ...a],
    }),
    db.execute({
      sql: "SELECT COUNT(*) AS n FROM wishlist w JOIN jobs j ON j.id = w.job_id WHERE w.owner = ?",
      args: [owner],
    }),
    db.execute({
      sql: "SELECT updated_at FROM crawl_meta WHERE key = 'last_crawl' LIMIT 1",
    }),
  ]);

  const jobs = rows.rows;
  const filtered = Boolean(q || intern || region || saved);
  const lastCrawlRow = metaRes.rows[0];
  const lastCrawlAt = lastCrawlRow ? String(lastCrawlRow.updated_at) : null;

  const href = (p: number) =>
    `/?${new URLSearchParams({
      ...(q && { q }),
      ...(intern && { kind: "intern" }),
      ...(region && { region }),
      ...(saved && { saved: "1" }),
      page: String(p),
    })}`;

  const nums = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((x, y) => x - y);

  return (
    <>
      <a href="#daftar" className="skip">
        Lewati ke daftar lowongan
      </a>

      <header>
        <div className="top-bar">
          <div className="brand-block">
            <h1>maxycrawljob</h1>
            <p>
              Semua loker idaman, disaring rapi tanpa drama. Gak perlu buka belasan tab: kami rangkum
              lowongan dan magang resmi langsung dari sumbernya.
            </p>
          </div>

          <div className="sync-panel">
            <span className="sync-status">
              {lastCrawlAt
                ? `Sinkron terakhir: ${formatRelativeTime(lastCrawlAt)}`
                : "Belum pernah disinkronkan"}
            </span>
            <form action={triggerCrawl}>
              <button type="submit" className="sync-btn" aria-label="Tarik pembaruan lowongan kerja">
                Tarik Loker Terbaru
              </button>
            </form>
          </div>
        </div>

        <form role="search">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari posisi, perusahaan, atau kota..."
            aria-label="Cari lowongan"
          />

          <label className="field">
            Wilayah
            <select name="region" defaultValue={region} aria-label="Pilih wilayah penempatan">
              <option value="">Semua Wilayah</option>
              <option value="id">Indonesia</option>
              <option value="world">Luar Indonesia</option>
            </select>
          </label>

          <label className="check">
            <input name="kind" type="checkbox" value="intern" defaultChecked={intern} />
            Khusus Magang
          </label>

          <label className="check">
            <input name="saved" type="checkbox" value="1" defaultChecked={saved} />
            Wishlist Saya ({Number(mine.rows[0]?.n || 0)})
          </label>

          <button type="submit" className="filter-btn">
            Terapkan Filter
          </button>
        </form>
      </header>

      <main id="daftar" tabIndex={-1}>
        <div className="count-bar">
          <span>
            Menampilkan <strong>{total}</strong> lowongan
            {q ? (
              <>
                {" "}
                untuk kata kunci &ldquo;<strong>{q}</strong>&rdquo;
              </>
            ) : null}
          </span>
          {pages > 1 ? (
            <span>
              Halaman {page} dari {pages}
            </span>
          ) : null}
        </div>

        {jobs.length ? (
          <ol>
            {jobs.map((j) => {
              const sourcePrefix = String(j.source).split(":")[0];
              const sourceName = LABEL[sourcePrefix] || sourcePrefix;

              return (
                <li key={String(j.id)} className="job-item">
                  <div className="job-main">
                    <h2 className="job-title">
                      <a href={String(j.url)} target="_blank" rel="noopener noreferrer">
                        {String(j.title)}
                        <span className="sr-only"> (buka di tab baru)</span>
                      </a>
                    </h2>

                    <div className="job-meta">
                      <span>{String(j.company)}</span>
                      {j.location ? (
                        <>
                          <span className="job-meta-dot" aria-hidden="true">
                            &bull;
                          </span>
                          <span>{String(j.location)}</span>
                        </>
                      ) : null}
                      {j.posted_at ? (
                        <>
                          <span className="job-meta-dot" aria-hidden="true">
                            &bull;
                          </span>
                          <time dateTime={String(j.posted_at)}>
                            {fmt.format(new Date(String(j.posted_at)))}
                          </time>
                        </>
                      ) : null}
                    </div>

                    <div className="job-tags">
                      {j.is_intern ? <span className="tag-badge intern">Magang</span> : null}
                      <span className="tag-badge">{sourceName}</span>
                    </div>
                  </div>

                  <div className="job-actions">
                    <form action={toggleWishlist.bind(null, String(j.id))}>
                      <button
                        type="submit"
                        className="wishlist-btn"
                        aria-pressed={Boolean(j.saved)}
                        aria-label={`${
                          j.saved ? "Hapus dari wishlist" : "Simpan ke wishlist"
                        }: ${String(j.title)}`}
                      >
                        {j.saved ? "Tersimpan" : "Simpan Loker"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty-state">
            {filtered ? (
              <>
                <h2>Belum nemu lowongan yang pas</h2>
                <p>
                  Coba longgarkan kata kunci pencarian atau bersihkan filter di atas supaya lowongan
                  lainnya bisa muncul.
                </p>
                <a href="/" className="filter-btn">
                  Bersihkan Filter
                </a>
              </>
            ) : (
              <>
                <h2>Gudang loker masih kosong melompong</h2>
                <p>
                  Belum ada data lowongan yang tersimpan. Klik tombol di bawah untuk menarik lowongan
                  terbaru dari berbagai portal kerja.
                </p>
                <form action={triggerCrawl}>
                  <button type="submit" className="filter-btn">
                    Tarik Loker Sekarang
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Navigasi halaman" className="pager">
            {page > 1 ? (
              <a href={href(page - 1)} rel="prev" aria-label="Ke halaman sebelumnya">
                Sebelumnya
              </a>
            ) : null}

            {nums.map((n, i) => (
              <span key={n} className="num">
                {i > 0 && n - nums[i - 1] > 1 ? <span aria-hidden="true">&hellip;</span> : null}
                {n === page ? (
                  <span aria-current="page" className="cur">
                    {n}
                  </span>
                ) : (
                  <a href={href(n)} aria-label={`Halaman ${n}`}>
                    {n}
                  </a>
                )}
              </span>
            ))}

            {page < pages ? (
              <a href={href(page + 1)} rel="next" aria-label="Ke halaman berikutnya">
                Berikutnya
              </a>
            ) : null}
          </nav>
        ) : null}
      </main>

      <footer>
        <div className="footer-content">
          <p>
            Sumber data resmi: Kalibrr, Dealls, Greenhouse, Lever, Remotive, Arbeitnow, dan Remote OK.
            Setiap tautan mengarah langsung ke halaman lowongan asli di masing-masing portal.
          </p>
          <p>
            Dibuat seringkas mungkin: tanpa pelacak pihak ketiga, tanpa iklan terselubung, dan ramah
            kuota data.
          </p>
        </div>
      </footer>
    </>
  );
}
