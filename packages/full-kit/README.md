# @smeditor/full-kit

FullKit bundle — StarterKit plus MVP-safe rich formatting, typography, colors, indent and word count.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/full-kit @smeditor/core
```

## Usage

```ts
import { createEditor } from "@smeditor/core";
import { FullKit } from "@smeditor/full-kit";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: [FullKit],
});
```

`FullKit` включает весь `@smeditor/starter-kit` плюс inline-code, sub/superscript,
подсветку, цвет текста и фона, обводку, отступы, шрифт, кегль, межстрочный
интервал и счётчик слов. Дублирования расширений нет — StarterKit переиспользуется.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
