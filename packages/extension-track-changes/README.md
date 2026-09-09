# @smeditor/extension-track-changes

Track changes for SMEditor — insertion / deletion marks with accept/reject.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-track-changes @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { TrackChangesExtension } from "@smeditor/extension-track-changes";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [TrackChangesExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
