import { cookies } from "next/headers";
import { db, init } from "@/lib/db";
import { INDONESIA_SQL } from "@/lib/region";
import { toggleWishlist } from "./actions";

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
  const region = ["id", "world"].includes(one(sp.region)) ? one(sp.region) : "";
  const saved = one(sp.saved) === "1";
  const owner = (await cookies()).get("owner")?.value ?? "";

  const w: string[] = [];
  const a: string[] = [];
  if (q) (w.push("(title LIKE ? OR company LIKE ? OR location LIKE ?)"), a.push(`%${q}%`, `%${q}%`, `%${q}%`));
  if (intern) w.push("is_intern = 1");
  if (region === "id") w.push(`(${INDONESIA_SQL})`);
  if (region === "world") w.push(`NOT (${INDONESIA_SQL})`);
  if (saved) (w.push("id IN (SELECT job_id FROM wishlist WHERE owner = ?)"), a.push(owner));
  const where = w.length ? `WHERE ${w.join(" AND ")}` : "";

  await init();
  const count = await db.execute({ sql: `SELECT COUNT(*) AS n FROM jobs ${where}`, args: a });
  const total = Number(count.rows[0].n);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(one(sp.page)) || 1));

  const [rows, mine] = await Promise.all([
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
  ]);
  const jobs = rows.rows;
  const filtered = !!(q || intern || region || saved);

  const href = (p: number) =>
    `/?${new URLSearchParams({ ...(q && { q }), ...(intern && { kind: "intern" }), ...(region && { region }), ...(saved && { saved: "1" }), page: String(p) })}`;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);

  return (
    <>
      <a href="#daftar" className="skip">Lewati ke daftar lowongan</a>
      <header>
        <h1>maxycrawljob</h1>
        <p>Lowongan dan magang dari job board yang menyediakan API publik. Setiap baris menaut ke halaman asli.</p>
        <form role="search">
          <input name="q" type="search" defaultValue={q} placeholder="Judul, perusahaan, lokasi" aria-label="Cari lowongan" />
          <label className="field">
            Wilayah
            <select name="region" defaultValue={region}>
              <option value="">Semua</option>
              <option value="id">Indonesia</option>
              <option value="world">Luar Indonesia</option>
            </select>
          </label>
          <label className="check">
            <input name="kind" type="checkbox" value="intern" defaultChecked={intern} /> Hanya magang
          </label>
          <label className="check">
            <input name="saved" type="checkbox" value="1" defaultChecked={saved} /> Wishlist saya ({Number(mine.rows[0].n)})
          </label>
          <button>Terapkan filter</button>
        </form>
      </header>

      <main id="daftar" tabIndex={-1}>
        <p className="count">
          {total} lowongan{q && <> untuk &ldquo;{q}&rdquo;</>}
          {pages > 1 && <>, halaman {page} dari {pages}</>}
        </p>
        {jobs.length ? (
          <ol>
            {jobs.map((j) => (
              <li key={String(j.id)}>
                <a href={String(j.url)} target="_blank" rel="noopener noreferrer">
                  {String(j.title)}
                  <span className="sr-only"> (buka di tab baru)</span>
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
                <form action={toggleWishlist.bind(null, String(j.id))} className="save">
                  <button aria-pressed={!!j.saved} aria-label={`${j.saved ? "Hapus dari wishlist" : "Simpan ke wishlist"}: ${j.title}`}>
                    {j.saved ? "Tersimpan" : "Simpan"}
                  </button>
                </form>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">
            {filtered ? (
              <>Tidak ada lowongan yang cocok. <a href="/">Hapus filter</a>.</>
            ) : (
              <>Database masih kosong. Jalankan <code>/api/crawl</code> sekali untuk mengisinya.</>
            )}
          </p>
        )}
        {pages > 1 && (
          <nav aria-label="Halaman" className="pager">
            {page > 1 && <a href={href(page - 1)} rel="prev">Sebelumnya</a>}
            {nums.map((n, i) => (
              <span key={n} className="num">
                {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden="true">...</span>}
                {n === page ? (
                  <span aria-current="page" className="cur">{n}</span>
                ) : (
                  <a href={href(n)} aria-label={`Halaman ${n}`}>{n}</a>
                )}
              </span>
            ))}
            {page < pages && <a href={href(page + 1)} rel="next">Berikutnya</a>}
          </nav>
        )}
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
