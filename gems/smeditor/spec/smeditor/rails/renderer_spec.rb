# frozen_string_literal: true

require "spec_helper"

RSpec.describe SMEditor::Rails::RenderHelper do
  # A minimal view context: the Rails tag helpers plus the gem's.
  let(:view) do
    Class.new do
      include ActionView::Helpers::TagHelper
      include ActionView::Helpers::OutputSafetyHelper
      include SMEditor::Rails::RenderHelper
    end.new
  end

  describe "#smeditor_render" do
    it "wraps the content in a smeditor-content container" do
      html = view.smeditor_render("<p>hello</p>")
      expect(html).to include('class="smeditor-content"')
      expect(html).to include("hello")
    end

    it "sanitizes the content by default" do
      html = view.smeditor_render("<p>ok</p><script>evil()</script>")
      expect(html).not_to include("script")
      expect(html).to include("ok")
    end

    it "skips sanitizing when configured off" do
      SMEditor.configure { |c| c.sanitize_output = false }
      html = view.smeditor_render("<p>raw &amp; trusted</p>")
      expect(html).to include("raw")
    end

    it "appends an extra wrapper class" do
      html = view.smeditor_render("<p>x</p>", html_class: "prose")
      expect(html).to include("smeditor-content prose")
    end

    it "returns an html_safe string" do
      html = view.smeditor_render("<p>x</p>")
      expect(html).to be_html_safe
    end

    it "treats nil content as empty" do
      html = view.smeditor_render(nil)
      expect(html).to include('class="smeditor-content"')
    end
  end
end
