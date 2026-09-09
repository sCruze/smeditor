# SMEditor — исправления этой итерации

Сделано по загруженному ТЗ и проверке текущего архива.

## Что исправлено

- Таблицы теперь входят в `StarterKit`, поэтому кнопка создания таблицы доступна и в Standard, и в Full режиме playground.
- Убрано дублирование `TableExtension` в `FullKit`: FullKit получает таблицы через StarterKit, без повторной регистрации schema node.
- `useEditor` теперь пересоздаёт editor instance при смене набора extensions (`StarterKit` ↔ `FullKit`) и сохраняет текущий документ. Раньше UI переключался в Full, но editor оставался со старыми commands, поэтому `insertTable`, `setTextColor` и другие full-tools могли не работать.
- Deep selection нормализуется после command-dispatch. После вставки таблицы или оборачивания в blockquote selection переводится к реальному editable leaf-блоку, а не остаётся на контейнере.
- `leafBlocksInSelection` теперь учитывает descendants выбранного контейнера. Это исправляет применение выравнивания, цветов, line-height и indent внутри blockquote/table/list.
- `selectionInsideWrapper` теперь смотрит всю ancestor-chain, поэтому toolbar state корректно определяется внутри вложенных структур.
- HTML-парсер теперь собирает несколько marks с одного элемента. Например, `<span style="color:...; background-color:...">` больше не теряет один из marks.
- `text_color`, `background_color`, `font_family`, `font_size` теперь парсятся не только со `span`, но и с других HTML-элементов со style.
- Добавлен новый пакет `@smeditor/extension-text-stroke` для обводки/outline текста.
- Добавлена кнопка `TextStrokeButton` в `@smeditor/react` и playground.
- Paste sanitizer теперь сохраняет безопасные стили, нужные для цветов, шрифтов, line-height и text-stroke.
- Blockquote CSS исправлен так, чтобы внутренний paragraph не уезжал визуально вниз из-за margin.
- Playground по умолчанию открывается в Full edition, но таблицы работают и в Standard.
- Playground dependencies/aliases обновлены для `full-kit`, markdown/comment imports и нового text-stroke package.
- Next.js example расширил `transpilePackages`, чтобы StarterKit graph работал без предварительной сборки dist.

## Проверка

Локально выполнен TypeScript check для пакетов:

- `packages/core`
- `packages/extension-text-color`
- `packages/extension-background-color`
- `packages/extension-highlight`
- `packages/extension-text-stroke`
- `packages/extension-table`
- `packages/starter-kit`
- `packages/full-kit`
- дополнительно `extension-font-family` и `extension-font-size`

`packages/react` не удалось проверить в этом sandbox через `tsc`, потому что в распакованном архиве отсутствует корневой `node_modules` с `react` / `@types/react`; это состояние было в архиве до исправлений. После `pnpm install` проверка React-пакета должна запускаться штатно.
