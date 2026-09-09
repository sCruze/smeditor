# SMEditor MVP verification checklist

This checklist is the final MVP smoke scope. It is intentionally limited to the public path a developer should be able to use without internal knowledge of the repository.

## Required commands

Run from the repository root after installing dependencies:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm --filter @smeditor/playground dev
pnpm --filter @smeditor/example-nextjs dev
```

Expected result: all commands complete without manual package config changes. The playground and Next.js example should open with a working editor.

## Public React path

Verify that an application can:

1. Import `Editor` from `@smeditor/react`.
2. Import `StarterKit` from `@smeditor/starter-kit`.
3. Pass HTML content to `content`.
4. Receive both `html` and `json` from `onUpdate`.
5. Toggle read-only mode with `editable={false}`.

Minimal scenario:

```tsx
<Editor
  extensions={[StarterKit]}
  content="<p>Hello</p>"
  onUpdate={({ html, json }) => {
    console.log(html, json);
  }}
/>
```

## Core MVP features

Verify in the playground or tests:

- Paragraph and heading commands.
- Bold, italic, underline, strike and link marks.
- Bullet, ordered and task lists.
- Blockquote and code block.
- Undo and redo.
- Placeholder display in an empty document.
- HTML input and HTML output.
- JSON output.
- Basic toolbar active/disabled state.
- Table insertion and row/column editing.
- Image insertion by URL and configured upload handler.

## Regression coverage

The automated MVP smoke is covered by:

- `packages/full-kit/test/mvp-smoke.test.ts`
- `packages/full-kit/test/full-kit-regressions.test.ts`
- `packages/full-kit/test/security-regressions.test.ts`
- `packages/react/test/editor-mvp.test.tsx`
- `apps/playground/e2e/playground.spec.ts`


## Out-of-scope backlog

The following features are intentionally outside the MVP acceptance criteria and are tracked in `docs/ADVANCED_BACKLOG.md`: collaboration, comments, track changes, AI writing assistant, slash commands, block editor mode, markdown editor mode, real-time cursors, content versioning, grammar suggestions, document templates, PDF export, DOCX import, advanced tables and embeds.

They must remain opt-in and must not be required for the `@smeditor/react` + `@smeditor/starter-kit` path.

## Known environment requirement

The release and CI workflow expect Node 18+, pnpm 9+, and a fresh `pnpm-lock.yaml` generated after the added test/release dependencies.
