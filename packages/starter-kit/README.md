# @smeditor/starter-kit

Curated set of base extensions for SMEditor — the MVP toolset including paragraph, headings, marks, lists, blockquote, code block, horizontal rule, image, table, alignment, markdown shortcuts, placeholder and history.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/starter-kit @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [StarterKit],
});
```

`StarterKit` — это bundle (`{ name, extensions }`), core разворачивает его
сам, поэтому его можно передавать в `extensions` наравне с отдельными
расширениями. Каждое расширение также реэкспортировано поимённо, если нужен
частичный набор.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
