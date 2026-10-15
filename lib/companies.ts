// Slug -> display name. Slugs verified against the public APIs on 2026-10-15.
// Add a company when its career page links to boards.greenhouse.io/<slug> or jobs.lever.co/<slug>.
export const greenhouse: Record<string, string> = {
  xendit: "Xendit",
  gitlab: "GitLab",
  figma: "Figma",
  stripe: "Stripe",
  airbnb: "Airbnb",
  coinbase: "Coinbase",
  datadog: "Datadog",
  cloudflare: "Cloudflare",
  mongodb: "MongoDB",
  vercel: "Vercel",
  dropbox: "Dropbox",
};

export const lever: Record<string, string> = {
  spotify: "Spotify",
  palantir: "Palantir",
};
