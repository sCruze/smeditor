---
"@smeditor/extension-highlight": minor
"@smeditor/extension-text-color": patch
"@smeditor/react": patch
---

Coloured highlights keep the text readable.

- `setHighlight({ color, textColor? })` renders `<mark style="background-color; color">` with an automatic contrast text colour (or `textColor`) and clears text colour / fill on the range.
- The text-colour mark no longer reads a `<mark>`'s own colour as a separate text colour.
- React `HighlightButton` gets "Text on highlight" Auto / White / Dark options.
