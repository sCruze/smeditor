# frozen_string_literal: true

require "rails/generators"

module SMEditor
  module Generators
    class InstallGenerator < ::Rails::Generators::Base
      # Thor вывел бы из имени класса namespace "sm_editor:install".
      # Задаём явно, чтобы генератор звался `rails g smeditor:install`.
      namespace "smeditor:install"

      desc "Install SMEditor Rails configuration and the editor boot script"

      class_option :skip_javascript,
                   type: :boolean,
                   default: false,
                   desc: "Do not copy smeditor.js into app/javascript"

      # Two source roots: the generator templates, and the packaged boot
      # script. Copying the shipped asset rather than a duplicate template
      # keeps a single source of truth for the JavaScript.
      def self.source_paths
        [
          File.expand_path("templates", __dir__),
          File.expand_path("../../../app/assets/javascripts", __dir__),
        ]
      end

      def copy_initializer
        template "initializer.rb", "config/initializers/smeditor.rb"
      end

      # The boot script imports @smeditor/* by bare specifier, so it has to
      # be compiled by the host app's JavaScript bundler. Sprockets and
      # importmap cannot resolve those imports; jsbundling-rails (esbuild,
      # rollup, webpack) or Vite can.
      def copy_boot_script
        copy_file "smeditor.js", "app/javascript/smeditor.js" unless options[:skip_javascript]
      end

      def show_next_steps
        say ""
        say "SMEditor installed. Next:"
        say "  1. npm install @smeditor/react @smeditor/starter-kit \\"
        say "                 @smeditor/full-kit @smeditor/theme-default react react-dom"
        say "  2. Add `import \"./smeditor\"` to app/javascript/application.js"
        say "  3. For uploads: set config.uploads = :active_storage and mount"
        say "     `mount SMEditor::Rails::Engine => \"/smeditor\"` in config/routes.rb"
        say ""
      end
    end
  end
end
