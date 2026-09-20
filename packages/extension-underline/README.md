# @smeditor/extension-underline

underline extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-underline @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { UnderlineExtension } from "@smeditor/extension-underline";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [UnderlineExtension],
});

editor.commands.toggleUnderline();
// Underline in a colour of its own (turns the underline on).
editor.commands.setUnderlineColor({ color: "#3b82f6" });
// Back to an underline in the text colour.
editor.commands.unsetUnderlineColor();
```

A coloured underline renders as `<u style="text-decoration-color: …">`.

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
