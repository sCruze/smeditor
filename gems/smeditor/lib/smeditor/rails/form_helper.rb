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
        if defined?(@_smeditor_assets_rendered) && @_smeditor_assets_rendered
          "".html_safe
        else
          @_smeditor_assets_rendered = true
          safe_join([
            stylesheet_link_tag("smeditor", "data-turbo-track": "reload"),
            javascript_include_tag("smeditor", defer: true, "data-turbo-track": "reload"),
          ])
        end
      end

      # form    - a Rails FormBuilder
      # method  - the model attribute (stored as an HTML string)
      # options - :kit ("starter" | "full"), :class, :placeholder,
      #           :theme ("light" | "dark"), :upload_url, :label,
      #           :include_assets, :min_height,
      #           :tablet_min_height, :mobile_min_height
      def smeditor_editor(form, method, options = {})
        object = form.object
        current = object.respond_to?(method) ? object.public_send(method) : nil
        kit = (options[:kit] || SMEditor.config.default_kit).to_s
        theme = smeditor_theme(options.fetch(:theme, SMEditor.config.default_theme))
        upload_url = options.fetch(:upload_url, smeditor_upload_url)
        include_assets = options.fetch(:include_assets, SMEditor.config.auto_include_assets)
        stylesheet_url = asset_path("smeditor.css")
        min_height = smeditor_css_length(options.fetch(:min_height, SMEditor.config.min_height), :min_height)
        tablet_min_height = smeditor_css_length(options.fetch(:tablet_min_height, SMEditor.config.tablet_min_height), :tablet_min_height)
        mobile_min_height = smeditor_css_length(options.fetch(:mobile_min_height, SMEditor.config.mobile_min_height), :mobile_min_height)

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
            smeditor_theme: theme,
            smeditor_placeholder: options[:placeholder],
            smeditor_upload_url: upload_url,
            smeditor_label: options[:label],
            smeditor_stylesheet: stylesheet_url,
            smeditor_min_height: min_height,
            smeditor_tablet_min_height: tablet_min_height,
            smeditor_mobile_min_height: mobile_min_height,
          }.compact,
        )

        wrapper_class = ["smeditor-field", options[:class]].compact.join(" ")
        field = content_tag(:div, safe_join([hidden, mount]), class: wrapper_class)

        include_assets ? safe_join([smeditor_assets, field]) : field
      end

      private

      CSS_LENGTH = %r{\A(?:0|(?:\d+(?:\.\d+)?)(?:px|rem|em|vh|dvh|svh|vw|%))\z}.freeze

      def smeditor_css_length(value, option_name)
        normalized = value.is_a?(Numeric) ? "#{value}px" : value.to_s.strip
        if normalized.match?(CSS_LENGTH)
          normalized
        else
          raise ArgumentError, "#{option_name} must be a number (pixels) or a CSS length such as 320px, 24rem, or 45vh"
        end
      end

      def smeditor_theme(value)
        theme = value.to_s
        unless %w[light dark].include?(theme)
          raise ArgumentError, 'theme must be "light" or "dark"'
        end

        theme
      end

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
