# frozen_string_literal: true

require "cgi"

module SMEditor
  module Rails
    # Wraps Rails' HTML sanitizer with a SMEditor-shaped allow-list.
    #
    # Stored editor HTML is treated as untrusted user input, even when
    # the JavaScript serializer produced it. Public display should pass
    # through this adapter first.
    module Sanitizer
      module_function

      # Attributes kept on surviving tags. `style` is included because
      # SMEditor serializes color, background, highlight, underline colour, text stroke,
      # font size, font family and alignment as constrained inline CSS.
      ALLOWED_ATTRS = %w[
        href src alt title class style target rel
        width height data-align data-mention-id data-mention-label
        colspan rowspan
      ].freeze

      COLOR_PATTERN = /\A(?:#[0-9a-fA-F]{3,8}|rgba?\([^;<>"']+\)|hsla?\([^;<>"']+\)|[a-zA-Z]+)\z/
      FONT_FAMILY_PATTERN = /\A[a-zA-Z0-9 ,"'-]{1,200}\z/
      LENGTH_PATTERN = /\A(\d+(?:\.\d+)?)(px|pt|em|rem|%)?\z/
      LINE_HEIGHT_PATTERN = /\A(\d+(?:\.\d+)?)(px|em|rem|%)?\z/
      TEXT_STROKE_WIDTH_PATTERN = /\A(\d+(?:\.\d+)?)px\z/i
      SAFE_TARGETS = %w[_blank _self _parent _top].freeze
      RASTER_DATA_URL_PATTERN = /\Adata:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+\/=\s]+\z/i

      # Produces a sanitized HTML String (not html_safe — the caller
      # decides where it is safe to mark it so).
      def sanitize(html, allowed_tags: nil)
        tags = allowed_tags || SMEditor.config.allowed_tags
        sanitized = sanitizer_class.new.sanitize(
          html.to_s,
          tags: tags,
          attributes: ALLOWED_ATTRS,
        ).to_s
        harden_blank_targets(
          sanitize_url_attributes(
            sanitize_inline_styles(sanitized),
          ),
        )
      end

      # Rails 7.1+ exposes Rails::HTML5::SafeListSanitizer; older
      # versions use Rails::HTML::SafeListSanitizer.
      def sanitizer_class
        if defined?(::Rails::HTML5::SafeListSanitizer)
          ::Rails::HTML5::SafeListSanitizer
        else
          ::Rails::HTML::SafeListSanitizer
        end
      end

      def sanitize_inline_styles(html)
        html.gsub(/\sstyle=(['"])(.*?)\1/mi) do
          quote = Regexp.last_match(1)
          style = CGI.unescapeHTML(Regexp.last_match(2).to_s)
          declarations = style.split(";").filter_map do |declaration|
            sanitize_style_declaration(declaration)
          end
          if declarations.empty?
            ""
          else
            %( style=#{quote}#{CGI.escapeHTML(declarations.join("; "))}#{quote})
          end
        end
      end

      def sanitize_url_attributes(html)
        html.gsub(/\s(href|src)=(['"])(.*?)\2/mi) do
          name = Regexp.last_match(1).downcase
          quote = Regexp.last_match(2)
          value = CGI.unescapeHTML(Regexp.last_match(3).to_s)
          safe_url?(name, value) ? %( #{name}=#{quote}#{CGI.escapeHTML(value.strip)}#{quote}) : ""
        end.gsub(/\starget=(['"])(.*?)\1/mi) do
          quote = Regexp.last_match(1)
          value = CGI.unescapeHTML(Regexp.last_match(2).to_s).strip
          SAFE_TARGETS.include?(value) ? %( target=#{quote}#{value}#{quote}) : ""
        end
      end

      def harden_blank_targets(html)
        html.gsub(/<a\b([^>]*)>/mi) do
          attrs = Regexp.last_match(1).to_s
          if attrs.match?(/\starget=(['"])_blank\1/i)
            if attrs.match?(/\srel=/i)
              %(<a#{attrs}>)
            else
              %(<a#{attrs} rel="noopener noreferrer">)
            end
          else
            %(<a#{attrs}>)
          end
        end
      end

      def sanitize_style_declaration(declaration)
        match = declaration.match(/\A\s*([a-z-]+)\s*:\s*(.+?)\s*\z/i)
        if match
          name = match[1].downcase
          value = sanitize_style_value(name, match[2])
          value ? "#{name}: #{value}" : nil
        end
      end

      def sanitize_style_value(name, value)
        case name
        when "text-align"
          sanitize_text_align(value)
        when "color", "background-color", "background", "text-decoration-color"
          sanitize_color(value)
        when "font-family"
          sanitize_font_family(value)
        when "font-size"
          sanitize_font_size(value)
        when "line-height"
          sanitize_line_height(value)
        when "-webkit-text-stroke", "text-stroke"
          sanitize_text_stroke(value)
        when "-webkit-text-stroke-color", "text-stroke-color"
          sanitize_color(value)
        when "-webkit-text-stroke-width", "text-stroke-width"
          sanitize_text_stroke_width(value)
        end
      end

      def sanitize_text_align(value)
        align = value.to_s.strip.downcase
        %w[left center right justify].include?(align) ? align : nil
      end

      def sanitize_color(value)
        color = value.to_s.strip
        color.match?(COLOR_PATTERN) && !color.match?(/[;:"'<>\\]/) ? color : nil
      end

      def sanitize_font_family(value)
        family = value.to_s.strip
        family.match?(FONT_FAMILY_PATTERN) ? family : nil
      end

      def sanitize_font_size(value)
        size = value.to_s.strip
        match = size.match(LENGTH_PATTERN)
        if match && match[1].to_f.positive? && match[1].to_f <= 400
          "#{match[1]}#{match[2] || 'px'}"
        end
      end

      def sanitize_line_height(value)
        height = value.to_s.strip
        match = height.match(LINE_HEIGHT_PATTERN)
        if match && match[1].to_f.positive? && match[1].to_f <= 10
          "#{match[1]}#{match[2]}"
        end
      end

      def sanitize_text_stroke(value)
        match = value.to_s.strip.match(/\A([^\s]+)\s+(.+)\z/)
        if match
          width = sanitize_text_stroke_width(match[1])
          color = sanitize_color(match[2])
          width && color ? "#{width} #{color}" : nil
        end
      end

      def sanitize_text_stroke_width(value)
        width = value.to_s.strip
        match = width.match(TEXT_STROKE_WIDTH_PATTERN)
        if match && match[1].to_f >= 0 && match[1].to_f <= 8
          "#{match[1]}px"
        end
      end

      def safe_url?(attribute, value)
        url = value.to_s.strip
        if url.empty? || url.match?(/[\u0000-\u001f\u007f\s<>"']/)
          false
        elsif attribute == "src" && url.match?(/\Adata:/i)
          url.match?(RASTER_DATA_URL_PATTERN)
        elsif url.start_with?("#")
          attribute == "href"
        elsif url.start_with?("//")
          false
        elsif url.start_with?("/", "?")
          true
        elsif !url.include?(":")
          url.match?(/\A[.\w~-][.\w~!$&'()*+,;=:@\/-]*(?:\?[^#]*)?(?:#.*)?\z/)
        else
          protocol = url.split(":", 2).first.downcase
          if attribute == "href"
            %w[http https mailto tel].include?(protocol)
          else
            %w[http https].include?(protocol)
          end
        end
      end
    end
  end
end
