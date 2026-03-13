# Design Review Results: /dashboard & / (Landing Page)

**Review Date**: 2026-03-06
**Routes**: `/dashboard`, `/` (Landing Page)
**Focus Areas**: Visual Design (colors, typography, spacing, aesthetics)

> **Note**: This review was conducted through static code analysis only. Visual inspection via browser would provide additional insights into layout rendering, interactive behaviors, and actual appearance.

---

## Summary

Both pages demonstrate a solid foundation with a well-structured design token system (`globals.css`) and consistent use of `oklch`-based theming. However, there are recurring issues across both pages: hardcoded Tailwind raw color utilities are used in place of the defined semantic design tokens (`--success`, `--error`, `--info`), leading to theme-inconsistency risk; button radius and size tokens are applied unevenly between the two header components; and several text sizes fall below readable thresholds for a manufacturing floor context. The landing page additionally suffers from an invisible section background transition and footer that undermines the professional enterprise feel.

---

## Issues

| # | Issue | Criticality | Location |
|---|-------|-------------|----------|
| 1 | `bg-secondary` used as KPI icon background — `--secondary` resolves to near-white (`oklch(0.9595…)`) in light mode, making `text-white` icon invisible (white-on-white) | 🔴 Critical | `apps/frontend/src/app/(authenticated)/dashboard/page.tsx:243` |
| 2 | `text-[10px]` used for stat labels and result badges — below 12px readability floor, especially problematic in a factory/floor environment | 🟠 High | `apps/frontend/src/app/(authenticated)/dashboard/components/InspectSummaryCard.tsx:83,86,90,95,140` |
| 3 | Status badge colors use hardcoded Tailwind palette (`bg-gray-100`, `bg-blue-100`, `bg-green-100`) instead of semantic tokens; will not adapt to future theme changes | 🟠 High | `apps/frontend/src/app/(authenticated)/dashboard/page.tsx:212-215` |
| 4 | `text-blue-600`, `text-green-600`, `text-red-600` used in `InspectSummaryCard` stats and badges instead of `text-info`, `text-success`, `text-error` tokens defined in `globals.css` | 🟠 High | `apps/frontend/src/app/(authenticated)/dashboard/components/InspectSummaryCard.tsx:87,91,95,44-48` |
| 5 | Progress bar track uses `bg-gray-100 dark:bg-gray-800` (InspectSummaryCard) vs. `bg-background` (dashboard progress bar) — two different track colors on the same page | 🟡 Medium | `apps/frontend/src/app/(authenticated)/dashboard/components/InspectSummaryCard.tsx:105` vs `page.tsx:198` |
| 6 | KPI value displayed at `text-lg` (1.125rem) — too small for primary dashboard metric; industry standard for KPI cards is `text-2xl` or larger for at-a-glance readability | 🟡 Medium | `apps/frontend/src/app/(authenticated)/dashboard/page.tsx:49` |
| 7 | `bg-surface` stat cells inside `InspectSummaryCard` (light mode: `oklch(0.96…)`) against card background (white `oklch(1.0…)`) — only ~4% lightness difference, providing near-invisible visual grouping | 🟡 Medium | `apps/frontend/src/app/(authenticated)/dashboard/components/InspectSummaryCard.tsx:81,84,88,92` |
| 8 | Hero CTA button uses `rounded-xl` while Header nav button uses `rounded-lg` — radius inconsistency on the same landing page | 🟠 High | `apps/frontend/src/app/components/LandingHero.tsx:67` vs `LandingHeader.tsx:61` |
| 9 | Feature card `rounded-xl` does not match the design system's `--radius: 0.5rem` (≈ `rounded-md`) token — all interactive cards should use `rounded-(--radius)` or `rounded-lg` consistently | 🟡 Medium | `apps/frontend/src/app/components/LandingFeatures.tsx:82` |
| 10 | Feature card icon backgrounds use per-feature hardcoded Tailwind colors (`bg-blue-500/10`, `bg-amber-500/10`, etc.) rather than semantic tokens — these are invisible in the design system | 🟡 Medium | `apps/frontend/src/app/components/LandingFeatures.tsx:24-59` |
| 11 | Hero → Features section background transition is nearly invisible: `--background` (`oklch(0.9816…)`) vs `bg-surface/50` (`oklch(0.96… / 50%`) — insufficient contrast to signal a section change | 🟡 Medium | `apps/frontend/src/app/components/LandingFeatures.tsx:63` |
| 12 | Landing header logo (`w-9 h-9 rounded-lg`) vs app header logo (`w-8 h-8 rounded-md`) — different sizes and radii across two branded headers create brand inconsistency | ⚪ Low | `apps/frontend/src/app/components/LandingHeader.tsx:47-48` vs `src/components/layout/Header.tsx:68-69` |
| 13 | `shadow-lg shadow-primary/25` in Hero CTA — in Tailwind v4 `shadow-lg` maps to the v3 `shadow-xl` scale; shadow may render heavier than intended | ⚪ Low | `apps/frontend/src/app/components/LandingHero.tsx:70` |
| 14 | `leading-tight` applied to Korean hero title — Korean glyphs have tall ink bounds; tight line-height can cause visual cramping at `text-5xl`/`text-6xl` on small screens; prefer `leading-snug` or `leading-normal` | ⚪ Low | `apps/frontend/src/app/components/LandingHero.tsx:46-47` |
| 15 | `LandingFooter` contains only copyright text — no nav links (docs, privacy, contact); undersells the professional enterprise character of the product | ⚪ Low | `apps/frontend/src/app/components/LandingFooter.tsx` |
| 16 | Hero background decoration uses `bg-primary/5` — 5% opacity is visually imperceptible on most displays; increase to `/10` or `/15` for meaningful atmospheric depth | ⚪ Low | `apps/frontend/src/app/components/LandingHero.tsx:31` |
| 17 | Custom user dropdown menu in `Header.tsx` is hand-rolled (fixed overlay + absolute positioning) instead of using shadcn `DropdownMenu` — misses keyboard focus trapping, ARIA roles, and escape-key dismissal | 🟠 High | `apps/frontend/src/components/layout/Header.tsx:168-221` |

