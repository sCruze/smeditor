# @smeditor/extension-background-color

background-color extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-background-color @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { BackgroundColorExtension } from "@smeditor/extension-background-color";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [BackgroundColorExtension],
});

// Fill the selection; the text becomes white or dark automatically so it
// stays readable on the fill.
editor.commands.setBackgroundColor({ color: "#ef4444" });
// Or pick the text colour on the fill yourself.
editor.commands.setBackgroundColor({ color: "#fef08a", textColor: "#1a1a1f" });
editor.commands.unsetBackgroundColor();
```

Renders `<span class="smeditor-fill" style="background-color: …; color: …">`.
Applying a fill removes the text colour and highlight from that range; a
text colour applied afterwards is shown inside the fill.

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
