# SMEditor Rails example

The Rails gem is self-contained: the editor core, kits, JavaScript bundle and
default theme are packaged inside `smeditor`. The host application does not
install npm packages or add a JavaScript bundler for SMEditor.

## Gemfile

```ruby
gem "smeditor", path: "../../gems/smeditor"
```

## Install

```bash
bundle install
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
  config.auto_include_assets = true
end
```

## Form usage

```erb
<%= form_with model: @article do |form| %>
  <%= form.smeditor_editor :content, kit: "full", placeholder: "Write…" %>
  <%= form.submit %>
<% end %>
```

No `npm install`, no `import "./smeditor"`, and no `jsbundling-rails` are
required.

## Rendering saved content

```erb
<%= smeditor_render(@article.content) %>
```
