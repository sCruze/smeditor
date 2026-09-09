# frozen_string_literal: true

require "spec_helper"

RSpec.describe SMEditor::Rails do
  it "has a version number" do
    expect(SMEditor::Rails::VERSION).not_to be_nil
  end

  it "uses a SemVer-shaped version string" do
    expect(SMEditor::Rails::VERSION).to match(/\A\d+\.\d+\.\d+/)
  end
end
