# @smeditor/extension-list-item

list-item extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-list-item @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { ListItemExtension } from "@smeditor/extension-list-item";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [ListItemExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
