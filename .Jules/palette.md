# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-05-18 - Calendar & Navigation Icon Button Accessibility
**Learning:** Icon/symbol-only navigation controls (like `‹` and `›`) and date grid cells that rely on numerical text alone present significant accessibility barriers for screen readers. Adding explicit descriptive `aria-label`s along with state attributes (`aria-selected`, `aria-pressed`, `aria-expanded`, `aria-current`) dramatically improves navigation context.
**Action:** Always inspect custom calendar and date strip components for symbol-only controls and date cells to ensure clear ARIA descriptions and state bindings.
