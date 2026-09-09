# frozen_string_literal: true

# RSpec suite for smeditor.
#
# Run from the gem directory with a Ruby toolchain installed:
#
#   bundle install
#   bundle exec rspec
#
# Спеки идут поверх настоящего Rails-приложения из spec/dummy, а не поверх
# заглушек: только с загруженным приложением выполняются инициализаторы
# движка, поэтому проверить, что `form.smeditor_editor` и `smeditor_render`
# действительно появляются, можно лишь так.

ENV["RAILS_ENV"] ||= "test"

require_relative "dummy/config/environment"

# Хуки ActiveSupport.on_load(:action_view) — те, которыми движок подмешивает
# view-хелперы и расширяет FormBuilder — срабатывают в момент загрузки
# ActionView::Base. В dummy-приложении eager_load выключен, и Base грузится
# лениво, поэтому при случайном порядке спек хук мог не успеть отработать.
# В настоящем приложении рендер любого view загружает Base сам.
require "action_view/base"

require "rails-html-sanitizer"

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end
  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed

  # Each example starts from a fresh, default configuration.
  config.before do
    SMEditor.instance_variable_set(:@config, nil)
  end
end
