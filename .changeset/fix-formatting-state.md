---
"@smeditor/core": minor
"@smeditor/react": patch
"@smeditor/theme-default": patch
---

Show the current formatting in toolbars and fix confusing colour/outline behaviour.

- Core: a bare caret now targets the word under it for mark commands and `isActive`; new `editor.getMarkAttributes(name)` and `selectionMarkAttrs()` expose the current mark attrs (colour, font, size); equal neighbouring marks render as one element in a stable nesting order.
- React: colour pickers show the applied colour on the trigger and in the palette with a labelled remove button; text outline gets its own icon and width options; Font/Size/Spacing show the current value; the default BubbleMenu adds inline code, text colour, highlight and clear formatting.
- Theme: styles for the colour indicator and colour panel, compact bubble menu dividers.
