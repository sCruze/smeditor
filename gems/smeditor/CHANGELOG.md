# Changelog — smeditor

## 0.2.5 — 2026-09-09

- Fixed the Rails selected-text bubble toolbar being displaced to the right or vertically aligned with the text when the host application creates a CSS containing block (for example with `transform`, `filter`, `perspective`, or modal/animated wrappers).
- Bubble positioning now matches the playground: it is centered above the live selection, flips below near the top viewport edge, and clamps horizontally to the viewport.
- The Rails bubble is positioned in editor-local coordinates, so host layout transforms no longer corrupt its placement.

## 0.2.4 — 2026-09-09

- Added the selected-text bubble formatting toolbar to the self-contained Rails adapter, matching the playground behavior.
- Bubble toolbar positioning and selection tracking now work inside the Rails Shadow DOM and stay visible across scroll/resize.
- Core selection syncing now also listens on the editor ShadowRoot when available.

## 0.2.3

- Added configurable responsive minimum editor heights for desktop, tablet, and mobile.
- Added per-field `min_height`, `tablet_min_height`, and `mobile_min_height` Rails helper options.
- Added matching global defaults in `SMEditor.configure`.

## 0.2.2 — 2026-09-09

- Fixed caret jumps and reordered typing inside the Rails Shadow DOM editor. The core now resolves the live DOM Selection from the editor's own root instead of always using `document.getSelection()`.
- Selection restore and caret coordinate ranges now use the editor element's owner document, keeping the DOM integration correct in isolated roots and embedded documents.

## 0.2.1 — 2026-09-09

- Rails editor now renders inside Shadow DOM so host application CSS cannot alter the SMEditor toolbar or editing surface.
- Rails toolbar now uses the same SMEditor visual language and control layout as the playground instead of native selects/text buttons.
- Theme tokens work inside the isolated editor and continue to follow light/dark preference.
- The self-contained gem still requires no npm, React, esbuild, or jsbundling-rails in the host Rails application.


All notable changes to the Rails adapter are recorded here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the gem
follows [RubyGems versioning](https://guides.rubygems.org/patterns/).

Cross-cutting product changes live in the repository root
[CHANGELOG.md](../../CHANGELOG.md).

## [Unreleased]

### Changed

- The Rails gem is now self-contained. It ships a precompiled browser bundle
  containing SMEditor core, StarterKit and FullKit plus the default CSS theme.
  Consuming Rails applications no longer need npm, React, esbuild, Vite,
  importmap pins, or `jsbundling-rails`.
- The Rails browser adapter mounts directly on `@smeditor/core`, removing React
  from the gem runtime bundle while keeping the React package available for
  normal npm consumers.
- `smeditor:install` now creates only the initializer; it no longer copies a
  host-app JavaScript entrypoint or prints npm installation steps.
- `smeditor_editor` includes the packaged JS/CSS automatically once per view by
  default. `config.auto_include_assets = false` + `smeditor_assets` provides an
  explicit-layout mode.
- The hidden input now emits bubbling `input` and `smeditor:change` events on editor
  updates and exposes `smeditorInstance` for autosave/AI/DOCX integrations.
- Turbo teardown is handled on `turbo:before-cache`.

### Added

- `scripts/build-gem-assets.mjs` creates the vendored browser JS and CSS from
  the monorepo sources.

### Fixed

- The boot script no longer imports `@smeditor/theme-default/index.css`, a
  subpath the theme package did not export. It now imports the package root.
- `EditorContent` receives the editor instance explicitly, so the editor
  actually mounts. It reads the instance from its prop, not from context.
- The default toolbar renders its buttons. `Toolbar` renders only the
  children it is given, so the previous empty element produced an empty bar.
- `EditorProvider` receives `version`, and the editor is wrapped in a
  `.smeditor` element so the default theme applies.
- Booting also runs when the bundle is evaluated after `DOMContentLoaded`
  has already fired, and on `turbo:frame-load`.

### Added

- `config.max_upload_size` (10 MB default) and `config.allowed_upload_types`
  are enforced by the upload endpoint.
- `LICENSE` and `CHANGELOG.md` ship in the gem; the internal `PLAN.md` no
  longer does.
- Gemspec metadata: homepage, contact, source, changelog and issue URLs.

---

## 0.1.0 — 2026-07-06

First release of the Rails adapter: form helper, server-side renderer,
sanitizer, and the optional ActiveStorage upload endpoint.
