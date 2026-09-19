## 2025-01-01 - Avoid Nested Interactive Buttons in Expandable Cards
**Learning:** Wrapping an entire container `<div>` with `role="button"` or a `<button>` element when it contains nested action buttons (like a delete button) creates an ARIA anti-pattern and breaks keyboard event bubbling and screen reader content tree calculation.
**Action:** Separate the card header expand/collapse trigger into a dedicated `<button type="button">` alongside sibling action buttons, linking the expandable details panel via `aria-controls`.
