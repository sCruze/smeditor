# @smeditor/extension-highlight

highlight extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-highlight @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { HighlightExtension } from "@smeditor/extension-highlight";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [HighlightExtension],
});

// Coloured highlight; the text becomes white or dark automatically so it
// stays readable on it.
editor.commands.setHighlight({ color: "#1a1a1f" });
// Or choose the text colour on the highlight.
editor.commands.setHighlight({ color: "#fef08a", textColor: "#ef4444" });
editor.commands.unsetHighlight();
```

A coloured highlight renders `<mark style="background-color: …; color: …">`
and replaces the text colour and fill on its range.

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
