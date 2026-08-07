# CLAUDE.md

Guidance for Claude Code when working in this repo. Full project docs (views,
live-data architecture, court-host login, deployment) live in
[README.md](README.md) — read it before doing anything nontrivial. This file
only exists to surface the handful of things that are easy to miss or get
wrong on a fresh session.

## Running the local dev server — especially in a git worktree

Static site, no build step: any file server works for a quick look, but to
exercise the Netlify Functions (`results`, `score-auth`, `live-score`, etc.)
against real Google Sheets data you need `netlify dev`. See "Local
development" in README.md for the full setup (`netlify link`, `netlify
env:pull`).

**When running from a `.claude/worktrees/*` directory, always pass explicit
`--dir`/`--functions` (or `-d`/`-f`) pinned to that worktree's absolute
path:**

```bash
netlify dev --dir "$(pwd)" --functions "$(pwd)/netlify/functions" --port <port>
```

Without them, `netlify dev` finds its "repo root" by walking up parent
directories looking for a directory literally named `.git`. A worktree's
`.git` is a *file* (it points at the main checkout's `.git` dir), not a
directory, so the walk skips right past it and keeps climbing until it hits
the real `.git` directory in the main checkout — then serves files and
functions from *there* instead of the worktree. This fails silently: the dev
server starts fine, functions load fine, `curl` returns 200s — it's just all
main's code, not your branch's. The only symptom is that changes you just
made don't seem to do anything when you test them.

If something you just changed doesn't seem to be taking effect against a
running dev server, the first thing to check is which directory it's
actually serving — e.g. `curl -s http://localhost:<port>/<file> | md5` and
compare against the worktree's own copy of that file — before assuming the
code change itself is wrong.

Also note: `netlify dev`'s internal proxy always binds a fixed port (3999)
regardless of `--port`/`--functions-port`, so only one `netlify dev` instance
can run on the machine at a time. If a second one fails with `EADDRINUSE
::1:3999`, another session (possibly a different worktree, different task)
already has one running — check `lsof -i :3999` and `ps aux | grep netlify`
before killing it, since it may belong to someone else's in-progress work.
