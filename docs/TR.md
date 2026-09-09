# Техническое ТЗ для ИИ: библиотека SMEditor

## 1. Краткое описание

Нужно спроектировать и постепенно реализовать отдельную библиотеку текстового редактора.

Рабочее название библиотеки: **SMEditor**.

SMEditor — это самостоятельная библиотека rich text editor / block editor. Она НЕ связана с AdminPanel-библиотекой Admivyx и не должна иметь с ней общего ядра, бизнес-логики или зависимостей.

Цель: создать современный текстовый редактор, который можно подключать через npm, использовать в React/Vue/других frontend-приложениях, расширять через extensions/plugins, а при необходимости интегрировать в Rails через отдельный gem.

---

## 2. Главная цель

Создать библиотеку, которую можно использовать так:

```bash
npm install @smeditor/react @smeditor/starter-kit
```

Пример использования:

```tsx
import { Editor } from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

export default function Page() {
  return (
    <Editor
      extensions={[StarterKit]}
      content="<p>Hello world</p>"
      onUpdate={({ html, json }) => {
        console.log(html, json);
      }}
    />
  );
}
```

Для Rails-интеграции в будущем:

```ruby
gem "smeditor"
```

Пример Rails helper:

```erb
<%= smeditor_editor form, :content %>
```

---

## 3. Важное правило архитектуры

SMEditor — отдельный продукт.

Нельзя смешивать его с Admivyx.

Нельзя создавать общий core между SMEditor и Admivyx.

Допустимы только общие технические настройки на уровне организации, например:

- eslint config
- prettier config
- tsconfig
- GitHub Actions templates
- docs theme
- design tokens без бизнес-логики

Нельзя выносить в общий пакет:

- editor schema
- document model
- plugin system
- admin resources
- CRUD logic
- permissions logic
- rendering logic редактора
- commands редактора

---

## 4. Рекомендуемый репозиторий

Создать отдельный репозиторий:

```txt
github.com/YOUR_ORG/smeditor
```

Репозиторий должен быть monorepo, потому что внутри редактора будет несколько пакетов.

Рекомендуемая структура:

```txt
smeditor/
├─ apps/
│  ├─ docs/
│  ├─ playground/
│  └─ demo/
│
├─ packages/
│  ├─ core/
│  ├─ react/
│  ├─ vue/
│  ├─ starter-kit/
│  ├─ extension-bold/
│  ├─ extension-italic/
│  ├─ extension-underline/
│  ├─ extension-link/
│  ├─ extension-image/
│  ├─ extension-table/
│  ├─ extension-code-block/
│  ├─ extension-placeholder/
│  └─ theme-default/
│
├─ gems/
│  └─ smeditor/
│
├─ examples/
│  ├─ nextjs/
│  ├─ react/
│  ├─ vue/
│  └─ rails/
│
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ README.md
└─ LICENSE
```

---

## 5. Назначение пакетов

### packages/core

Главное ядро SMEditor.

Не должно зависеть от React, Vue, Rails, Next.js или конкретного framework.

Отвечает за:

- editor instance
- document model
- schema
- commands
- transactions
- selection
- history
- serialization
- extension/plugin API
- events
- state management
- input rules
- keyboard shortcuts
- HTML/JSON/Markdown conversion

Пример API:

```ts
import { createEditor } from "@smeditor/core";

const editor = createEditor({
  content: "<p>Hello</p>",
  extensions: []
});
```

---

### packages/react

React-обёртка над core.

Отвечает за:

- Editor component
- EditorContent
- hooks
- provider
- toolbar bindings
- reactive state
- lifecycle integration

Пример:

```tsx
import { Editor, useEditor } from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

const editor = useEditor({
  extensions: [StarterKit],
  content: "<p>Hello</p>"
});
```

---

### packages/vue

Vue-обёртка над core.

Не обязательно для MVP, но архитектура должна позволять добавить Vue позже.

---

### packages/starter-kit

Набор базовых extensions.

В starter-kit должны входить:

- paragraph
- heading
- bold
- italic
- underline
- link
- bullet list
- ordered list
- blockquote
- code block
- history
- hard break

