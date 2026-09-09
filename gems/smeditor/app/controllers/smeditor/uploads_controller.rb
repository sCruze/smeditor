# frozen_string_literal: true

module SMEditor
  # Default upload controller. A host app can use this as-is (the
  # engine routes POST /smeditor/uploads to it) or subclass it to add
  # authentication.
  class UploadsController < ::ActionController::Base
    include SMEditor::Rails::Uploads

    protect_from_forgery with: :null_session
  end
end
