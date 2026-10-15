import assert from "node:assert/strict";
import { parseJsonLdJobs, getRandomUA, USER_AGENTS } from "./scraper.ts";

// Test 1: Random UA
assert(USER_AGENTS.includes(getRandomUA()), "Random UA should belong to pool");

// Test 2: Single JobPosting
const htmlSingle = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "Frontend Engineer",
    "hiringOrganization": {
      "@type": "Organization",
      "name": "Tech Corp Indonesia"
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "addressLocality": "Jakarta",
        "addressCountry": "ID"
      }
    },
    "url": "https://techcorp.id/jobs/fe-101",
    "datePosted": "2026-10-10T08:00:00Z",
    "identifier": {
      "value": "fe-101"
    }
  }
  </script>
</head>
<body><h1>Careers</h1></body>
</html>
`;

const jobs1 = parseJsonLdJobs(htmlSingle, {
  source: "techcorp",
  baseUrl: "https://techcorp.id/careers",
});

assert.equal(jobs1.length, 1);
assert.equal(jobs1[0].id, "techcorp:fe-101");
assert.equal(jobs1[0].title, "Frontend Engineer");
assert.equal(jobs1[0].company, "Tech Corp Indonesia");
assert.equal(jobs1[0].location, "Jakarta, ID");
assert.equal(jobs1[0].isIntern, false);
assert.equal(jobs1[0].postedAt, "2026-10-10T08:00:00.000Z");

// Test 3: @graph with multiple postings & internship detection
const htmlGraph = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "Startup Kita"
      },
      {
        "@type": "JobPosting",
        "title": "UI/UX Design Intern",
        "hiringOrganization": "Startup Kita",
        "jobLocationType": "TELECOMMUTE",
        "url": "/jobs/uiux-intern",
        "employmentType": "INTERN",
        "datePosted": "2026-10-14"
      },
      {
        "@type": "JobPosting",
        "title": "Backend Lead",
        "hiringOrganization": { "name": "Startup Kita" },
        "jobLocation": { "address": "Bandung" },
        "url": "/jobs/backend-lead",
        "employmentType": "FULL_TIME",
        "datePosted": "2026-10-12"
      }
    ]
  }
  </script>
</head>
</html>
`;

const jobs2 = parseJsonLdJobs(htmlGraph, {
  source: "startupkita",
  baseUrl: "https://startupkita.id/careers",
});

assert.equal(jobs2.length, 2);
assert.equal(jobs2[0].title, "UI/UX Design Intern");
assert.equal(jobs2[0].isIntern, true);
assert.equal(jobs2[0].location, "Remote");
assert.equal(jobs2[0].url, "https://startupkita.id/jobs/uiux-intern");

assert.equal(jobs2[1].title, "Backend Lead");
assert.equal(jobs2[1].isIntern, false);
assert.equal(jobs2[1].location, "Bandung");

// Test 4: ItemList format
const htmlItemList = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "JobPosting",
        "title": "Magang Data Analyst",
        "hiringOrganization": { "name": "Fintech Nusantara" },
        "url": "https://fintech.id/jobs/da-intern"
      }
    ]
  }
  </script>
</head>
</html>
`;

const jobs3 = parseJsonLdJobs(htmlItemList, {
  source: "fintech",
  baseUrl: "https://fintech.id",
});

assert.equal(jobs3.length, 1);
assert.equal(jobs3[0].title, "Magang Data Analyst");
assert.equal(jobs3[0].isIntern, true);

// Test 5: Google Jobs silent fallback without API key
const { fetchGoogleJobs } = await import("./sources.ts");
const googleJobs = await fetchGoogleJobs();
assert(Array.isArray(googleJobs), "Google jobs without key must return array");
assert.equal(googleJobs.length, 0, "Google jobs without key should return empty array");

console.log("scraper tests passed!");
