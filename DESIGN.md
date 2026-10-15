# DESIGN.md

Reading this as: Curated job and internship aggregator for Indonesian tech job seekers, in a monochrome minimalist (high-contrast black and white ledger) style, with human and witty tech-unicorn copywriting (Gojek / Grab tone), dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Visual & Identity Decisions

| Decision | Reason |
|---|---|
| Pure monochrome palette: crisp white `#ffffff` paper, deep black `#111111` ink, hairline boundary `#e2e2e2` (light) / `#0d0d0d` background, `#f4f4f4` text, `#262626` rule (dark) | High readability, zero distracting color slop, passes WCAG AAA contrast (>13:1). |
| Zero gradients, zero glassmorphism, zero radial glow orbs | Strictly complies with R-01, R-10, R-13: every surface is matte, purposeful, and grounded. |
| Sharp 2px to 4px border radius for interactive elements | Replaces pill buttons everywhere (R-11). Deliberate tactile button feel. |
| Stark hairline borders and ruled list structure | Mimics clean printed financial or editorial ledgers; organizes high-density job data without heavy floating card shadows (R-12). |
| Prominent manual sync trigger ("Tarik Loker Terbaru") with live timestamp | Functional transparency (C-2, R-26): users know exactly when data was last crawled and can trigger a refresh on demand. |
| Distinct inline label for "Magang" (Internship) in high-contrast inverted badge | Essential metadata distinguishing internships from full-time roles without decorative clutter (R-09). |
| Whole row clickable anchor with >=44px tap targets | Mobile accessibility standard (R-03) ensuring effortless thumb tapping. |

## Copywriting Direction (Gojek / Grab Style)

- **Tone**: Witty, conversational, direct, and human Indonesian ("santai tapi solutif", anti-corporate jargon).
- **Hard Anti-Slop Rules**:
  - Zero em dash (`—`) characters (R-02 strictly enforced; use colons, commas, or parentheses).
  - Zero buzzwords: banned words include "revolusioner", "seamless", "AI-powered", "solusi terdepan", "mutakhir" (R-16).
  - Zero fake statistics or fabricated testimonials (R-17, R-18, R-36).
  - Explicit, context-driven CTAs: "Tarik Loker Terbaru", "Simpan Lowongan", "Buka di Sumber Asli" (R-15).
  - Friendly empty & loading states that explain the exact cause and immediate solution (R-27).
