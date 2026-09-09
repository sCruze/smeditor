# frozen_string_literal: true

SMEditor.configure do |config|
  # Use :active_storage after mounting the engine and installing ActiveStorage.
  config.uploads = :none

  # Used by the JavaScript adapter when uploads are enabled.
  config.upload_path = "/smeditor/uploads"

  # "starter" gives the MVP toolbar; "full" enables the larger extension set.
  config.default_kit = "starter"

  # Stored editor HTML is sanitized before public rendering.
  config.sanitize_output = true

  # Upload limits. The endpoint is unauthenticated unless you subclass
  # SMEditor::UploadsController, so keep these tight.
  config.max_upload_size = 10 * 1024 * 1024
  config.allowed_upload_types = %w[
    image/png image/jpeg image/gif image/webp image/avif image/bmp
  ]
end
