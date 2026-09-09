# Release process

SMEditor has two independent release tracks:

- **npm packages** (`@smeditor/*`) — versioned with [Changesets](https://github.com/changesets/changesets)
  and published to npm. The root package stays private; only publishable
  `packages/*` workspaces are released.
- **The Ruby gem** (`smeditor`) — versioned by hand and published to RubyGems.

Product-level and gem changes are recorded in the root [CHANGELOG.md](../CHANGELOG.md);
per-package changes live in each package's `CHANGELOG.md`, which `changeset version`
generates on release.

## Version status

See every version in the repo (gem, publishable npm packages, pending changesets)
at a glance:

```bash
pnpm version:status
```

## Local release check

```bash
pnpm install
pnpm check:lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm changeset
pnpm version-packages
pnpm release:dry-run
```

`pnpm check:lockfile` should be clean before `pnpm install --frozen-lockfile`
is used in CI. If it reports drift, run `pnpm install` and commit the updated
`pnpm-lock.yaml`.

`pnpm release:dry-run` must complete before the manual release workflow is run
with publishing enabled.

## Versioning strategy

- `patch`: compatible bug fixes, parser/serializer fixes, toolbar state fixes,
  CSS-only theme polish and documentation corrections for an already released
  API.
- `minor`: compatible public API additions, new commands, new extension options,
  new React components and new package entry points.
- `major`: removed APIs, changed command names, changed document schema output,
  changed package entry points or changed peer dependency ranges in a breaking
  way.

During the `0.0.x` phase, use the smallest SemVer bump that communicates the
risk to downstream users. Do not batch unrelated public API changes into one
changeset.

## Publishing the Ruby gem

The gem is not covered by Changesets. Version it with the helper script, which
edits `gems/smeditor/lib/smeditor/rails/version.rb` and keeps
`Gemfile.lock` in sync:

```bash
pnpm version:gem patch          # or minor / major / an explicit 1.2.0
pnpm version:gem minor --dry-run  # preview without writing
```

Prereleases use RubyGems dot format, not SemVer dashes: `pnpm version:gem prepatch`
produces `0.1.1.rc.0` (not `0.1.1-rc.0`), and `prerelease` bumps `rc.0 → rc.1`.
Running `patch`/`minor`/`major` on a release candidate finalizes it (drops the
`rc` tag).

Then add a `smeditor <version>` entry to [CHANGELOG.md](../CHANGELOG.md),
verify, and publish:

```bash
pnpm release:gem:dry-run   # bundle install + rspec + gem build, no push
pnpm release:gem           # the above, then gem push to RubyGems
```

`gem push` needs credentials. Locally, run `gem signin` once, or set
`GEM_HOST_API_KEY`. Tag the release after publishing: `git tag smeditor-v<version>`.

## GitHub Actions

- `CI` runs on pull requests and pushes to `main`.
- The npm workflows run the lockfile-sync guard (`check:lockfile`) before
  `pnpm install --frozen-lockfile`; the gem workflow installs with Bundler in
  frozen mode (`BUNDLE_FROZEN=true`), so a `Gemfile.lock` out of sync with the
  gemspec fails the run.
- `Release` (npm) is manual. It always runs install, lint, typecheck, tests,
  build, e2e and an npm dry-run. It publishes only when the `publish` input is
  enabled.
- `Release gem` is manual. It runs `bundle install`, RSpec and `gem build`, and
  pushes to RubyGems only when the `publish` input is enabled.

Secrets required in the repository:

- `NPM_TOKEN` — for the npm `Release` workflow.
- `RUBYGEMS_API_KEY` — for the `Release gem` workflow.
