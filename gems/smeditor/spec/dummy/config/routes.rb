# frozen_string_literal: true

Dummy::Application.routes.draw do
  mount SMEditor::Rails::Engine => "/smeditor"
end
