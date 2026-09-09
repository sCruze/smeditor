# @smeditor/extension-table

Table support for SMEditor — insert tables, add/remove rows and columns, header rows.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-table @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { TableExtension } from "@smeditor/extension-table";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [TableExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
