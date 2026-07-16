# Dev server + browser debugging with AI agents

How to run the moneywise stack so Claude Code (and its sub-agents) can see server
logs and browser DevTools output when troubleshooting.

## Dev server with agent-visible output

### Option A (recommended): agent-managed background task

Ask Claude to start the stack in the background:

> "start the dev server in the background"

Claude runs `make up` (Postgres + Redis) and `pnpm dev` (API :8000 + web :3000) as
background tasks. The harness captures all stdout/stderr, so Claude can read
FastAPI tracebacks, Vite errors, and Plaid sync logs at any point without anything
being pasted manually. Claude is also notified if the process exits unexpectedly.

### Option B: user-owned terminal with a shared log file

If you want to own the process (live output, Ctrl-C control), use the `dev:log`
script:

```bash
pnpm dev:log   # = turbo run dev 2>&1 | tee /tmp/moneywise-dev.log
```

You see everything live as usual, and every line is also mirrored to
`/tmp/moneywise-dev.log`, which Claude reads/tails when troubleshooting.

### Not recommended for servers

`! pnpm dev` (the `!` prefix runs a command inside the Claude session) blocks on
long-running processes — fine for one-shot commands, wrong for a dev server.

## Browser access for agents (console + network logs)

Two MCP browser integrations are available in this repo's Claude Code setup:

### Playwright MCP — agent drives its own browser

Claude launches a browser, navigates the app at http://localhost:3000, and gets:

- console messages (`browser_console_messages`)
- all network requests with status codes (`browser_network_requests`)
- screenshots and accessibility snapshots

Best for "test this flow and tell me what's failing". This is what the
`qa-playwright` sub-agent uses (see `docs/testing/qa-agent-account.md` for the
QA login it must use).

### chrome-devtools-mcp — deeper DevTools, can attach to YOUR Chrome

Provides console, network, performance traces, Lighthouse audits, and heap
snapshots. By default it launches its own Chrome instance.

To let Claude inspect a bug in **your own interactive browser session** (auth
state, extensions, specific data — no reproduction needed), start Chrome with a
remote debugging port:

```bash
google-chrome --remote-debugging-port=9222
```

and configure the MCP server with `--browser-url http://127.0.0.1:9222`. Then you
click around, hit the bug, and ask Claude to pull the console errors and failed
network requests from your session.

## Day-to-day recommendation

Background `pnpm dev` (Option A) + agent-driven Playwright/DevTools MCP covers
~90% of troubleshooting with zero setup. Reserve the `--remote-debugging-port`
attach for bugs that only reproduce in your interactive session.
