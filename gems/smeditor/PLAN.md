# smeditor — implementation plan

This file is the brief for the Rails gem. The gem is **not** part of
the v0.x MVP; it ships after the npm packages are stable.

## Role in the architecture

`smeditor` is a **thin adapter**, not a second core. Per the
brief (§3 / §5 / §15.12) it must:

- Mount the existing npm-published JS bundle (no fork, no parallel
  editor implementation in Ruby).
- Provide a few Rails-shaped helpers on top of the JS.
- Stay loose enough that swapping the JS for a newer SMEditor version
  is a `bundle update` + `yarn upgrade`, nothing else.

What it must **never** do (per §3): hold the document schema, expose a
"commands" layer in Ruby, ship its own rendering pipeline, or grow CRUD
/ permissions logic. Those belong in the host app, not in the editor
gem.

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
│        ├─ renderer.rb               # JSON → safe HTML
│        ├─ sanitizer.rb              # Rails::HTML::Sanitizer wrapper
│        └─ uploads.rb                # ActiveStorage adapter
├─ app/
│  └─ assets/javascripts/
│     └─ smeditor.js                 # esbuild entry shipping the npm bundle
└─ test/
   └─ …
```

## Asset strategy

Two supported paths, picked at install time:

1. **Importmap / esbuild** (default for new Rails 7+ apps).
   The gem registers an asset (`app/assets/javascripts/smeditor.js`)
   that re-exports `@smeditor/react` and the starter kit so a host app
   can `import { Editor } from "@smeditor/rails"` without touching the
   npm registry directly. The build runs at gem-release time, not in
   the host.

2. **Webpacker / shakapacker** (legacy).
   Host adds `gem "smeditor"`, then `yarn add @smeditor/react
   @smeditor/starter-kit` themselves. The gem only contributes the
   form helper and the upload endpoint.

Both paths use the same upstream JS — no separate fork lives in the
gem.

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
2. `smeditor_editor` form helper (mounts a `<div data-smeditor>` and
   a hidden field; JS attaches via a tiny boot script)
3. Renderer + sanitizer (safe public-side display)
4. ActiveStorage upload controller
5. RSpec test suite hitting a dummy Rails app

None of this happens until the npm side passes the §19 MVP checklist.

## Out of scope (for the gem, forever)

- Anything that touches schema, commands, marks, or transactions.
- Anything Admivyx-related. (See architecture rule §3.)
- Real-time collaboration plumbing — that lives in the JS extensions
  bundle (and in a separate gem if it ever needs a Rails side).
