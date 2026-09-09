# @smeditor/extension-mention

@-mentions for SMEditor — insert mention nodes referencing people or items.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-mention @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { MentionExtension } from "@smeditor/extension-mention";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [MentionExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
