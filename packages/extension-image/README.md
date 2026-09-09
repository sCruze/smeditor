# @smeditor/extension-image

Image node for SMEditor — insert by URL or upload, with alt text and alignment.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-image @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { ImageExtension } from "@smeditor/extension-image";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [ImageExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
