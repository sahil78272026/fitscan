# Palette's Journal

## 2025-05-18 - Keyboard Navigation & ARIA Labels on Expandable Cards
**Learning:** Expandable card components that double as interactive containers often lack proper keyboard handlers (`Enter`/`Space`) and `aria-expanded` state attributes, making them inaccessible to keyboard and screen reader users. Furthermore, icon-only action buttons inside such containers (like a delete button) require explicit `aria-label`s to prevent generic screen reader output.
**Action:** Always add `role="button"`, `tabIndex={0}`, `aria-expanded`, keyboard event handlers (`onKeyDown`), and explicit `aria-label`s when converting clickable card containers into interactive components.
