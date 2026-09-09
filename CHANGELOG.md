# Changelog

All notable, product-level changes to SMEditor are recorded here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/).

## How versioning works here

SMEditor is a monorepo with two release tracks:

- **npm packages** (`@smeditor/*`) are versioned independently with
  [Changesets](https://github.com/changesets/changesets). On release,
  `changeset version` generates a per-package `packages/<name>/CHANGELOG.md` —
  once generated, those are the source of truth for per-package changes.
- **The Ruby gem** (`smeditor`) is versioned by hand with `pnpm version:gem`.

This root file records **cross-cutting product changes** and the **gem** release
history. Add an entry under `## [Unreleased]` as you land user-facing work, then
move it under a version heading on release. See
[docs/RELEASE.md](docs/RELEASE.md) for the full process.

## [Unreleased]

### Added

- Release tooling: `scripts/bump-version.mjs` (gem versioning + a unified
  `pnpm version:status` view) and `scripts/publish-gem.sh` (build + push the gem
  to RubyGems), plus a `Release gem` GitHub Actions workflow.

### Changed

### Fixed

---

## smeditor 0.1.0 — 2026-07-06

First published release of the Rails adapter.

### Added

- Thin Rails adapter for SMEditor: a form helper (`smeditor_editor`), a safe
  server-side renderer (`smeditor_render`), and an optional ActiveStorage-backed
  upload endpoint. The editor itself remains the upstream npm packages — the gem
  holds no schema, commands, or rendering pipeline of its own.
- `SMEditor::Rails.configure` block with sane defaults (uploads off, output
  sanitized, starter kit, a tag allow-list) and a memoized `config`.
- Server-side sanitizer built on `rails-html-sanitizer` that strips scripts and
  inline handlers while keeping allow-listed formatting, tables, `href`, and the
  editor's `data-*` attributes.
- Install generator and initializer template.
- RSpec suite covering the config, sanitizer, renderer, form helper, and version.

---

## Editor (npm packages) — product iterations

The npm packages are versioned per-package by Changesets; the notes below capture
the larger cross-cutting passes that shipped before this changelog was formalised.

### Iteration 39 — inline-formatting & container correctness

A correctness pass fixing inline formatting that escaped its selection, empty
blocks the caret couldn't enter, and block attributes lost inside blockquotes and
tables.

#### Added

- `@smeditor/extension-text-stroke` — text outline/stroke extension, with a
  `TextStrokeButton` in `@smeditor/react`.
- New `@smeditor/core` range-aware mark primitives `setMarkOnInlineRange` /
  `removeMarkFromInlineRange` and deep, selection-aware `setMarkAcrossSelection` /
  `unsetMarkAcrossSelection`. 10 new core regression tests (full suite 215 green).

#### Fixed

- Text/background colour, highlight, font size and font family applied their mark
  to every text node in the block instead of the selected span; a second colour
  now replaces the first rather than stacking a duplicate mark.
- Empty paragraphs and freshly-inserted table cells rendered as `<p></p>` and
  collapsed to zero height, so the caret could not be placed. Leaf blocks now get
  a filler `<br>` (dropped again on parse) and a `min-height`, so an empty block
  is always a caret target.
- `text-align`, `line-height` and indent wrote the attribute onto the container
  instead of the leaf block, so a quote could not be centred. `setBlockAttrs` /
  `getBlockAttr` and `editor.isActive` now resolve through the full selection
  path and are correct inside blockquotes, tables and lists.
- The HTML parser dropped a second mark from a single element
  (`<span style="color:…; background-color:…">`), and read colours/fonts only
  from `span`; both are fixed. The serializer writes void tags without a trailing
  slash to match browser `innerHTML`, so no-op re-renders no longer lose the caret.

#### Changed

- text-color, background-color, highlight, font-size, font-family, line-height,
  link and clear-formatting now act on the selected range and reach into
  containers. The React alignment and block-type dropdowns resolve the leaf block
  under the selection.
- The paste sanitizer keeps the safe styles needed for colours, fonts, line
  height and text stroke. Tables ship in `StarterKit` (available in both Standard
  and Full playground editions) and are no longer double-registered in `FullKit`.

### Iteration 38 — Rails gem RSpec suite

#### Added

- RSpec suite for `smeditor` covering the config defaults and `configure`
  block, the sanitizer (script/handler stripping, allow-list, `href` and `data-*`
  retention), the render helper, the form helper, and the version. The specs load
  ActionView and the Rails HTML sanitizer so the gem is exercised against genuine
  Rails behaviour rather than stubs.

> Note: `WebSocketTransport` is type-checked but its end-to-end runtime is
> verified in a deployment, not the test suite; the reconciliation logic it drives
> (`CollabSession`, `CollabClient`, `MemoryHub`) is fully tested.
