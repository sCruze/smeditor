# @smeditor/extension-task-list

task-list extension for SMEditor.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/extension-task-list @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { TaskListExtension } from "@smeditor/extension-task-list";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [TaskListExtension],
});
```

Расширение уже входит в `@smeditor/starter-kit` или `@smeditor/full-kit` —
ставьте его отдельно только при сборке собственного набора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