Пример:

```ts
import { StarterKit } from "@smeditor/starter-kit";

<Editor extensions={[StarterKit]} />
```

---

### extension-пакеты

Каждая важная функция должна быть отдельным extension-пакетом.

Примеры:

```txt
@smeditor/extension-bold
@smeditor/extension-italic
@smeditor/extension-link
@smeditor/extension-image
@smeditor/extension-table
@smeditor/extension-code-block
@smeditor/extension-placeholder
```

Пример подключения:

```tsx
import { ImageExtension } from "@smeditor/extension-image";
import { TableExtension } from "@smeditor/extension-table";

<Editor
  extensions={[
    StarterKit,
    ImageExtension.configure({
      uploadUrl: "/api/uploads"
    }),
    TableExtension
  ]}
/>
```

---

### gems/smeditor

Rails gem нужен только как интеграция.

Сам редактор должен оставаться frontend/npm-библиотекой.

Gem может давать:

- form helper
- asset integration
- initializer
- upload endpoint
- ActiveStorage integration
- sanitization helper
- content renderer

Пример:

```ruby
SMEditor.configure do |config|
  config.uploads = :active_storage
  config.sanitize_output = true
end
```

---

## 6. MVP-функции первой версии

Первая рабочая версия должна включать:

1. Editor core
2. React package
3. StarterKit
4. Paragraph
5. Heading
6. Bold
7. Italic
8. Link
9. Bullet list
10. Ordered list
11. Blockquote
12. Code block
13. Undo/redo
14. HTML input/output
15. JSON document output
16. Basic toolbar
17. Placeholder
18. Документация
19. Playground
20. Example Next.js

---

## 7. Extension API

SMEditor должен быть extension-based.

Пример интерфейса:

```ts
export interface Extension {
  name: string;

  schema?: Record<string, unknown>;

  commands?: Record<string, EditorCommand>;

  keyboardShortcuts?: Record<string, EditorCommand>;

  inputRules?: InputRule[];

  renderHTML?: RenderHTMLHandler;

  parseHTML?: ParseHTMLHandler;

  configure?: (options: Record<string, unknown>) => Extension;
}
```

Пример extension:

```ts
export const BoldExtension = {
  name: "bold",

  commands: {
    toggleBold(editor) {
      return editor.commands.toggleMark("bold");
    }
  },

  keyboardShortcuts: {
    "Mod-b": editor => editor.commands.toggleBold()
  }
};
```

---

## 8. Document model

Нужно заранее определить формат документа.

Минимальный JSON output:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Hello world"
        }
      ]
    }
  ]
}
```

Редактор должен уметь:

- принимать HTML
- принимать JSON
- отдавать HTML
- отдавать JSON
- в будущем отдавать Markdown

---

## 9. Commands

Редактор должен иметь command system.

Примеры команд:

```ts
editor.commands.setContent("<p>Hello</p>");
editor.commands.clearContent();
editor.commands.focus();
editor.commands.blur();
editor.commands.toggleBold();
editor.commands.toggleItalic();
editor.commands.setLink({ href: "https://example.com" });
editor.commands.insertImage({ src: "/image.png" });
```

Команды должны быть typed и расширяемые через extensions.

---

## 10. Events

Нужны базовые события:

```ts
onCreate
onUpdate
onFocus
onBlur
onSelectionUpdate
onTransaction
onDestroy
```

Пример:

```tsx
<Editor
  onUpdate={({ editor, html, json }) => {
    saveContent(json);
  }}
/>
```

---

## 11. Toolbar

Toolbar не должен быть жестко зашит в core.

Правильная схема:

```txt
core — editor state and commands
react — bindings and hooks
ui/theme — ready toolbar components
```

Пример:

```tsx
import { Toolbar, BoldButton, ItalicButton } from "@smeditor/react";

<EditorProvider editor={editor}>
  <Toolbar>
    <BoldButton />
    <ItalicButton />
  </Toolbar>
  <EditorContent />
