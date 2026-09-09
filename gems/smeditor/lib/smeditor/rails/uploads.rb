# frozen_string_literal: true

module SMEditor
  module Rails
    # Controller concern backing the image uploader.
    #
    #   class SMEditor::UploadsController < ApplicationController
    #     include SMEditor::Rails::Uploads
    #   end
    #
    # The JS side posts a `file` param; the controller stores it via
    # ActiveStorage and responds with image attributes for the editor.
    #
    # Active only when config.uploads == :active_storage — otherwise
    # the endpoint responds with 404 and the host wires its own upload.
    #
    # The endpoint is unauthenticated by default. It enforces a content
    # type allow-list and a size ceiling, but an app with real users
    # should subclass SMEditor::UploadsController and add authorization.
    module Uploads
      def create
        error = upload_error
        if error
          render json: { error: error[:message] }, status: error[:status]
        else
          blob = ActiveStorage::Blob.create_and_upload!(
            io: upload_file.to_io,
            filename: upload_file.original_filename,
            content_type: upload_file.content_type,
          )

          render json: image_payload(blob, upload_file)
        end
      end

      private

      # Walks every precondition once and yields the first failure, so
      # `create` stays a single branch instead of a chain of guards.
      def upload_error
        if SMEditor.config.uploads != :active_storage
          { message: "uploads disabled", status: :not_found }
        elsif !active_storage_available?
          { message: "active storage unavailable", status: :unprocessable_entity }
        elsif upload_file.nil? || !upload_file.respond_to?(:content_type)
          { message: "no file", status: :unprocessable_entity }
        elsif !allowed_upload_type?(upload_file)
          { message: "unsupported file type", status: :unsupported_media_type }
        elsif oversized_upload?(upload_file)
          { message: "file too large", status: :payload_too_large }
        end
      end

      def upload_file
        params[:file]
      end

      def active_storage_available?
        defined?(::ActiveStorage::Blob)
      end

      def allowed_upload_type?(file)
        type = file.content_type.to_s.split(";").first.to_s.strip.downcase
        SMEditor.config.allowed_upload_types.include?(type)
      end

      def oversized_upload?(file)
        limit = SMEditor.config.max_upload_size.to_i
        limit.positive? && upload_size(file) > limit
      end

      # Tempfile-backed uploads know their size; anything else is measured
      # from the IO so a streamed body cannot slip past the ceiling.
      def upload_size(file)
        if file.respond_to?(:size) && file.size
          file.size
        else
          file.to_io.size
        end
      end

      def image_payload(blob, file)
        {
          src: blob_path(blob),
          alt: File.basename(file.original_filename.to_s, ".*"),
          title: file.original_filename.to_s,
        }
      end

      # only_path keeps it host-agnostic — the editor embeds a relative URL.
      def blob_path(blob)
        ::Rails.application.routes.url_helpers.rails_blob_path(
          blob, only_path: true
        )
      end
    end
  end
end
