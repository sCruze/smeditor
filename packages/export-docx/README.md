# @smeditor/export-docx

Export a SMEditor document to a Word .docx file (OOXML).

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/export-docx @smeditor/core
```

## Usage

```ts
import { exportDocx } from "@smeditor/export-docx";

const bytes = await exportDocx(editor.getJSON());
```

Возвращает `Uint8Array` с содержимым `.docx` (OOXML) — сохраняйте в файл или
отдавайте как Blob.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
