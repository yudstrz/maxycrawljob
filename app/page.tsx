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

const SORT_LABELS: Record<string, string> = {
  latest: "Terbaru (Desc)",
  oldest: "Terlama (Asc)",
  title_asc: "Posisi (A-Z)",
  company_asc: "Perusahaan (A-Z)",
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
  const sort = ["latest", "oldest", "title_asc", "company_asc"].includes(one(sp.sort))
    ? one(sp.sort)
    : "latest";
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

  let sortSql = "ORDER BY COALESCE(posted_at, seen_at) DESC";
  if (sort === "oldest") {
    sortSql = "ORDER BY COALESCE(posted_at, seen_at) ASC";
  } else if (sort === "title_asc") {
    sortSql = "ORDER BY title COLLATE NOCASE ASC";
  } else if (sort === "company_asc") {
    sortSql = "ORDER BY company COLLATE NOCASE ASC";
  }

  await init();
  const count = await db.execute({ sql: `SELECT COUNT(*) AS n FROM jobs ${where}`, args: a });
  const total = Number(count.rows[0].n);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(one(sp.page)) || 1));

  const [rows, mine, metaRes] = await Promise.all([
    db.execute({
      sql: `SELECT id, title, company, location, url, is_intern, source, posted_at,
                   id IN (SELECT job_id FROM wishlist WHERE owner = ?) AS saved
            FROM jobs ${where} ${sortSql} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
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
  const filtered = Boolean(q || intern || region || saved || sort !== "latest");
  const lastCrawlRow = metaRes.rows[0];
  const lastCrawlAt = lastCrawlRow ? String(lastCrawlRow.updated_at) : null;

  const href = (p: number) =>
    `/?${new URLSearchParams({
      ...(q && { q }),
      ...(intern && { kind: "intern" }),
      ...(region && { region }),
      ...(saved && { saved: "1" }),
      ...(sort !== "latest" && { sort }),
      page: String(p),
    })}`;

  const nums = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((x, y) => x - y);

  return (
    <div className="layout-container">
      <a href="#daftar" className="skip">
        Lewati ke daftar lowongan
      </a>

      <header className="app-header">
        <div className="top-bar">
          <div className="brand-block">
            <div className="brand-title-wrap">
              <h1 className="brand-title">maxycrawljob</h1>
              <span className="brand-tag">Kurasi Resmi</span>
            </div>
            <p className="brand-desc">
              Semua loker idaman, disaring rapi tanpa drama. Rangkuman lowongan kerja dan magang resmi langsung dari portal terpercaya.
            </p>
          </div>

          <div className="sync-card">
            <div className="sync-info">
              <span className="sync-pulse" aria-hidden="true" />
              <span className="sync-status">
                {lastCrawlAt
                  ? `Sinkron terakhir: ${formatRelativeTime(lastCrawlAt)}`
                  : "Belum pernah disinkronkan"}
              </span>
            </div>
            <form action={triggerCrawl}>
              <button type="submit" className="sync-btn" aria-label="Tarik pembaruan lowongan kerja">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Tarik Loker Terbaru</span>
              </button>
            </form>
          </div>
        </div>

        <form role="search" className="search-deck" action="/" method="GET">
          <div className="search-main-row">
            <div className="search-field-wrap">
              <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Cari posisi, perusahaan, atau kota penempatan..."
                aria-label="Cari lowongan"
                className="search-input"
              />
            </div>
            <button type="submit" className="submit-btn">
              Cari Loker
            </button>
          </div>

          <div className="search-sub-row">
            <div className="filters-group">
              <label className="field-select-group">
                <span className="field-label">Wilayah</span>
                <select name="region" defaultValue={region} aria-label="Pilih wilayah penempatan" className="select-control">
                  <option value="">Semua Wilayah</option>
                  <option value="id">Indonesia</option>
                  <option value="world">Luar Indonesia</option>
                </select>
              </label>

              <label className="field-select-group">
                <span className="field-label">Urutkan</span>
                <select name="sort" defaultValue={sort} aria-label="Pilih urutan loker" className="select-control">
                  <option value="latest">Terbaru (Desc)</option>
                  <option value="oldest">Terlama (Asc)</option>
                  <option value="title_asc">Posisi (A-Z)</option>
                  <option value="company_asc">Perusahaan (A-Z)</option>
                </select>
              </label>

              <div className="filter-chips">
                <label className="chip-label">
                  <input name="kind" type="checkbox" value="intern" defaultChecked={intern} />
                  <span>Khusus Magang</span>
                </label>

                <label className="chip-label">
                  <input name="saved" type="checkbox" value="1" defaultChecked={saved} />
                  <span>Wishlist ({Number(mine.rows[0]?.n || 0)})</span>
                </label>
              </div>
            </div>

            <div className="filter-actions-group">
              <button type="submit" className="apply-filter-btn">
                Terapkan
              </button>
              {filtered ? (
                <a href="/" className="reset-filter-link">
                  Reset Filter
                </a>
              ) : null}
            </div>
          </div>
        </form>
      </header>

      <main id="daftar" tabIndex={-1}>
        <div className="count-bar">
          <div className="count-text">
            <span>
              Menampilkan <strong>{total}</strong> lowongan
              {q ? (
                <> untuk kata kunci &ldquo;<strong>{q}</strong>&rdquo;</>
              ) : null}
            </span>
            <span className="count-divider" aria-hidden="true">&bull;</span>
            <span className="sort-badge">
              Urutan: <strong>{SORT_LABELS[sort]}</strong>
            </span>
          </div>

          {pages > 1 ? (
            <div className="page-text">
              Halaman {page} dari {pages}
            </div>
          ) : null}
        </div>

        {jobs.length ? (
          <ol className="jobs-list">
            {jobs.map((j) => {
              const sourcePrefix = String(j.source).split(":")[0];
              const sourceName = LABEL[sourcePrefix] || sourcePrefix;

              return (
                <li key={String(j.id)} className="job-card">
                  <div className="job-content">
                    <div className="job-top-meta">
                      <div className="job-badge-cluster">
                        <span className="tag-badge source-badge">{sourceName}</span>
                        {j.is_intern ? <span className="tag-badge intern-badge">Magang</span> : null}
                      </div>

                      {j.posted_at ? (
                        <time className="job-time" dateTime={String(j.posted_at)}>
                          {fmt.format(new Date(String(j.posted_at)))}
                        </time>
                      ) : null}
                    </div>

                    <h2 className="job-title">
                      <a href={String(j.url)} target="_blank" rel="noopener noreferrer">
                        {String(j.title)}
                        <span className="sr-only"> (buka di tab baru)</span>
                      </a>
                    </h2>

                    <div className="job-meta-line">
                      <span className="company-name">{String(j.company)}</span>
                      {j.location ? (
                        <>
                          <span className="meta-dot" aria-hidden="true">&bull;</span>
                          <span className="location-text">{String(j.location)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="job-actions">
                    <form action={toggleWishlist.bind(null, String(j.id))}>
                      <button
                        type="submit"
                        className={`wishlist-btn ${j.saved ? "is-saved" : ""}`}
                        aria-pressed={Boolean(j.saved)}
                        aria-label={`${
                          j.saved ? "Hapus dari wishlist" : "Simpan ke wishlist"
                        }: ${String(j.title)}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={j.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{j.saved ? "Tersimpan" : "Simpan"}</span>
                      </button>
                    </form>

                    <a
                      href={String(j.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link-btn"
                      aria-label={`Buka detail lowongan ${String(j.title)} di portal ${sourceName}`}
                    >
                      <span>Buka Loker</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty-card">
            {filtered ? (
              <>
                <div className="empty-icon-wrap" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h2>Belum nemu lowongan yang pas</h2>
                <p>
                  Coba longgarkan kata kunci pencarian atau bersihkan filter di atas supaya lowongan lainnya bisa muncul.
                </p>
                <a href="/" className="empty-action-btn">
                  Bersihkan Filter
                </a>
              </>
            ) : (
              <>
                <div className="empty-icon-wrap" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h2>Gudang loker masih kosong melompong</h2>
                <p>
                  Belum ada data lowongan yang tersimpan di sistem. Klik tombol di bawah untuk menarik lowongan terbaru dari berbagai portal kerja.
                </p>
                <form action={triggerCrawl}>
                  <button type="submit" className="empty-action-btn">
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
              <a href={href(page - 1)} rel="prev" className="pager-nav" aria-label="Ke halaman sebelumnya">
                Sebelumnya
              </a>
            ) : null}

            <div className="pager-numbers">
              {nums.map((n, i) => (
                <span key={n} className="num-wrap">
                  {i > 0 && n - nums[i - 1] > 1 ? <span className="pager-ellipsis" aria-hidden="true">&hellip;</span> : null}
                  {n === page ? (
                    <span aria-current="page" className="page-cur">
                      {n}
                    </span>
                  ) : (
                    <a href={href(n)} className="page-link" aria-label={`Halaman ${n}`}>
                      {n}
                    </a>
                  )}
                </span>
              ))}
            </div>

            {page < pages ? (
              <a href={href(page + 1)} rel="next" className="pager-nav" aria-label="Ke halaman berikutnya">
                Berikutnya
              </a>
            ) : null}
          </nav>
        ) : null}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>
            Sumber data resmi: Kalibrr, Dealls, Greenhouse, Lever, Remotive, Arbeitnow, dan Remote OK. Setiap tautan mengarah langsung ke halaman lowongan asli di masing-masing portal.
          </p>
          <p>
            Dibuat seringkas mungkin: tanpa pelacak pihak ketiga, tanpa iklan terselubung, dan ramah kuota data.
          </p>
        </div>
      </footer>
    </div>
  );
}
