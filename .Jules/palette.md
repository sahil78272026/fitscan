## 2025-05-18 - Avoid Role="Button" on Containers with Interactive Children
**Learning:** Adding `role="button"` or keydown handlers to container `div`s that contain nested `<button>`s (like a delete icon button) breaks ARIA standards (interactive elements must not contain interactive descendants) and causes keyboard event bubbling issues (e.g. Space key triggering card expansion when trying to click the delete button).
**Action:** Use separate semantic `<button>` controls for expanding/collapsing details instead of making the parent container a button.
