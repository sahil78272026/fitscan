## 2025-03-08 - Accessible Expandable Cards
**Learning:** Clickable card containers (`<div onClick=...>`) used for expanding/collapsing content are inaccessible to keyboard and screen reader users without proper ARIA attributes and keyboard handlers.
**Action:** Always add `role="button"`, `tabIndex={0}`, `aria-expanded`, descriptive `aria-label`, and `onKeyDown` handlers (for Enter and Space keys) on interactive card elements, while ensuring nested interactive elements stop event propagation.
