## 2025-05-18 - Icon-Only Buttons and ARIA Labels
**Learning:** Icon-only buttons with `title` attributes may display tooltips on hover but are not consistently announced by screen readers without an explicit `aria-label`.
**Action:** Always add `aria-label` to icon-only interactive buttons in components like `MealCard.jsx`.
