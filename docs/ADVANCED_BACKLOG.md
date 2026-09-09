# Advanced / Pro backlog

This backlog is deliberately outside the MVP. The MVP remains focused on the public path documented in `docs/MVP_CHECKLIST.md`: `@smeditor/react`, `@smeditor/starter-kit`, HTML/JSON round-trip, toolbar, tables, images, colors, playground, examples, Rails adapter and release pipeline.

## Boundary rules

- Advanced features must stay opt-in and must not be required for the StarterKit path.
- Advanced features must not add schema, command or runtime requirements to `@smeditor/core` unless the core change is independently needed by the MVP.
- Advanced UI must live in React components, examples or host-app integrations, not in core.
- Server-backed features must expose adapters or callbacks; they must not assume a specific backend.
- A feature leaves this backlog only when it has commands, serialization, tests, docs and an example.

## Deferred feature list

| Feature | Status | Notes before implementation |
| --- | --- | --- |
| Collaboration | Deferred | Needs a transport-neutral session model, conflict handling and presence lifecycle. |
| Comments | Deferred | Host app should own thread storage; editor should only store durable anchors/marks. |
| Track changes | Deferred | Needs live input interception, accept/reject flows and UI review state. |
| AI writing assistant | Deferred | Must be provider-agnostic and require explicit host callbacks for network calls. |
| Slash commands | Deferred | Needs command discovery, keyboard navigation and accessibility coverage. |
| Block editor mode | Deferred | Needs block selection, drag handles, block transforms and mobile behaviour. |
| Markdown editor mode | Deferred | Needs source/editor sync and conflict-free HTML/JSON persistence rules. |
| Real-time cursors | Deferred | Depends on collaboration transport and remote selection mapping. |
| Content versioning | Deferred | Needs host persistence boundaries and history snapshot semantics. |
| Grammar suggestions | Deferred | Must be provider-agnostic and avoid leaking content without host opt-in. |
| Document templates | Deferred | Needs template schema, insertion rules and examples. |
| Export to PDF | Deferred | Should be a separate package with explicit style/layout limitations. |
| Import from DOCX | Deferred | Needs sanitizer, mapping rules and unsupported-content reporting. |
| Advanced tables | Deferred | Covers merge cells, split cells, drag resize and complex selection. |
| Embeds | Deferred | Needs URL allowlists, sandboxing rules and SSR-safe rendering. |

## Current package boundary

`@smeditor/full-kit` is still MVP-safe by default. It builds on `StarterKit` with richer inline formatting, typography, colors, indent and word count. Backlog/pro features such as comments, mentions and track changes remain separate packages so they can evolve without blocking the MVP bundle.

The existing experimental packages under `packages/` are kept as opt-in implementation groundwork. They are not part of the MVP acceptance criteria until each one has dedicated tests, docs, examples and release notes.
