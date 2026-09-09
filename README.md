# SMEditor

> Rich text editor library. Framework-agnostic core, React bindings,
> extension system, JSON-first document model, HTML/JSON round-trip,
> toolbar primitives and a default CSS theme.

**Status:** pre-alpha (0.0.x). API may change between any two patch
releases until 0.1.0.

---

## Install

```bash
npm install @smeditor/react @smeditor/starter-kit @smeditor/theme-default
```

Use the larger MVP-safe bundle when the editor needs colors, typography
controls, indent, line height and word count:

```bash
npm install @smeditor/react @smeditor/full-kit @smeditor/theme-default
```

## Quick start (React)

```tsx
import { Editor } from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";
import "@smeditor/theme-default";

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

## Composable layout (with toolbar)

```tsx
import {
  useEditor,
  EditorProvider,
  EditorContent,
  Toolbar,
  BoldButton,
  ItalicButton,
  HeadingButton,
} from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

function MyEditor() {
  const { editor, version } = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
  });

  return (
    <EditorProvider editor={editor} version={version}>
      <Toolbar>
        <BoldButton />
        <ItalicButton />
        <HeadingButton level={1} />
      </Toolbar>
      <EditorContent editor={editor} ariaLabel="Article body" />
    </EditorProvider>
  );
}
```

## Headless (no React)

```ts
import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

const editor = createEditor({
  content: "<p>Hi</p>",
  extensions: [StarterKit],
});

editor.getJSON();
editor.getHTML();
```

---

## Documentation

- Run the docs app with `pnpm docs`.
- The documentation content lives in `apps/docs/src/pages/content.tsx`.
- The technical brief that drives the repository lives in `docs/TR.md`.
- The final MVP smoke checklist lives in `docs/MVP_CHECKLIST.md`.
- The Advanced/Pro backlog lives in `docs/ADVANCED_BACKLOG.md`.

The docs cover introduction, installation, quick start, core concepts,
extensions, commands, schema, React usage, StarterKit, FullKit, toolbar,
HTML/JSON output, tables, images, colors, custom extension boundaries,
Rails integration, API reference and troubleshooting.

---

## Architecture in one paragraph

- **`@smeditor/core`** is the engine. It owns the document model
  (JSON-first), schema compilation, commands, transactions, selection,
  history, input rules, keyboard shortcuts and HTML/JSON serializers.
  It has no UI-framework dependencies.
- **Extensions** (`@smeditor/extension-*`) contribute node types,
  marks, commands, keyboard shortcuts, input rules and paste transforms.
  Nothing about the document model is hard-coded into core except `doc`
  and `text`.
- **`@smeditor/starter-kit`** bundles the MVP editing set: paragraphs,
  headings, basic marks, links, lists, blockquote, code block, horizontal
  rule, images, tables, alignment, clear formatting, markdown shortcuts,
  placeholder and history.
- **`@smeditor/full-kit`** builds on StarterKit with richer inline
  formatting, typography, colors, indent, line height and word count.
  Advanced/Pro features such as comments, mentions and track changes stay
  opt-in through their own packages and are tracked in `docs/ADVANCED_BACKLOG.md`.
- **`@smeditor/react`** wraps core in idiomatic React: `useEditor`,
  `Editor`, `EditorContent`, `EditorProvider`, toolbar primitives,
  dropdowns and floating/contextual UI.
- **`@smeditor/theme-default`** is plain CSS targeting documented class
  names. Replace it with your own stylesheet for full theming.

### What stays out of core

Per the architecture rules (`docs/TR.md` §3):

- Toolbar UI lives in `@smeditor/react`, not in core.
- Image upload is an extension/host-app concern, not a core feature.
- Collaboration is an extension boundary, not a core boundary.
- Rails integration is a separate gem (`gems/smeditor`).

### SMEditor is **not** Admivyx

SMEditor has its own core, schema, packages and roadmap. There is no
shared editor logic between this repo and the Admivyx admin panel
library. The only thing that may be shared at organization level is
non-business tooling such as ESLint, Prettier, tsconfig bases, GitHub
Actions templates and design tokens without behaviour.

---

## Repository layout

```txt
smeditor/
├─ apps/
│  ├─ docs/                   # Vite + React documentation app
│  └─ playground/             # local manual/e2e verification playground
├─ packages/
│  ├─ core/                   # @smeditor/core
│  ├─ react/                  # @smeditor/react
│  ├─ starter-kit/            # @smeditor/starter-kit
│  ├─ full-kit/               # @smeditor/full-kit
│  ├─ extension-*/            # individual feature extensions
│  └─ theme-default/          # @smeditor/theme-default
├─ examples/
│  ├─ nextjs/                 # canonical Next.js App Router example
│  └─ vite-react/             # Vite + React FullKit example
├─ gems/
│  └─ smeditor/        # Rails adapter
└─ docs/
   └─ TR.md                   # technical brief
```

---

## Development

Prerequisites: Node 18+ and pnpm 9+.

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm playground
pnpm docs
```

The playground and docs apps read packages straight from their workspace
sources where configured, so package changes can be tested without a
publish step.

## Release flow

Changesets drives package versioning and release notes. See
[`docs/RELEASE.md`](./docs/RELEASE.md) for the full checklist.

```bash
pnpm changeset
pnpm version-packages
pnpm release:dry-run
pnpm release
```

The release workflow publishes npm packages with public access only when the
manual `publish` input is enabled and `NPM_TOKEN` is configured.

---

## MVP status

- [x] Editor core
- [x] React package
- [x] StarterKit
- [x] Paragraph, heading, bold, italic, underline, strike, link
- [x] Bullet list, ordered list, task list, blockquote, code block
- [x] Undo / redo
- [x] HTML input / output
- [x] JSON document output
- [x] Basic toolbar primitives and reactive toolbar state
- [x] Tables MVP
- [x] Images with extension-configured upload
- [x] Colors, highlight, background and text stroke
- [x] Placeholder extension
- [x] Docs app content matching the current API
- [x] Examples expansion
- [x] CI publishing pipeline
- [x] Final MVP verification checklist

## Future backlog

Comments, real-time collaboration, AI writing assistant, slash commands,
block editor mode, markdown editor mode, content versioning, grammar
suggestions, document templates, advanced tables, embed blocks, PDF
export and DOCX import are tracked in [`docs/ADVANCED_BACKLOG.md`](./docs/ADVANCED_BACKLOG.md).
They remain extension/API boundaries rather than core requirements for the MVP.

---

## License

MIT. See [LICENSE](./LICENSE).
