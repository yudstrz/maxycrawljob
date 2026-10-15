import * as cheerio from "cheerio";
import { isIntern } from "./intern.ts";
import type { Job } from "./sources.ts";

// User-Agent rotation to minimize anti-bot blocks (from vero-ai-maxy pattern)
export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

export function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string | number);
  return isNaN(+d) ? null : d.toISOString();
};

export async function fetchHtml(url: string, timeoutMs = 3500): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": getRandomUA(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`fetchHtml ${url} -> ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`fetchHtml ${url} -> non-HTML content-type (${contentType})`);
  }

  return res.text();
}

function extractJobPostingsFromRaw(obj: unknown): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) {
    return obj.flatMap(extractJobPostingsFromRaw);
  }
  if (typeof obj !== "object") return [];

  const record = obj as Record<string, any>;
  const type = record["@type"];
  const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));

  if (isJobPosting) {
    return [record];
  }

  if (Array.isArray(record["@graph"])) {
    return record["@graph"].flatMap(extractJobPostingsFromRaw);
  }

  if (Array.isArray(record.itemListElement)) {
    return record.itemListElement.flatMap((item: any) => {
      if (item && item.item) return extractJobPostingsFromRaw(item.item);
      return extractJobPostingsFromRaw(item);
    });
  }

  return [];
}

export function parseJsonLdJobs(
  html: string,
  options: {
    source: string;
    baseUrl: string;
    fallbackCompany?: string;
  },
): Job[] {
  const $ = cheerio.load(html);
  const jobs: Job[] = [];
  const seenIds = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const rawText = $(el).text().trim();
      if (!rawText) return;
      const parsed = JSON.parse(rawText);
      const rawPostings = extractJobPostingsFromRaw(parsed);

      for (const p of rawPostings) {
        const title = String(p.title || p.name || "").trim();
        if (!title) continue;

        const company =
          String(p.hiringOrganization?.name || (typeof p.hiringOrganization === "string" ? p.hiringOrganization : "") || options.fallbackCompany || "Perusahaan").trim();

        let rawUrl = String(p.url || p.sameAs || options.baseUrl).trim();
        try {
          rawUrl = new URL(rawUrl, options.baseUrl).toString();
        } catch {}

        const identifierValue = p.identifier?.value || (typeof p.identifier === "string" ? p.identifier : null);
        const rawId = identifierValue || rawUrl || `${company}-${title}`;
        const stableId = String(rawId).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 120);
        const finalId = `${options.source}:${stableId}`;

        if (seenIds.has(finalId)) continue;
        seenIds.add(finalId);

        let location = "Indonesia";
        if (p.jobLocationType === "TELECOMMUTE") {
          location = "Remote";
        } else if (p.jobLocation?.address) {
          const addr = p.jobLocation.address;
          if (typeof addr === "string") {
            location = addr;
          } else {
            location = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") || "Indonesia";
          }
        } else if (p.applicantLocationRequirements?.name) {
          location = String(p.applicantLocationRequirements.name);
        }

        const employmentTypeStr = Array.isArray(p.employmentType) ? p.employmentType.join(" ") : String(p.employmentType || "");
        const internFlag =
          employmentTypeStr.toUpperCase().includes("INTERN") ||
          isIntern(`${title} ${p.description || ""} ${employmentTypeStr}`);

        jobs.push({
          id: finalId,
          company,
          title,
          location,
          url: rawUrl,
          isIntern: internFlag,
          postedAt: iso(p.datePosted),
        });
      }
    } catch {
      // Malformed json-ld script tag ignored
    }
  });

  return jobs;
}

export type ScrapeSourceConfig = {
  source: string;
  url: string;
  fallbackCompany?: string;
  fallbackSelectorParser?: ($: cheerio.CheerioAPI, baseUrl: string) => Job[];
};

export async function scrapeJobSource(config: ScrapeSourceConfig): Promise<Job[]> {
  const html = await fetchHtml(config.url);
  const jsonLdJobs = parseJsonLdJobs(html, {
    source: config.source,
    baseUrl: config.url,
    fallbackCompany: config.fallbackCompany,
  });

  if (jsonLdJobs.length > 0) {
    return jsonLdJobs;
  }

  if (config.fallbackSelectorParser) {
    const $ = cheerio.load(html);
    return config.fallbackSelectorParser($, config.url);
  }

  return [];
}
