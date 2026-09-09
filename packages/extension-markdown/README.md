# @smeditor/extension-markdown

Markdown input shortcuts for SMEditor — type # for headings, > for quotes, - for lists, and more.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-markdown @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { MarkdownExtension } from "@smeditor/extension-markdown";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [MarkdownExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
