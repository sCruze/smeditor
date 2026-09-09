# smeditor — implementation plan

This file is the brief for the Rails gem. The gem is **not** part of
the v0.x MVP; it ships after the npm packages are stable.

## Role in the architecture

`smeditor` is a **self-contained Rails distribution** of the same SMEditor
JavaScript core, not a fork or second editor implementation. The source of
truth stays in `packages/*`; release tooling compiles those sources into a
single browser bundle committed under the gem's `app/assets`.

The consuming Rails application installs only the gem. It does not install
`@smeditor/*`, React, esbuild, Vite, or `jsbundling-rails`.

Ruby remains responsible only for Rails integration: form helpers, safe
rendering, configuration and optional uploads. Schema, commands, parsing and
editor behavior stay in the JavaScript core that is vendored into the gem at
release time.

## Public surface

```ruby
# Configuration (initializer)
SMEditor.configure do |config|
  config.uploads = :active_storage        # or :none, or a custom symbol
  config.sanitize_output = true
  config.allowed_tags = %w[p h1 h2 strong em a]
end
```

```erb
<%# View helper — primary integration point %>
<%= smeditor_editor form, :content %>

<%# Render saved content safely on a public page %>
<%= smeditor_render @article.content %>
```

```ruby
# Controller helper for the JS uploader
class SMEditor::UploadsController < ApplicationController
  include SMEditor::Rails::Uploads
end
```

## Module layout

```
gems/smeditor/
├─ smeditor.gemspec
├─ lib/
│  ├─ smeditor.rb              # entry; requires the rest
│  └─ smeditor/
│     └─ rails/
│        ├─ version.rb
│        ├─ engine.rb                 # Rails::Engine subclass
│        ├─ config.rb                 # `SMEditor.configure { |c| … }`
│        ├─ form_helper.rb            # `smeditor_editor`
│        ├─ renderer.rb               # stored HTML → safe HTML
│        ├─ sanitizer.rb              # Rails::HTML::Sanitizer wrapper
│        └─ uploads.rb                # ActiveStorage adapter
├─ app/
│  └─ assets/
│     ├─ javascripts/smeditor.js     # generated self-contained browser bundle
│     └─ stylesheets/smeditor.css    # generated default theme
└─ test/
   └─ …
```

## Asset strategy

The gem ships two generated assets:

- `app/assets/javascripts/smeditor.js` — a browser bundle containing core,
  StarterKit, FullKit and the Rails DOM adapter.
- `app/assets/stylesheets/smeditor.css` — the default theme with tokens
  flattened into one file.

`scripts/build-gem-assets.mjs` creates both assets from the monorepo sources.
They are built by SMEditor maintainers and committed before a gem release.
The host Rails app never runs this build step.

The engine registers both files with the Rails asset pipeline.
`smeditor_editor` auto-includes them once per view unless
`config.auto_include_assets = false`; in explicit mode the layout calls
`smeditor_assets`.

## Sanitization

The output from `editor.getHTML()` is already structurally safe (we
control which tags `toDOM` emits) — but on the Rails side we treat it
as untrusted user input regardless. `smeditor_render` always runs
through `Rails::HTML5::SafeListSanitizer` with a tag list derived from
the schema. Configurable via `config.allowed_tags`.

## Uploads

When `config.uploads = :active_storage`, the gem mounts a single
`POST /smeditor/uploads` endpoint. The JS side's
`ImageExtension.configure({ upload })` hands the gem a `File`, the
controller stores it via ActiveStorage, and returns
`{ src, alt, width, height }` for the editor to embed.

When `config.uploads = :none`, no controller is mounted; the host is
expected to wire its own.

## Build order (for the gem itself)

1. Engine + initializer plumbing
2. Generated browser assets + `smeditor_editor` form helper (mounts a
   `<div data-smeditor>` and hidden field; packaged JS attaches automatically)
3. Renderer + sanitizer (safe public-side display)
4. ActiveStorage upload controller
5. RSpec test suite hitting a dummy Rails app

None of this happens until the npm side passes the §19 MVP checklist.

## Out of scope (for the gem, forever)

- Anything that touches schema, commands, marks, or transactions.
- Anything Admivyx-related. (See architecture rule §3.)
- Real-time collaboration plumbing — that lives in the JS extensions
  bundle (and in a separate gem if it ever needs a Rails side).
