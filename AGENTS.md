# AGENTS.md

Instructions and conventions for AI agents working in this repository.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/xiaodeng873/care-suite`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## Display conventions

- 時間顯示格式全專案統一 **HH:MM**（24 小時制，例如 `08:00`）。顯示端不得出現 HH:MM:SS、12 小時制或其他時間格式。寫入格式可內部含秒，但任何 UI/報表/列印顯示必須 HH:MM。
