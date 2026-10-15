# IMPLEMENTATION.md: HTML Scraper untuk Sumber Loker Baru

Adaptasi teknik scraping dari `vero-ai-maxy` (`lib/scraper.ts`) ke `maxycrawljob`.

## Tujuan

Menambah sumber loker yang tidak punya API JSON, yaitu halaman karir HTML biasa. Tetap kompatibel dengan Vercel serverless (maxDuration 60s, tanpa Chromium).

## Yang Diadopsi dari vero-ai-maxy

| Teknik | Dipakai? | Alasan |
|---|---|---|
| User-Agent rotation + header browser | Ya | Mengurangi 403 dari WAF |
| Cheerio (fetch + parse HTML) | Ya | Ringan, jalan di Vercel |
| JSON-LD `JobPosting` | Ya (baru) | Standar loker, paling akurat |
| Puppeteer | Tidak | Terlalu berat untuk Vercel (limit 50MB) |
| Google Cache fallback | Tidak | Layanan sudah tidak andal |
| LLM fallback | Tidak (opsional nanti) | Risiko data karangan; loker harus faktual |
| BFS crawler | Tidak | Cukup satu halaman daftar loker per sumber |

## Arsitektur

```
sources.ts  --(entry baru)-->  lib/scraper.ts
                                 ├─ getRandomUA()
                                 ├─ fetchHtml(url)
                                 └─ scrapeJobPostings(url) -> Job[]
                                       1. JSON-LD JobPosting (utama)
                                       2. Selector CSS per sumber (fallback)
crawler.ts (tidak berubah): Promise.all -> batch upsert Turso
```

`runCrawl` sudah menangani error per sumber, jadi sumber scraping yang gagal tidak mengganggu sumber lain.

## Langkah

1. **Install dependensi**
   ```bash
   npm install cheerio
   ```
2. **Buat `lib/scraper.ts`**
   - `USER_AGENTS` (3 UA) dan `getRandomUA()`.
   - `fetchHtml(url)`: header `Accept`, `Accept-Language: id-ID`, `Sec-Fetch-*`, timeout `AbortSignal.timeout(3500)` (sama dengan `get` di `sources.ts`), tolak jika bukan `text/html`.
   - `scrapeJobPostings(url, fallback?)`:
     - Load HTML dengan `cheerio`.
     - Iterasi `script[type="application/ld+json"]`, parse JSON, ambil objek `@type === "JobPosting"` (cek array, `@graph`, dan `ItemList`).
     - Map ke tipe `Job`: `title`, `hiringOrganization.name`, `jobLocation.address.addressLocality` (fallback "Indonesia"), `url`, `datePosted`.
     - Jika tidak ada JSON-LD, pakai fallback selector yang dikirim per sumber.
3. **Daftarkan sumber di `lib/sources.ts`**
   - Tambah entry `[ "nama-sumber", () => scrapeJobPostings(URL) ]` ke array `sources`.
   - Gunakan helper `job()` agar `id`, `isIntern`, dan `postedAt` konsisten.
   - Tambah label di `formatSourceLabel` (`lib/crawler.ts`).
4. **Test**
   - Tambah `lib/scraper.test.ts` (pola seperti `intern.test.ts`) dengan HTML fixture berisi JSON-LD, array JSON-LD, dan `@graph`.
   - Jalankan `npm run build` untuk cek tipe.
5. **Verifikasi manual**: tekan tombol "Tarik Loker Terbaru", cek progress SSE dan hasil di tabel `jobs`.

## Aturan dan Batasan

- Hormati `robots.txt` dan ToS tiap situs sebelum menambah sumber. Pilih halaman karir publik.
- Satu request per sumber per crawl. Tidak ada crawling dalam.
- Timeout 3.5 detik per request supaya total tetap di bawah 60 detik.
- `id` loker wajib stabil: `${source}:${id}`, ambil dari `identifier`/URL, bukan indeks array.
- Jika sumber butuh JavaScript rendering, tunda. Opsi nanti: `@sparticuz/chromium` + `puppeteer-core` atau layanan scraping eksternal.
- Salin komentar bergaya `ponytail:` untuk shortcut yang sengaja diambil.

## Kriteria Selesai

- [x] `cheerio` terpasang
- [x] `lib/scraper.ts` dengan UA rotation dan parser JSON-LD
- [x] Minimal satu sumber HTML terdaftar di `sources.ts` (`html:jobspresso`)
- [x] Label sumber ada di `formatSourceLabel` (`lib/crawler.ts`)
- [x] Unit test parser lulus (`lib/scraper.test.ts`)
- [x] `npm run build` bersih
- [x] Crawl terintegrasi tanpa merusak sumber lain

## Pertanyaan Terbuka

- Situs karir mana yang jadi sumber pertama?
- Perlu fallback LLM untuk halaman tanpa JSON-LD?
