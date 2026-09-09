# frozen_string_literal: true

module SMEditor
  # Gem-wide configuration, set in an initializer:
  #
  #   SMEditor.configure do |c|
  #     c.uploads = :active_storage
  #     c.allowed_tags = %w[p h1 h2 strong em a]
  #   end
  #
  class Config
    # :none (default) or :active_storage — whether the gem mounts an
    # upload endpoint.
    attr_accessor :uploads
    # When true, smeditor_render sanitizes content before display.
    attr_accessor :sanitize_output
    # Tag allow-list for the server-side renderer.
    attr_accessor :allowed_tags
    # Which bundle the form helper boots: "starter" or "full".
    attr_accessor :default_kit
    # Upload endpoint used by the JavaScript adapter when uploads are enabled.
    attr_accessor :upload_path
    # Hard ceiling on an uploaded file, in bytes. The endpoint is reachable
    # by anyone who can reach the host app unless the controller is
    # subclassed with authentication, so it refuses anything larger.
    attr_accessor :max_upload_size
    # Content types the upload endpoint accepts. SVG is excluded on
    # purpose — it can carry script and is served from the app's origin.
    attr_accessor :allowed_upload_types

    def initialize
      @uploads = :none
      @sanitize_output = true
      @allowed_tags = %w[
        p br h1 h2 h3 h4 h5 h6 strong em u s code pre blockquote
        ul ol li a img figure figcaption hr span
        table thead tbody tr td th
      ]
      @default_kit = "starter"
      @upload_path = "/smeditor/uploads"
      @max_upload_size = 10 * 1024 * 1024
      @allowed_upload_types = %w[
        image/png image/jpeg image/gif image/webp image/avif image/bmp
      ]
    end
  end

  class << self
    # Yields the config for editing and exposes the same object to callers.
    def configure
      yield(config) if block_given?
      config
    end

    def config
      @config ||= Config.new
    end
  end
end
