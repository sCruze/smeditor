# frozen_string_literal: true

require "rails/generators"

module SMEditor
  module Generators
    class InstallGenerator < ::Rails::Generators::Base
      namespace "smeditor:install"
      desc "Install SMEditor Rails configuration"

      source_root File.expand_path("templates", __dir__)

      def copy_initializer
        template "initializer.rb", "config/initializers/smeditor.rb"
      end

      def show_next_steps
        say ""
        say "SMEditor installed. No npm packages or JavaScript bundler are required."
        say "Use `form.smeditor_editor :content` in a form."
        say "For uploads: set config.uploads = :active_storage and mount"
        say "`SMEditor::Rails::Engine => \"/smeditor\"` in config/routes.rb."
        say ""
      end
    end
  end
end
