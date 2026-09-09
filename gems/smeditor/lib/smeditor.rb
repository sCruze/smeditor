# frozen_string_literal: true

# smeditor — thin Rails adapter for the SMEditor editor.
#
# Loading order: version and config have no Rails dependency and load
# first; the rest require Rails and are pulled in by the engine.

require "smeditor/rails/version"
require "smeditor/rails/config"

require "smeditor/rails/sanitizer"
require "smeditor/rails/form_helper"
require "smeditor/rails/renderer"
require "smeditor/rails/uploads"

# The engine require is last — it pulls in Rails. In a non-Rails
# context (e.g. unit-testing the sanitizer) the rescue keeps the gem
# loadable without the framework present.
begin
  require "smeditor/rails/engine"
rescue LoadError
  # Rails not available — engine features are simply unavailable.
end

module SMEditor
  module Rails
    class Error < StandardError; end
  end
end
