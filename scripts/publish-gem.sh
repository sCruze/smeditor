#!/usr/bin/env bash
#
# Build and publish the smeditor gem to RubyGems.
#
# The npm packages are published separately with Changesets (`pnpm release`).
# This script owns the Ruby side only.
#
# Usage:
#   scripts/publish-gem.sh              Build, verify, and push to RubyGems
#   scripts/publish-gem.sh --dry-run    Build and verify only (no push)
#   scripts/publish-gem.sh --skip-tests Skip `bundle exec rspec`
#
# Auth: `gem push` needs credentials. Either run `gem signin` once, or set
#   GEM_HOST_API_KEY=<your rubygems api key>
# in the environment (this is what CI uses).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEM_DIR="$ROOT/gems/smeditor"

DRY_RUN=0
SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      # Print the leading `#` comment block, skipping the shebang, stopping at
      # the first non-comment line.
      awk 'NR==1 {next} /^#/ {sub(/^# ?/, ""); print; next} {exit}' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "error: unknown argument '$arg' (try --dry-run, --skip-tests, --help)" >&2
      exit 1
      ;;
  esac
done

cd "$GEM_DIR"

VERSION="$(ruby -r ./lib/smeditor/rails/version -e 'print SMEditor::Rails::VERSION')"
echo "==> smeditor ${VERSION}"

echo "==> bundle install"
bundle install

if [ "$SKIP_TESTS" -eq 0 ]; then
  echo "==> bundle exec rspec"
  bundle exec rspec
else
  echo "==> skipping tests (--skip-tests)"
fi

# Remove any stale build artifacts so the one we push is unambiguously the one
# we just built (RubyGems normalizes prerelease versions in the filename, so we
# read the real filename back rather than guessing it from VERSION).
echo "==> gem build smeditor.gemspec"
rm -f smeditor-*.gem
gem build smeditor.gemspec

GEM_FILE="$(ls smeditor-*.gem 2>/dev/null | head -n1)"
if [ -z "$GEM_FILE" ] || [ ! -f "$GEM_FILE" ]; then
  echo "error: gem build did not produce a smeditor-*.gem artifact" >&2
  exit 1
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> dry run complete. Built $GEM_FILE but did not push."
  echo "    Publish for real with: scripts/publish-gem.sh"
  exit 0
fi

echo "==> gem push $GEM_FILE"
gem push "$GEM_FILE"

echo "==> published smeditor ${VERSION} to RubyGems"
echo "    Remember to tag the release: git tag smeditor-v${VERSION}"
