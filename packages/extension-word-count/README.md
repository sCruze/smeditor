# @smeditor/extension-word-count

word-count extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-word-count @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { WordCountExtension } from "@smeditor/extension-word-count";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [WordCountExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
