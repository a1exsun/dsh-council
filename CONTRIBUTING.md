# Contributing

[English README](README.md) · [中文说明](README.zh.md)

Use Node.js `^22.19.0 || >=24.0.0` and pnpm 11.7.0.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:coverage
pnpm test:host
```

The host test downloads npm's current DSH release into a disposable environment. It uses fixture responses and needs no API credentials. Never include credentials or personal DSH profiles in tests.

For a bug fix, add a reproducing test. Keep English and Chinese copy in `src/locales.ts` and update both READMEs when behavior changes. Preserve anonymous payloads and the Web-only tool allowlist. Prefer the current DSH API over compatibility branches.

Pull requests should explain the user-visible problem, resulting behavior, and verification. Include the DSH version and tests run. Claims about model quality or live providers require a separately labelled live test.

## Reporting bugs

Include DSH, Node.js, and plugin versions; operating system; locale; reproduction steps; and redacted diagnostics. For failed model calls, include the stage and provider/model identifier. Do not include API keys, private prompts, or personal session archives. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.

## Updating DSH

The development dependencies and lockfile record a tested SDK snapshot. `pnpm test:host` always tests against top-level `@deepseek-ai/dsh@latest`. Update SDK packages together to the host release and run all checks before committing the lockfile. Some DSH interface packages have a different `latest` tag from the host; resolve the host version first, then align its SDK family.

CI validates pull requests and pushes without publishing. See [release readiness](docs/release-readiness.md) before publishing.
