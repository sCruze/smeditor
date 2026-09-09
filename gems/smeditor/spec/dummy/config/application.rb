# frozen_string_literal: true

require "rails"
require "action_controller/railtie"
require "action_view/railtie"
require "smeditor"

# Минимальное Rails-приложение, на котором прогоняются спеки. Оно нужно,
# чтобы выполнились инициализаторы движка: подмешивание view-хелперов,
# расширение FormBuilder и регистрация inflection "smeditor" => "SMEditor".
#
# ActiveStorage здесь намеренно не подключён — ни одна спека не трогает
# загрузку файлов, а его инициализаторы тянут за собой конфигурацию
# хранилища. Понадобится добавить, когда появятся спеки на Uploads.
module Dummy
  class Application < Rails::Application
    config.root = File.expand_path("..", __dir__)
    config.eager_load = false
    config.secret_key_base = "test"
    config.hosts.clear
  end
end
