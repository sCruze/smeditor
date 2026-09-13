# @smeditor/theme-default

Default CSS theme for SMEditor editor and toolbar.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/theme-default
```

## Usage

```ts
import "@smeditor/theme-default";           // весь дефолтный стиль
import "@smeditor/theme-default/tokens.css"; // только CSS-переменные
```

Пакет содержит только CSS: токены дизайна и стили классов
`.smeditor`, `.smeditor-content`, `.smeditor-toolbar`, `.smeditor-button`.

Светлая тема используется по умолчанию. Для тёмной темы передайте
`theme: "dark"` при инициализации редактора либо задайте
`data-theme="dark"` на обёртке редактора.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
