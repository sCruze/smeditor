# smeditor

Self-contained Rails integration for [SMEditor](https://github.com/sCruze/smeditor).

The gem ships the **editor core, StarterKit, FullKit, browser bundle and default
CSS theme inside the gem itself**. A Rails application does not need npm,
React, esbuild, Vite, importmap pins, or `jsbundling-rails` to use SMEditor.

## Requirements

- Ruby >= 3.0
- Rails >= 7.0

## Install

```ruby
# Gemfile
gem "smeditor"
```

```bash
bundle install
bin/rails generate smeditor:install
```

That is enough for normal editor usage. The generator only creates
`config/initializers/smeditor.rb`; it does not copy JavaScript into the host
application and does not ask you to install frontend packages.

For ActiveStorage-backed image uploads, mount the engine:

```ruby
# config/routes.rb
mount SMEditor::Rails::Engine => "/smeditor"
```

## Configure

```ruby
# config/initializers/smeditor.rb
SMEditor.configure do |config|
  config.uploads = :none                 # or :active_storage
  config.upload_path = "/smeditor/uploads"
  config.default_kit = "starter"        # or "full"
  config.sanitize_output = true

  # true by default: the first editor field includes smeditor.js/css.
  # Set false if you prefer calling `smeditor_assets` in your layout.
  config.auto_include_assets = true

  config.max_upload_size = 10 * 1024 * 1024
  config.allowed_upload_types = %w[
    image/png image/jpeg image/gif image/webp image/avif image/bmp
  ]
end
```

## Use

```erb
<%= form_with model: @article do |form| %>
  <%= form.smeditor_editor :content,
        kit: "full",
        placeholder: "Write…" %>

  <%= form.submit %>
<% end %>
```

The helper renders a hidden Rails field plus the editor mount. The packaged
browser bundle updates the hidden field on every editor change, including a
normal bubbling `input` event and a `smeditor:change` custom event, so form submit and autosave code can
observe the value without CKEditor-specific integration.

Available options:

- `kit: "starter" | "full"`
- `placeholder:`
- `class:`
- `label:` — editor ARIA label
- `upload_url:` — custom image upload endpoint
- `include_assets: false` — skip automatic asset tags for this field

### Assets in the layout (optional)

By default the first `smeditor_editor` call includes the packaged assets once.
If you prefer explicit layout assets:

```ruby
# config/initializers/smeditor.rb
SMEditor.configure { |config| config.auto_include_assets = false }
```

```erb
<head>
  <%= smeditor_assets %>
</head>
```

The files still come from the gem; this only changes where the tags are
rendered.

## Programmatic access

After boot, the editor instance is available on both the hidden input and the
mount element:

```js
const input = document.querySelector("[data-smeditor-input]")
const editor = input.smeditorInstance

editor.getHTML()
editor.setContent("<p>New content</p>")
editor.commands.toggleBold?.()
```

The bundle also exposes `window.SMEditor.boot()` and
`window.SMEditor.destroy()` for advanced integrations.

## Turbo

SMEditor boots on `DOMContentLoaded`, `turbo:load`, and `turbo:frame-load`.
Before Turbo caches a page, editor instances are destroyed and their mounts are
reset, preventing stale contenteditable state after navigation.

## Rendering saved content

```erb
<%= smeditor_render(@article.content) %>
```

Stored editor HTML is treated as untrusted input. `smeditor_render` sanitizes
allowed tags, URLs and inline formatting and hardens `_blank` links by default.

Set `config.sanitize_output = false` only if the stored HTML is already trusted.

## Uploads

With `config.uploads = :active_storage`, the engine exposes
`POST /smeditor/uploads`. It stores the image through ActiveStorage and returns
`{ src, alt, title }` to the editor.

The default upload endpoint is unauthenticated. It enforces the configured file
size and MIME allow-list, but public applications should add their own
authorization policy.

## What the gem contains

The published `.gem` includes:

- SMEditor browser bundle (core + StarterKit + FullKit)
- default SMEditor theme
- Rails form helper and FormBuilder extension
- safe renderer/sanitizer
- optional ActiveStorage upload endpoint
- install generator

The source monorepo still uses TypeScript/pnpm to develop and rebuild the
frontend packages. Those are **build-time tools for SMEditor maintainers only**;
they are not runtime dependencies of applications that install the gem.

## Development

Rebuild the vendored Rails assets after changing core/extensions or the Rails
browser adapter:

```bash
node scripts/build-gem-assets.mjs
```

Then test/build the gem:

```bash
cd gems/smeditor
bundle install
bundle exec rspec
gem build smeditor.gemspec
```

## License

MIT © SMEditor contributors
