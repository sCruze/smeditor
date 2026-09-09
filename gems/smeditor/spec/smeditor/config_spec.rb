# frozen_string_literal: true

require "spec_helper"

RSpec.describe SMEditor::Config do
  describe "defaults" do
    it "leaves uploads off" do
      expect(SMEditor.config.uploads).to eq(:none)
    end

    it "sanitizes output" do
      expect(SMEditor.config.sanitize_output).to be(true)
    end

    it "boots the starter kit" do
      expect(SMEditor.config.default_kit).to eq("starter")
    end

    it "auto-includes packaged assets" do
      expect(SMEditor.config.auto_include_assets).to be(true)
    end

    it "has responsive minimum height defaults" do
      expect(SMEditor.config.min_height).to eq("320px")
      expect(SMEditor.config.tablet_min_height).to eq("280px")
      expect(SMEditor.config.mobile_min_height).to eq("220px")
    end

    it "allows the common content tags" do
      tags = SMEditor.config.allowed_tags
      expect(tags).to include("p", "h1", "strong", "a", "table", "li")
    end

    it "does not allow script in the tag list" do
      expect(SMEditor.config.allowed_tags).not_to include("script")
    end
  end

  describe ".configure" do
    it "yields the config for editing" do
      SMEditor.configure do |c|
        c.default_kit = "full"
        c.uploads = :active_storage
      end
      expect(SMEditor.config.default_kit).to eq("full")
      expect(SMEditor.config.uploads).to eq(:active_storage)
    end

    it "returns the config object" do
      expect(SMEditor.configure).to be_a(SMEditor::Config)
    end

    it "is a no-op without a block" do
      expect { SMEditor.configure }.not_to raise_error
    end
  end

  describe ".config" do
    it "memoizes a single instance" do
      expect(SMEditor.config).to equal(SMEditor.config)
    end
  end
end
