# frozen_string_literal: true

module SMEditor
  module Rails
    # View helper that mounts a SMEditor editor inside a Rails form.
    #
    #   <%= form.smeditor_editor :content %>      # via FormBuilder
    #   <%= smeditor_editor(form, :content) %>    # standalone
    #
    # Emits a hidden field carrying the document HTML plus an empty
    # mount point. The boot script (smeditor.js) finds the mount,
    # attaches a real editor seeded from the hidden field, and writes
    # editor.getHTML() back into that field on every change — so a
    # normal form submit persists the content with no extra wiring.
    module FormHelper
      # form    - a Rails FormBuilder
      # method  - the model attribute (stored as an HTML string)
      # options - :kit ("starter" | "full"), :class, :placeholder, :upload_url
      def smeditor_editor(form, method, options = {})
        object = form.object
        current = object.respond_to?(method) ? object.public_send(method) : nil
        kit = (options[:kit] || SMEditor.config.default_kit).to_s
        upload_url = options.fetch(:upload_url, smeditor_upload_url)

        hidden = form.hidden_field(
          method,
          value: current.to_s,
          data: { smeditor_input: true },
        )

        mount = content_tag(
          :div,
          "",
          class: "smeditor-mount",
          data: {
            smeditor: true,
            smeditor_kit: kit,
            smeditor_placeholder: options[:placeholder],
            smeditor_upload_url: upload_url,
          },
        )

        wrapper_class = ["smeditor-field", options[:class]].compact.join(" ")
        content_tag(:div, safe_join([hidden, mount]), class: wrapper_class)
      end

      private

      def smeditor_upload_url
        if SMEditor.config.uploads == :active_storage
          SMEditor.config.upload_path
        end
      end
    end

    # Mixed into ActionView::Helpers::FormBuilder so `form.smeditor_editor`
    # works alongside the standalone helper.
    module FormBuilderExtension
      def smeditor_editor(method, options = {})
        @template.smeditor_editor(self, method, options)
      end
    end
  end
end
