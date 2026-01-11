# CLAUDE.md

This file provides guidance for Claude Code when working with the Smaug codebase.

## Project Overview

Smaug is a Twitter/X bookmarks archiver that fetches bookmarks via session cookies, expands t.co links, extracts content from linked pages, and uses Claude Code for intelligent categorization and filing to a markdown-based knowledge library.

## Architecture

```
User's Twitter session cookies
        ↓
    bird CLI (fetches bookmarks as JSON)
        ↓
    processor.js (expands links, extracts content)
        ↓
    pending-bookmarks.json
        ↓
    Claude Code (via /process-bookmarks command)
        ↓
    bookmarks.md + knowledge/*.md files
```

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.js` | CLI entry point with setup wizard, commands |
| `src/processor.js` | Core bookmark fetching, link expansion, content extraction |
| `src/config.js` | Configuration loading with defaults and env var support |
| `src/job.js` | Scheduled job runner with Claude Code invocation |
| `.claude/commands/process-bookmarks.md` | Claude Code skill for processing bookmarks |

## Commands

```bash
npm test              # Run tests (node:test)
npx smaug setup       # Interactive setup wizard
npx smaug run         # Full job (fetch + process with Claude)
npx smaug fetch       # Fetch bookmarks only
npx smaug fetch --all # Fetch all bookmarks (paginated)
npx smaug status      # Show current status
```

## How Twitter Data Collection Works

This project does NOT use Twitter's official OAuth API. Instead:

1. **Session cookie authentication** - Uses `auth_token` and `ct0` cookies from user's browser
2. **bird CLI** - Third-party CLI tool that wraps Twitter's internal API using these cookies
3. **No rate limits** - Works like a logged-in browser session
4. **Trade-off** - Cookies expire periodically, requiring refresh

The credentials are stored in `smaug.config.json` (gitignored) or passed via `AUTH_TOKEN` and `CT0` environment variables.

## Code Patterns

### Configuration Loading
```javascript
import { loadConfig } from './config.js';
const config = loadConfig(); // Merges file + env vars + defaults
```

### Fetching Bookmarks
```javascript
import { fetchAndPrepareBookmarks } from './processor.js';
const result = await fetchAndPrepareBookmarks({ count: 20 });
```

### State Files
- `.state/pending-bookmarks.json` - Queue of fetched but unprocessed bookmarks
- `.state/bookmarks-state.json` - Last processed ID, timestamps
- `smaug.config.json` - User configuration (gitignored, contains credentials)

## Testing

Tests use Node.js built-in test runner (node:test):

```bash
npm test
# or
node --test
```

Test files are in `test/` with fixtures in `test/fixtures/`.

## Content Categories

Categories determine how bookmarks are handled:

| Category | Action | Destination |
|----------|--------|-------------|
| github | file | `./knowledge/tools/*.md` |
| article | file | `./knowledge/articles/*.md` |
| podcast | transcribe | Flagged for transcript |
| youtube | transcribe | Flagged for transcript |
| tweet | capture | `bookmarks.md` only |

Custom categories can be added in `smaug.config.json`.

## Claude Code Integration

The `/process-bookmarks` skill (in `.claude/commands/process-bookmarks.md`) handles:

1. Reading pending bookmarks from JSON
2. Generating descriptive titles (not generic)
3. Categorizing by link type
4. Filing to appropriate knowledge folders
5. Handling quote tweets and reply threads with context
6. Parallel processing for large batches (spawns Haiku subagents)

### Parallel Processing

When bookmark count >= `parallelThreshold` (default 8):
- Spawn multiple Task subagents writing to `.state/batch-*.md`
- Use `model="haiku"` for cost efficiency (~50% savings)
- Merge batch files into `bookmarks.md` after all complete

## Common Development Tasks

### Adding a New Category
1. Add to `categories` in `src/config.js` DEFAULT_CONFIG
2. Document in README.md

### Modifying Link Expansion
See `expandTcoLink()` and `fetchContent()` in `src/processor.js`

### Changing Claude Processing Logic
Edit `.claude/commands/process-bookmarks.md`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AUTH_TOKEN` | Twitter session token |
| `CT0` | Twitter CSRF token |
| `SOURCE` | bookmarks, likes, or both |
| `CLAUDE_MODEL` | sonnet, haiku, or opus |
| `WEBHOOK_URL` | Discord/Slack notification URL |

## Dependencies

- **dayjs** - Date formatting with timezone support
- **bird CLI** - External tool for Twitter API access (must be installed separately)

## Notes for Development

- This is an ES module project (`"type": "module"` in package.json)
- Requires Node.js >= 20
- Bird CLI must be installed separately: `npm install -g @steipete/bird`
- Session cookies expire - users need to refresh them periodically
- The `smaug.config.json` file is gitignored for security
