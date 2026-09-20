---
"@smeditor/core": minor
"@smeditor/extension-background-color": minor
"@smeditor/extension-underline": minor
"@smeditor/extension-text-color": patch
"@smeditor/extension-strike": patch
"@smeditor/react": minor
"@smeditor/theme-default": patch
---

Colour tools: text colour, fill with readable text, underline colour.

- Core: `contrastTextColor(fill)`; `MarkSpec.rank` sets the nesting order of marks (text colour inside fills, underline / strike innermost so their line matches the text); paste keeps `text-decoration-color`.
- Background colour is a fill: `setBackgroundColor({ color, textColor? })` renders `<span class="smeditor-fill" style="background-color; color">` with an automatic contrast text colour and clears text colour / highlight on the range.
- Underline: `setUnderlineColor({ color })`, `unsetUnderlineColor()`; `<u style="text-decoration-color">` round-trips.
- React: `BackgroundColorButton` is "Fill" with Auto / White / Dark text options, new `UnderlineColorButton`; the BubbleMenu shows text colour, fill and underline colour.
