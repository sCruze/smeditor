# frozen_string_literal: true

# Mounted by SMEditor::Rails::Engine. Provides the single upload
# endpoint; only reachable when config.uploads == :active_storage.
SMEditor::Rails::Engine.routes.draw do
  post "/uploads", to: "uploads#create", as: :uploads
end
