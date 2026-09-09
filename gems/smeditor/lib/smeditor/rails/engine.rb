# frozen_string_literal: true

require "rails"
require "rails/engine"

module SMEditor
  module Rails
    # Self-contained Rails engine. The browser bundle and theme are packaged
    # under app/assets, so consuming applications only need the Ruby gem.
    class Engine < ::Rails::Engine
      isolate_namespace SMEditor

      engine_name "smeditor"
      railtie_name "smeditor"

      initializer "smeditor.inflections", before: :set_autoload_paths do
        ::Rails.autoloaders.each do |autoloader|
          autoloader.inflector.inflect("smeditor" => "SMEditor")
        end
      end

      # Sprockets requires non-application assets to be explicitly precompiled.
      # Propshaft discovers engine assets through the normal Rails asset paths,
      # so this block intentionally runs only when config.assets is available.
      initializer "smeditor.assets" do |app|
        if app.config.respond_to?(:assets) && app.config.assets.respond_to?(:precompile)
          app.config.assets.precompile += %w[smeditor.js smeditor.css]
        end
      end

      initializer "smeditor.view_helpers" do
        ActiveSupport.on_load(:action_view) do
          include SMEditor::Rails::FormHelper
          include SMEditor::Rails::RenderHelper
        end
      end

      initializer "smeditor.form_builder" do
        ActiveSupport.on_load(:action_view) do
          ActionView::Helpers::FormBuilder.include(
            SMEditor::Rails::FormBuilderExtension
          )
        end
      end
    end
  end
end
