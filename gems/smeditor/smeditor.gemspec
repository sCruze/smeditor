# frozen_string_literal: true

require_relative "lib/smeditor/rails/version"

Gem::Specification.new do |spec|
  spec.name          = "smeditor"
  spec.version       = SMEditor::Rails::VERSION
  spec.authors       = ["SMEditor contributors"]
  spec.email         = ["sCruze@users.noreply.github.com"]
  spec.summary       = "Self-contained SMEditor rich text editor for Rails."
  spec.description   = <<~DESC
    Self-contained SMEditor integration for Rails. The gem ships the editor
    core, starter/full extension kits, browser bundle, default theme, form
    helper, safe renderer, and optional ActiveStorage upload endpoint. Host
    applications do not need npm, React, esbuild, or jsbundling-rails.
  DESC
  spec.homepage      = "https://github.com/sCruze/smeditor"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 3.0"
  spec.required_rubygems_version = ">= 3.3"

  # PLAN.md is an internal design document and is deliberately not shipped.
  spec.files = Dir[
    "lib/**/*",
    "app/**/*",
    "config/**/*",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ]
  spec.require_paths = ["lib"]
  spec.extra_rdoc_files = ["README.md", "CHANGELOG.md", "LICENSE"]

  spec.add_dependency "rails", ">= 7.0", "< 9.0"

  spec.add_development_dependency "rspec", "~> 3.13"
  spec.add_development_dependency "rails-html-sanitizer", "~> 1.6"

  spec.metadata = {
    "homepage_uri"          => spec.homepage,
    "source_code_uri"       => "#{spec.homepage}/tree/main/gems/smeditor",
    "changelog_uri"         => "#{spec.homepage}/blob/main/gems/smeditor/CHANGELOG.md",
    "bug_tracker_uri"       => "#{spec.homepage}/issues",
    "documentation_uri"     => "https://rubydoc.info/gems/smeditor/#{spec.version}",
    "rubygems_mfa_required" => "true",
  }
end
