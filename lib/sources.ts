import { greenhouse, lever } from "./companies";
import { isIntern } from "./intern";

export type Job = {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  isIntern: boolean;
  postedAt: string | null;
};

type Json = any;

const get = async (url: string): Promise<Json> => {
  const r = await fetch(url, { headers: { "User-Agent": "maxycrawljob (personal job aggregator)" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};

const iso = (v: unknown) => {
  const d = new Date(v as string | number);
  return isNaN(+d) ? null : d.toISOString();
};

const job = (source: string, id: unknown, company: string, title: string, location: string, url: string, posted: unknown, extra = ""): Job => ({
  id: `${source}:${id}`,
  company,
  title,
  location,
  url,
  isIntern: isIntern(`${title} ${extra}`),
  postedAt: iso(posted),
});

// key = what lands in jobs.source. Per-company keys so one dead board never wipes the others.
export const sources: [string, () => Promise<Job[]>][] = [
  ...Object.entries(greenhouse).map(([slug, name]): [string, () => Promise<Job[]>] => [
    `greenhouse:${slug}`,
    async () =>
      (await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)).jobs.map((j: Json) =>
        job(`greenhouse:${slug}`, j.id, j.company_name ?? name, j.title, j.location?.name ?? "", j.absolute_url, j.first_published ?? j.updated_at),
      ),
  ]),
  ...Object.entries(lever).map(([slug, name]): [string, () => Promise<Job[]>] => [
    `lever:${slug}`,
    async () =>
      (await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)).map((j: Json) =>
        job(`lever:${slug}`, j.id, name, j.text, j.categories?.location ?? "", j.hostedUrl, j.createdAt, j.categories?.commitment ?? ""),
      ),
  ]),
  [
    "remotive",
    async () =>
      (await get("https://remotive.com/api/remote-jobs")).jobs.map((j: Json) =>
        job("remotive", j.id, j.company_name, j.title, j.candidate_required_location ?? "Remote", j.url, j.publication_date, j.job_type ?? ""),
      ),
  ],
  [
    "arbeitnow",
    // ponytail: first page only (~100 jobs, Germany/Europe), follow links.next if it matters
    async () =>
      (await get("https://www.arbeitnow.com/api/job-board-api")).data.map((j: Json) =>
        job("arbeitnow", j.slug, j.company_name, j.title, j.location ?? "", j.url, (j.created_at ?? 0) * 1000, (j.job_types ?? []).join(" ")),
      ),
  ],
  [
    "remoteok",
    async () =>
      (await get("https://remoteok.com/api"))
        .filter((j: Json) => j.id) // element 0 is the legal notice
        .map((j: Json) => job("remoteok", j.id, j.company, j.position, j.location || "Remote", j.url, j.date)),
  ],
];