</EditorProvider>
```

---

## 12. Uploads

Загрузка изображений не должна быть обязательной частью core.

Должен быть extension:

```txt
@smeditor/extension-image
```

Он должен принимать upload handler:

```ts
ImageExtension.configure({
  async upload(file) {
    const result = await uploadToServer(file);
    return {
      src: result.url,
      alt: result.alt
    };
  }
});
```

---

## 13. Collaboration

Совместное редактирование НЕ входит в MVP.

Но архитектура должна учитывать возможность будущих extensions:

```txt
@smeditor/extension-collaboration
@smeditor/extension-comments
@smeditor/extension-track-changes
```

---

## 14. Документация

Нужен отдельный docs app:

```txt
apps/docs
```

Документация должна иметь разделы:

1. Introduction
2. Installation
3. Quick Start
4. Core Concepts
5. Editor Instance
6. Extensions
7. Commands
8. Schema
9. React Usage
10. StarterKit
11. Toolbar
12. HTML/JSON Output
13. Images
14. Custom Extensions
15. Rails Integration
16. API Reference

---

## 15. Принципы разработки

ИИ должен соблюдать следующие правила:

1. Не смешивать SMEditor с Admivyx.
2. SMEditor — отдельная библиотека текстового редактора.
3. Core не должен зависеть от React.
4. React package должен зависеть от core.
5. Extensions должны быть независимыми.
6. StarterKit — это набор extensions, а не отдельное ядро.
7. Toolbar не должен быть частью core.
8. Uploads должны быть extension-based.
9. Collaboration не делать в MVP.
10. Все публичные API должны быть typed.
11. Использовать TypeScript для npm-пакетов.
12. Rails gem делать только как адаптер.
13. Документация должна писаться вместе с API.
14. Сначала сделать стабильную архитектуру, потом UI-полировку.

---

## 16. Публикация пакетов

Предполагаемые npm-пакеты:

```txt
@smeditor/core
@smeditor/react
@smeditor/vue
@smeditor/starter-kit
@smeditor/extension-bold
@smeditor/extension-italic
@smeditor/extension-link
@smeditor/extension-image
@smeditor/extension-table
@smeditor/theme-default
```

Предполагаемый gem:

```txt
smeditor
```

---

## 17. Возможные будущие Pro-функции

Не реализовывать в MVP, но учитывать архитектурно:

- comments
- collaboration
- track changes
- AI writing assistant
- slash commands
- block editor mode
- markdown editor mode
- real-time cursors
- content versioning
- grammar suggestions
- document templates
- export to PDF
- import from DOCX
- advanced tables
- embed blocks

---

## 18. Что ИИ должен сделать первым

Первый этап работы:

1. Создать структуру monorepo.
2. Настроить pnpm workspace.
3. Настроить TypeScript.
4. Создать `packages/core`.
5. Создать базовые типы Editor, Extension, Command, DocumentNode.
6. Создать `packages/react`.
7. Создать минимальный Editor component.
8. Создать StarterKit.
9. Создать базовые extensions: paragraph, bold, italic, heading.
10. Создать playground.
11. Написать README с quick start.
12. Подготовить план Rails gem, но не делать его первым.

---

## 19. Критерии готовности MVP

MVP можно считать готовым, если разработчик может:

1. Установить пакет через npm.
2. Подключить React editor.
3. Передать HTML content.
4. Получить HTML output.
5. Получить JSON output.
6. Подключить StarterKit.
7. Использовать bold/italic/heading/list/link.
8. Сделать undo/redo.
9. Создать свою extension.
10. Запустить playground.
11. Прочитать документацию и запустить example.

---

## 20. Итоговая формулировка задачи для ИИ

Ты должен помочь спроектировать и реализовать библиотеку **SMEditor** — независимую библиотеку текстового редактора.

Нужно сделать архитектуру, структуру репозитория, npm-пакеты, typed core, React-интеграцию, extension API, StarterKit, документацию, playground и examples.

Главное: SMEditor не связан с Admivyx. Это отдельный продукт. У него собственный core, собственные пакеты, собственный roadmap и собственная документация.
