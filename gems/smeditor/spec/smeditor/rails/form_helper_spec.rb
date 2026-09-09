# frozen_string_literal: true

require "spec_helper"

RSpec.describe SMEditor::Rails::FormHelper do
  # A plain object standing in for an ActiveRecord model.
  let(:model) do
    Struct.new(:content) do
      def self.model_name
        ActiveModel::Name.new(self, nil, "Article")
      end
    end.new("<p>saved content</p>")
  end

  # A view context with the Rails form helpers plus the gem's.
  let(:view) do
    Class.new do
      include ActionView::Helpers::TagHelper
      include ActionView::Helpers::FormHelper
      include ActionView::Helpers::FormTagHelper
      include ActionView::Helpers::OutputSafetyHelper
      include ActionView::Helpers::AssetUrlHelper
      include ActionView::Helpers::AssetTagHelper
      include SMEditor::Rails::FormHelper
    end.new
  end

  let(:form) do
    ActionView::Helpers::FormBuilder.new(:article, model, view, {})
  end

  describe "#smeditor_editor" do

    it "includes the packaged assets automatically" do
      html = view.smeditor_editor(form, :content)
      expect(html).to include("smeditor.css")
      expect(html).to include("smeditor.js")
    end

    it "can skip automatic assets" do
      html = view.smeditor_editor(form, :content, include_assets: false)
      expect(html).not_to include("smeditor.css")
      expect(html).not_to include("smeditor.js")
    end

    it "emits a hidden field seeded with the current value" do
      html = view.smeditor_editor(form, :content)
      expect(html).to include('type="hidden"')
      expect(html).to include("saved content")
    end

    it "marks the hidden field as the SMEditor input" do
      html = view.smeditor_editor(form, :content)
      expect(html).to include("data-smeditor-input")
    end

    it "emits a mount point for the editor" do
      html = view.smeditor_editor(form, :content)
      expect(html).to include("smeditor-mount")
      expect(html).to include("data-smeditor")
    end

    it "boots the configured default kit" do
      html = view.smeditor_editor(form, :content)
      expect(html).to include('data-smeditor-kit="starter"')
    end

    it "accepts a kit override" do
      html = view.smeditor_editor(form, :content, kit: "full")
      expect(html).to include('data-smeditor-kit="full"')
    end

    it "carries a placeholder through to the mount" do
      html = view.smeditor_editor(form, :content, placeholder: "Write…")
      expect(html).to include("Write")
    end

    it "adds the configured upload URL when uploads are enabled" do
      SMEditor.configure do |c|
        c.uploads = :active_storage
        c.upload_path = "/smeditor/uploads"
      end
      html = view.smeditor_editor(form, :content)
      expect(html).to include('data-smeditor-upload-url="/smeditor/uploads"')
    end

    it "applies an extra field class" do
      html = view.smeditor_editor(form, :content, class: "tall")
      expect(html).to include("smeditor-field tall")
    end
  end

  describe "the FormBuilder extension" do
    it "exposes smeditor_editor on the builder" do
      expect(form).to respond_to(:smeditor_editor)
    end
  end
end
