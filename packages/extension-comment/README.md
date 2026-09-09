# @smeditor/extension-comment

Inline comment threads for SMEditor — mark text and attach discussion threads.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-comment @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { CommentExtension } from "@smeditor/extension-comment";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [CommentExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
