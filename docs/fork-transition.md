# f-codex fork transition

This repository has retired the previous `fca` implementation and now uses
`cc-connect` as the fork baseline.

## Baseline

- Upstream source: `chenhg5/cc-connect`
- Imported commit: `5e2f3b9ebab125bc09c99b8b2dc2cd8526c709ba`
- Previous Node.js `fca` code, scripts, tests, and design drafts are removed
  from the active codebase.

## Codex app-server settings

For Codex integration, prefer the app-server backend:

```toml
[[projects]]
name = "codex-desktop-takeover"
work_dir = "F:/development/f-codex"

[projects.agent]
type = "codex"
backend = "app_server"
app_server_url = "stdio://"
codex_home = "C:/Users/Administrator/.codex"
```

Notes:

- Use `app_server_url = "stdio://"` with current Codex CLI versions. The old
  bare value `stdio` is normalized by cc-connect in code, but the explicit URL
  form is the compatible configuration target.
- For clean bot smoke tests, use an isolated `codex_home` so global Codex
  skills and desktop history do not affect the result.
- For Codex Desktop session takeover, point `codex_home` to the real Codex home
  and keep `work_dir` aligned with the target Desktop thread.

## Verified behavior

The Feishu + Codex app-server smoke path was verified with cc-connect v1.3.2
and Codex CLI 0.137.0.

Desktop session takeover was also verified. cc-connect resumed the Codex
Desktop thread:

```text
019ea6fc-08ee-7233-8060-5a15315587f8
```

The local cc-connect log showed `codex app-server thread resumed` and
`is_resume=true`, and the Desktop session JSONL was appended by the resumed
turn. This confirms that cc-connect can resume a Codex Desktop session when it
uses the same Codex home and matching project working directory.
