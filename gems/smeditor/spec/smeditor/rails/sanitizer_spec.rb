# frozen_string_literal: true

require "spec_helper"

RSpec.describe SMEditor::Rails::Sanitizer do
  describe ".sanitize" do
    it "strips a script tag while keeping surrounding text" do
      out = described_class.sanitize("<p>safe</p><script>alert(1)</script>")
      expect(out).not_to include("script")
      expect(out).to include("safe")
    end

    it "removes an inline event handler" do
      out = described_class.sanitize('<p onclick="steal()">hi</p>')
      expect(out).not_to include("onclick")
      expect(out).to include("hi")
    end

    it "keeps allow-listed formatting tags" do
      out = described_class.sanitize("<p><strong>bold</strong> <em>x</em></p>")
      expect(out).to include("<strong>")
      expect(out).to include("<em>")
    end

    it "keeps href on an anchor" do
      out = described_class.sanitize('<a href="/page">link</a>')
      expect(out).to include('href="/page"')
    end

    it "keeps table structure tags" do
      html = "<table><tbody><tr><td>cell</td></tr></tbody></table>"
      out = described_class.sanitize(html)
      expect(out).to include("<table>")
      expect(out).to include("<td>")
    end

    it "keeps safe inline styles emitted by SMEditor marks" do
      html = '<span style="color: #ef4444; background-color: #fef3c7">text</span>'
      out = described_class.sanitize(html)
      expect(out).to include("style=")
      expect(out).to include("color")
      expect(out).to include("background-color")
    end

    it "keeps the fill class and its colours" do
      html = '<span class="smeditor-fill" style="background-color: #ef4444; color: #ffffff">fill</span>'
      out = described_class.sanitize(html)
      expect(out).to include('class="smeditor-fill"')
      expect(out).to include("background-color")
      expect(out).to include("#ffffff")
    end

    it "accepts a safe underline colour and rejects an unsafe one" do
      expect(described_class.sanitize_style_value("text-decoration-color", "#3b82f6")).to eq("#3b82f6")
      expect(described_class.sanitize_style_value("text-decoration-color", "url(javascript:alert(1))")).to be_nil
    end

    it "drops a tag outside an explicit allow-list" do
      out = described_class.sanitize(
        "<p><em>kept?</em></p>", allowed_tags: %w[p]
      )
      expect(out).not_to include("<em>")
      expect(out).to include("kept?")
    end

    it "keeps the editor's data-* attributes" do
      html = '<span data-mention-id="7" data-mention-label="Ada">Ada</span>'
      out = described_class.sanitize(html)
      expect(out).to include('data-mention-id="7"')
    end



    it "removes unsafe link protocols" do
      out = described_class.sanitize('<a href="javascript:alert(1)">link</a>')
      expect(out).not_to include("javascript:")
      expect(out).to include("link")
    end

    it "hardens blank targets" do
      out = described_class.sanitize('<a href="https://example.com" target="_blank">link</a>')
      expect(out).to include('target="_blank"')
      expect(out).to include('rel="noopener noreferrer"')
    end

    it "removes unsafe image data URLs" do
      out = described_class.sanitize(
        '<img src="data:image/svg+xml;base64,PHN2Zz4="><img src="data:image/png;base64,AAAA">'
      )
      expect(out).not_to include("image/svg+xml")
      expect(out).to include("data:image/png")
    end

    it "keeps only safe inline style declarations" do
      out = described_class.sanitize(
        '<span style="color: red; background-color: url(javascript:alert(1)); font-size: 18px; position: fixed">text</span>'
      )
      expect(out).to include("color: red")
      expect(out).to include("font-size: 18px")
      expect(out).not_to include("javascript:")
      expect(out).not_to include("position")
      expect(out).not_to include("url(")
    end

    it "returns a String" do
      expect(described_class.sanitize("<p>x</p>")).to be_a(String)
    end

    it "treats nil as empty input" do
      expect(described_class.sanitize(nil)).to eq("")
    end
  end
end
