# frozen_string_literal: true

# `rails/engine` не подтягивает core-расширения ActiveSupport сам. Вне
# приложения (например, в rspec) гем грузится первым, и Rails::Initializable
# падает на delegate_missing_to. `require "rails"` ставит их на место.
require "rails"
require "rails/engine"

module SMEditor
  module Rails
    # Rails::Engine subclass — the gem's plumbing.
    #
    # It does three things and nothing more (per PLAN.md the gem stays
    # a thin adapter):
    #   1. Isolates the SMEditor namespace so routes / controllers
    #      don't collide with the host app.
    #   2. Mixes the view helpers into ActionView.
    #   3. Adds smeditor_editor to the form builder.
    #
    # The upload route lives in config/routes.rb and is mounted by the
    # host with `mount SMEditor::Rails::Engine => "/smeditor"`.
    class Engine < ::Rails::Engine
      isolate_namespace SMEditor

      # `isolate_namespace` выводит "sm_editor" из имени константы. Закрепляем
      # "smeditor", чтобы прокси маршрутов у смонтированного движка назывался
      # `smeditor.uploads_path`.
      engine_name "smeditor"
      railtie_name "smeditor"

      # Zeitwerk по имени каталога `smeditor/` вывел бы константу `Smeditor`.
      # Оба автозагрузчика узнают про `SMEditor` до сканирования autoload-путей —
      # иначе `SMEditor::UploadsController` не найдётся.
      initializer "smeditor.inflections", before: :set_autoload_paths do
        ::Rails.autoloaders.each do |autoloader|
          autoloader.inflector.inflect("smeditor" => "SMEditor")
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
