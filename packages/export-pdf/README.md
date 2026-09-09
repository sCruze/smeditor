# @smeditor/export-pdf

Export a SMEditor document to a PDF file (basic text flow).

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/export-pdf @smeditor/core
```

## Usage

```ts
import { exportPdf } from "@smeditor/export-pdf";

const bytes = await exportPdf(editor.getJSON());
```

Возвращает `Uint8Array` с PDF. Раскладка базовая: текстовый поток с переносами.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
