# DESIGN.md

Reading this as: Curated job and internship aggregator for Indonesian tech job seekers, in a modern minimalist style (slate/zinc monochrome, refined 8-10px border radius, high-readability card surfaces, eliminating harsh dated brutalist boxiness while strictly avoiding generic AI slop), with human and conversational Indonesian copywriting, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Visual & Identity Decisions

| Decision | Reason |
|---|---|
| Modern minimalist palette: Zinc neutral scale (`#09090b` / `#121215` / `#18181b` dark, `#ffffff` / `#fafafa` / `#f4f4f5` light, hairline border `#27272a` / `#e4e4e7`) | Crisp legibility, eliminates dated harsh wireframe contrast, passes WCAG AAA (>14:1) for primary text and WCAG AA (>5.5:1) for secondary text. |
| Refined border radius scale (12px deck/empty state, 10px job cards, 8px inputs/buttons/selects, 6px badges/chips) | Replaces dated retro 2px sharp brutalist corners with contemporary modern minimalism without falling into generic pill-shape slop (R-11). |
| Structural card layout with balanced spacing (filling blank gaps) | Solves the awkward empty space between title and buttons by structuring job cards with a clear metadata header, title, company/location details, and action cluster. |
| Multi-attribute sorting (Terbaru/Desc as default, Terlama/Asc, Posisi A-Z, Perusahaan A-Z) | Gives users explicit control over chronological and alphabetical discovery with immediate visual feedback in the count summary (C-2). |
| Zero gradients, zero glassmorphism, zero radial glow orbs | Strictly complies with R-01, R-10, R-13: every surface is matte, purposeful, and grounded. |
| Prominent manual sync trigger ("Tarik Loker Terbaru") with live timestamp and indicator | Functional transparency (C-2, R-26): users know exactly when data was last crawled and can trigger a refresh on demand. |
| Distinct inline label for "Magang" (Internship) in high-contrast badge | Essential metadata distinguishing internships from full-time roles without decorative clutter (R-09). |
| Accessible >=44px tap targets and visible focus indicators | Mobile accessibility standard (R-03, R-32) ensuring effortless touch and keyboard navigation. |

## Copywriting Direction (Indonesian Tech Job Seeker)

- **Tone**: Witty, conversational, direct, and human Indonesian ("santai tapi solutif", anti-corporate jargon).
- **Hard Anti-Slop Rules**:
  - Zero em dash (`—`) characters (R-02 strictly enforced; use colons, commas, or parentheses).
  - Zero buzzwords: banned words include "revolusioner", "seamless", "AI-powered", "solusi terdepan", "mutakhir" (R-16).
  - Zero fake statistics or fabricated testimonials (R-17, R-18, R-36).
  - Explicit, context-driven CTAs: "Tarik Loker Terbaru", "Simpan Loker", "Cari Loker", "Bersihkan Filter" (R-15).
  - Friendly empty & loading states that explain the exact cause and immediate solution (R-27).

