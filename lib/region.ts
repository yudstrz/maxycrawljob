// Match on the free-text location field, so no schema change or re-crawl is needed.
// ponytail: keyword match; remote jobs open to Indonesia but labeled "Worldwide" count as luar Indonesia.
const KEYWORDS = [
  "indonesia", "jakarta", "bandung", "surabaya", "bali", "denpasar", "yogyakarta", "medan", "semarang",
  "tangerang", "bekasi", "depok", "bogor", "batam", "malang", "makassar",
];

export const INDONESIA_SQL = KEYWORDS.map((k) => `location LIKE '%${k}%'`).join(" OR ");
