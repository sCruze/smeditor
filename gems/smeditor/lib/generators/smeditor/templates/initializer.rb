# frozen_string_literal: true

SMEditor.configure do |config|
  # Use :active_storage after mounting the engine and installing ActiveStorage.
  config.uploads = :none

  # Used by the JavaScript adapter when uploads are enabled.
  config.upload_path = "/smeditor/uploads"

  # Assets are shipped inside the gem and inserted automatically with the
  # first editor field. Set false if you call `smeditor_assets` in your layout.
  config.auto_include_assets = true

  # "starter" gives the MVP toolbar; "full" enables the larger extension set.
  config.default_kit = "starter"

  # "light" is the default. Set "dark" globally or pass theme: per editor.
  config.default_theme = "light"

  # Responsive minimum editor height. Numeric values are pixels. You can also
  # use CSS lengths such as "24rem" or "45vh".
  config.min_height = 320
  config.tablet_min_height = 280
  config.mobile_min_height = 220

  # Stored editor HTML is sanitized before public rendering.
  config.sanitize_output = true

  # Upload limits. The endpoint is unauthenticated unless you subclass
  # SMEditor::UploadsController, so keep these tight.
  config.max_upload_size = 10 * 1024 * 1024
  config.allowed_upload_types = %w[
    image/png image/jpeg image/gif image/webp image/avif image/bmp
  ]
end
