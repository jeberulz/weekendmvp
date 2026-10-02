# Editorial Admin planning progress

## 2026-09-27 — plan prepared

- Work Package planning lane; separate branch `codex/editorial-admin-plan` and contained `.worktrees/editorial-admin-plan`, based on main `359ad428`.
- Read active handoff, workflow/rulings, WP38 stories/progress, current WP45 story boundaries and public body/catalogue/cache paths.
- Produced product/design specification, implementation/contracts/security/release plan and copy/paste agent assignment.
- Independent read-only architecture review confirmed public MDX fallback and revalidation failure hazards; included them in the release gate.
- No implementation, shared registry/manifest edit, engine edit, production action or runtime test claim. No external browsing needed for this repository-grounded design.
- Next: reserve an unused WP number in a coordinated registry update and create stories/progress using E0–E7. Build E0–E3 in a separate UI worktree. E4–E7 require assigned integration windows.

| Slice | Status | Evidence required to close |
|---|---|---|
| E0 Contract/fixtures | Planned | DTO validators, fixture matrix and service-approval denial contract tests |
| E1 Shell/queue/library | Planned | Responsive and keyboard/a11y evidence; no existing UI changes |
| E2 Review workspace | Planned | Safe preview, evidence navigation, saving/conflict/recovery and diff tests |
| E3 Human workflow | Planned | Revision-bound review/approval and complete lifecycle state tests |
| E4 Auth/private backend | Planned; integration window needed | Real denial/revocation/re-auth/audit tests and schema review |
| E5 Engine/legacy bridge | Planned; contract freeze needed | Real WP45 mapping, idempotent imports and no live changes |
| E6 Release/lifecycle bridge | Planned; public-site integration needed | Exact-artifact publication, public visibility/removal and recovery tests |
| E7 Launch gate | Planned | Full checks, independent security review, staging journey, bootstrap/import dry-run and activation evidence |

Documentation checks: relative links verified, whitespace checked, `git diff --check` passed. No product code changed, so application tests were not rerun for this planning-only delivery.
