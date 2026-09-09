# @smeditor/extension-code-block

code-block extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-code-block @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { CodeBlockExtension } from "@smeditor/extension-code-block";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [CodeBlockExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
