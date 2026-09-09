# smeditor

Rails integration for the [SMEditor](https://github.com/sCruze/smeditor)
rich-text editor.

This gem is a **thin adapter**. The editor is the upstream npm
packages (`@smeditor/react`, `@smeditor/starter-kit`, …); the gem
adds a form helper, a safe server-side renderer, and an optional
upload endpoint. It holds no schema, no commands and no rendering
pipeline of its own.

## Requirements

- Ruby >= 3.0, Rails >= 7.0
- A JavaScript bundler in the host app — `jsbundling-rails` (esbuild,
  rollup, webpack, bun) or Vite. The boot script imports the npm
  packages by bare specifier, which Sprockets and importmap cannot
  resolve on their own.

## Install

```ruby
# Gemfile
gem "smeditor"
```

```bash
bundle install
bin/rails generate smeditor:install
```

The generator writes `config/initializers/smeditor.rb` and copies the
boot script to `app/javascript/smeditor.js`. Then install the editor
itself and import the script:

```bash
npm install @smeditor/react @smeditor/starter-kit \
            @smeditor/full-kit @smeditor/theme-default react react-dom
```

```js
// app/javascript/application.js
import "./smeditor";
```

Mount the engine if you want the upload endpoint:

```ruby
# config/routes.rb
mount SMEditor::Rails::Engine => "/smeditor"
```

## Namespace

Константа гема — `SMEditor` (не `Smeditor`). Каталоги называются `smeditor/`,
поэтому движок сам регистрирует переопределение в обоих автозагрузчиках
Zeitwerk (`smeditor` → `SMEditor`) до сканирования autoload-путей, а генератор
объявляет namespace явно. Настроек в приложении не требуется, и глобальные
inflections ActiveSupport не трогаются.

## Configure

```ruby
# config/initializers/smeditor.rb
SMEditor.configure do |c|
  c.uploads             = :active_storage   # or :none (default)
  c.sanitize_output     = true
  c.default_kit         = "starter"         # or "full"
  c.upload_path         = "/smeditor/uploads"
  c.allowed_tags        = %w[p h1 h2 h3 strong em a img]
  c.max_upload_size     = 10 * 1024 * 1024
  c.allowed_upload_types = %w[image/png image/jpeg image/webp]
end
```

## Use

The form helper mounts an editor and persists its HTML through a
hidden field — a normal form submit saves the content:

```erb
<%= form_with model: @article do |form| %>
  <%= form.smeditor_editor :content %>
  <%= form.submit %>
<% end %>
```

Options: `:kit` (`"starter"` / `"full"`), `:placeholder`, `:class`,
`:upload_url`.

Display saved content on a public page — always sanitized:

```erb
<%= smeditor_render(@article.content) %>
```

## How it works

`smeditor_editor` renders a hidden field (seeded with the stored
HTML) and an empty mount point. The boot script finds each mount,
attaches a real editor from the npm packages, and writes
`editor.getHTML()` back into the hidden field on every change. The
model attribute is a plain HTML string — SMEditor's transport format —
so no special column type or serializer is needed.

Booting runs on `DOMContentLoaded`, on `turbo:load` and on
`turbo:frame-load`; each mount is booted at most once.

## Rendering and trust

Stored editor HTML is treated as untrusted input. `smeditor_render`
passes it through `SMEditor::Rails::Sanitizer`, which applies the tag
allow-list, strips unsafe URLs and `style` declarations, and adds
`rel="noopener noreferrer"` to `target="_blank"` links.

Setting `config.sanitize_output = false` marks stored content
`html_safe` without sanitizing it. Only do that when the content is
already trusted upstream.

## Uploads

With `config.uploads = :active_storage`, the engine exposes
`POST /smeditor/uploads`. It stores image files via ActiveStorage and
responds with `{ src, alt, title }` for the editor to embed.

The endpoint is **unauthenticated by default** and only enforces the
content-type allow-list and `max_upload_size`. Subclass
`SMEditor::UploadsController` and add your own authorization before
exposing it to the public internet.

With `:none`, no endpoint is mounted — wire your own.

## Development

```bash
cd gems/smeditor
bundle install
bundle exec rspec
```

## License

MIT © SMEditor contributors
