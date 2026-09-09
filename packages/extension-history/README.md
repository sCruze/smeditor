# @smeditor/extension-history

Undo/redo extension for SMEditor (the underlying history stack lives in core; this package is the conventional opt-in).

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-history @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { HistoryExtension } from "@smeditor/extension-history";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [HistoryExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