---

## Criticality Legend

- 🔴 **Critical**: Breaks functionality or violates visual correctness (e.g., invisible icon)
- 🟠 **High**: Significantly impacts visual quality, UX, or design-system integrity
- 🟡 **Medium**: Noticeable inconsistency that should be addressed in near term
- ⚪ **Low**: Polish and refinement improvements

---

## Next Steps

**Immediate (Critical → High)**:
1. **Issue #1** — Change inventory KPI icon color from `bg-secondary` to a visible token such as `bg-info` or `bg-blue-500`
2. **Issue #2** — Replace all `text-[10px]` with `text-xs` (12px) minimum; consider `text-[11px]` as a minimum intermediate
3. **Issues #3 & #4** — Do a global search for hardcoded `text-blue-600`, `text-green-600`, `text-red-600`, `bg-green-50`, `bg-red-50` etc. and replace with design tokens: `text-info`, `text-success`, `text-error`, `bg-success/10`, `bg-error/10`
4. **Issue #8** — Standardise all buttons on the landing page to use `rounded-lg` (matching `--radius` = 0.5rem)
5. **Issue #17** — Replace custom dropdown with shadcn `DropdownMenu` component

**Short Term (Medium)**:
6. **Issue #5** — Unify progress bar track color to a single token: `bg-border` or `bg-muted`
7. **Issue #6** — Increase KPI card values from `text-lg` to `text-2xl font-bold`
8. **Issue #7** — Increase `InspectSummaryCard` stat cells contrast: use `bg-muted` instead of `bg-surface`, or add a `border border-border` outline
9. **Issues #9 & #11** — Use `rounded-[var(--radius)]` on feature cards; add a `border-t-2 border-border` or a subtle gradient divider between Hero and Features sections

**Polish (Low)**:
10. **Issues #12 & #16** — Standardise logo sizing to `w-8 h-8 rounded-md` in both headers; bump hero decorations to `bg-primary/10`
11. **Issue #14** — Change hero title to `leading-snug`
12. **Issue #15** — Add 2–3 footer links (e.g., Docs, Privacy, Contact)
