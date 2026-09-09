# Changesets

Use this directory for release notes that drive package versioning.

```bash
pnpm changeset
pnpm version-packages
pnpm release:dry-run
pnpm release
```

Rules:

- Add one changeset for every user-facing package change.
- Keep apps and examples out of publishable releases.
- Use `patch` for fixes and small compatible changes.
- Use `minor` for new compatible APIs.
- Use `major` only for explicit breaking changes.
