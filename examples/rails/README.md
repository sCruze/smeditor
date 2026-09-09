# SMEditor Rails example

This example shows the intended host-app wiring for `gems/smeditor`. It is documented as integration snippets because the Rails adapter lives as a gem inside this monorepo rather than as a full generated application.

## Gemfile

```ruby
gem "smeditor", path: "../../gems/smeditor"
```

Install the frontend packages used by the gem boot script:

```bash
yarn add @smeditor/react @smeditor/starter-kit @smeditor/full-kit @smeditor/theme-default react react-dom
```

## Install

```bash
bin/rails generate smeditor:install
```

For ActiveStorage-backed uploads:

```ruby
# config/routes.rb
mount SMEditor::Rails::Engine => "/smeditor"
```

```ruby
# config/initializers/smeditor.rb
SMEditor.configure do |config|
  config.uploads = :active_storage
  config.upload_path = "/smeditor/uploads"
  config.default_kit = "full"
  config.sanitize_output = true
end
```

## JavaScript entrypoint

```js
// app/javascript/application.js
import "./smeditor";
```

## Form usage

```erb
<%= form_with model: @article do |form| %>
  <%= form.smeditor_editor :content, kit: "full", placeholder: "Write…" %>
  <%= form.submit %>
<% end %>
```

## Rendering saved content

```erb
<%= smeditor_render(@article.content) %>
```

The renderer sanitizes stored HTML by default and preserves the formatting emitted by SMEditor, including table structure, images, alignment and color-related inline styles.
