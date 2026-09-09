# Changelog — smeditor

All notable changes to the Rails adapter are recorded here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the gem
follows [RubyGems versioning](https://guides.rubygems.org/patterns/).

Cross-cutting product changes live in the repository root
[CHANGELOG.md](../../CHANGELOG.md).

## [Unreleased]

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

- `smeditor:install` copies the boot script into `app/javascript/smeditor.js`
  so the host app's bundler resolves the `@smeditor/*` imports.
  Pass `--skip-javascript` to opt out.
- `config.max_upload_size` (10 MB default) and `config.allowed_upload_types`
  are enforced by the upload endpoint.
- `LICENSE` and `CHANGELOG.md` ship in the gem; the internal `PLAN.md` no
  longer does.
- Gemspec metadata: homepage, contact, source, changelog and issue URLs.

---

## 0.1.0 — 2026-07-06

First release of the Rails adapter: form helper, server-side renderer,
sanitizer, and the optional ActiveStorage upload endpoint.
