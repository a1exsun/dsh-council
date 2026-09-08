# Release readiness

This record covers the first public release preparation. It distinguishes deterministic regression checks from model-quality evaluation.

## Review findings addressed

| Area | Finding | Resolution |
| :--- | :--- | :--- |
| Cancellation | A valid arbiter result could win a simultaneous cancellation. | Check cancellation at the final boundary and before reporting success. |
| Catalog discovery | One stalled provider could block the picker and plugin unload. | Bound each catalog read independently; retain healthy catalogs. |
| Child execution | A result promise could stall cleanup if it ignored abort. | Abort waiting, pass cancellation to the child, dispose published handles. |
| Timer lifetime | Native timeout signals lived beyond successful operations. | Clear the deadline timer when its operation settles. |
| New sessions | The retention hook discarded every message in the batch. | Remove only the plugin's own marker. |
| Concurrent user input | Council could rename a session the user had since activated. | Recheck blank state immediately before retention. |
| Error reporting | Projection errors escaped command handling; retention errors could lose a final answer. | Localize projection failures and preserve a completed answer with a retention warning. |
| Validation | Duplicate selection IDs and blank evidence fields were accepted. | Reject malformed selections and whitespace-only evidence. |
| Diagnostics | Empty answers and stopped reviewers were reported misleadingly. | Distinguish empty text, invalid structures, stop reasons, and deadlines. |
| Configuration | Oversized timers could overflow into near-immediate timeouts. | Validate positive integers and the platform timer range at startup. |
| Packaging | Runtime and declaration imports lacked host peer declarations. | Declare Cordis, DSH LLM, and DSH tools peers; test a packed installation. |
| Real host prompts | Prompt/skill injection could turn a marker-only retention turn into a model request. | Short-circuit marker-only turns before synthetic prompt assembly. |
| Real host tools | Child-local delegation tools survived DSH's inherited-tool filter. | Install a child-specific execution guard and native prompt-tool filter during creation. |
| Provider semantics | A context-inheriting provider could defeat independent answers. | Reject providers that inherit parent history or cannot select model routes. |

## Verification

- Unit and adapter tests: `pnpm test:coverage`; thresholds are enforced in `vitest.config.ts`.
- Type checking and production build: `pnpm check`.
- Local coverage after the review: 62 tests; 98.1% lines, 90.58% branches. Coverage thresholds are lower bounds, not claims that untested behavior is correct.
- Peer dependency validation: `pnpm peers check`.
- Packed integration: `pnpm test:host` installs the scoped tarball through `dsh plugin --profile web add` in a disposable home and checks automatic bundle activation. The runtime checks cover two complete councils, eight child model requests, eight denied out-of-scope tool probes, and two cold session reloads: a blank English session, an existing Chinese conversation, structured submission, parent-history isolation, and model-free retention. The README configuration example is applied in the actual host.
- Provider responses in the host test are deterministic fixtures. This does not certify live API availability, benchmark performance, model quality, or adherence to the advisory Web-call budget.
- GitHub Actions checks Node.js 22 and 24 and includes a separate latest-DSH integration job. CI runs on pushes and pull requests; local checks do not imply a hosted CI run has passed.

## Before publishing

- [x] Choose the MIT license and add `LICENSE` plus package metadata.
- [x] Confirm the GitHub owner/repository and add repository, homepage, and issue links.
- [x] Upload the demo video; replace the `DEMO VIDEO` placeholder in both READMEs.
- [ ] Enable private vulnerability reporting on GitHub.
- [x] Review the tarball contents and run the complete verification commands above.
- [ ] Push the reviewed commits, allow CI to finish, then create the initial release.

## Publish to npm

The public package is `@a1exsun/dsh-council`. Authenticate with an npm account authorized to publish in the `@a1exsun` scope. After the checks above pass for the committed release:

```sh
npm login --registry=https://registry.npmjs.org/
npm publish --access public
```

The `prepack` script builds `lib/` before packing or publishing. Registry installations use that prebuilt output and do not run a plugin build. `publishConfig` selects the public npm registry and public visibility. CI validates changes without publishing automatically.

SDK dependencies record a tested snapshot, while the host integration test resolves npm `latest` each time. Web is the supported interactive entry point; a bare headless profile does not register the sidebar metadata projection used for new-session retention.
