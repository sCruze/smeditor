# frozen_string_literal: true

module SMEditor
  module Rails
    # View helper that mounts a self-contained SMEditor inside a Rails form.
    # The gem ships the browser bundle and default theme itself; host apps do
    # not need npm, React, esbuild, importmap pins, or jsbundling-rails.
    module FormHelper
      # Render the packaged JS/CSS once for this view context. This makes the
      # form helper work without editing the host layout. Apps that prefer to
      # include assets in <head> can call `smeditor_assets` there and disable
      # auto inclusion with config.auto_include_assets = false.
      def smeditor_assets
        return "".html_safe if defined?(@_smeditor_assets_rendered) && @_smeditor_assets_rendered

        @_smeditor_assets_rendered = true
        safe_join([
          stylesheet_link_tag("smeditor", "data-turbo-track": "reload"),
          javascript_include_tag("smeditor", defer: true, "data-turbo-track": "reload"),
        ])
      end

      # form    - a Rails FormBuilder
      # method  - the model attribute (stored as an HTML string)
      # options - :kit ("starter" | "full"), :class, :placeholder,
      #           :upload_url, :label, :include_assets
      def smeditor_editor(form, method, options = {})
        object = form.object
        current = object.respond_to?(method) ? object.public_send(method) : nil
        kit = (options[:kit] || SMEditor.config.default_kit).to_s
        upload_url = options.fetch(:upload_url, smeditor_upload_url)
        include_assets = options.fetch(:include_assets, SMEditor.config.auto_include_assets)

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
            smeditor_label: options[:label],
          }.compact,
        )

        wrapper_class = ["smeditor-field", options[:class]].compact.join(" ")
        field = content_tag(:div, safe_join([hidden, mount]), class: wrapper_class)

        include_assets ? safe_join([smeditor_assets, field]) : field
      end

      private

      def smeditor_upload_url
        SMEditor.config.upload_path if SMEditor.config.uploads == :active_storage
      end
    end

    module FormBuilderExtension
      def smeditor_editor(method, options = {})
        @template.smeditor_editor(self, method, options)
      end
    end
  end
end
