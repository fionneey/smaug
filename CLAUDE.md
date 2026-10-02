# Smaug - Claude Code Context

Twitter/X bookmark archiver that saves bookmarks to markdown with AI-powered categorization.

## Quick Reference

```bash
npx smaug run              # Full job: fetch + process with Claude
npx smaug fetch --all      # Fetch all bookmarks (paginated)
npx smaug fetch 20         # Fetch 20 bookmarks
npx smaug status           # Show current status
npx smaug setup            # Interactive setup wizard
```

## Architecture

```
src/
├── cli.js        # CLI entry point, command routing
├── job.js        # Scheduled job runner, Claude invocation, progress UI
├── processor.js  # Bookmark fetching, link expansion, content extraction
├── config.js     # Configuration loader (file + env vars)
└── index.js      # Module exports
```

## Key Files

- `smaug.config.json` - User configuration (credentials, folders, settings)
- `.state/pending-bookmarks.json` - Fetched bookmarks awaiting Claude processing
- `.state/bookmarks-state.json` - Last fetch timestamp
- `bookmarks.md` - Main archive file (markdown output)
- `knowledge/tools/` - Filed GitHub repos
- `knowledge/articles/` - Filed articles

## Data Flow

1. **Fetch** (`processor.js`): bird CLI -> Twitter API -> raw bookmarks
2. **Expand** (`processor.js`): t.co links -> actual URLs, fetch GitHub/article content
3. **Tag** (`processor.js`): Apply folder tags from config
4. **Queue** (`processor.js`): Write to `pending-bookmarks.json`
5. **Process** (`job.js`): Claude Code reads pending, categorizes, writes markdown

## Configuration

Config loaded from (in order): `smaug.config.json`, `~/.smaug.json`, `~/.config/smaug/config.json`

Key options:
- `twitter.authToken`, `twitter.ct0` - Session cookies from browser
- `folders` - Map of folder ID -> tag name (e.g., `"1234567890": "ai-tools"`)
- `includeMedia` - Experimental: capture photos/videos/GIFs
- `source` - `bookmarks`, `likes`, or `both`
- `claudeModel` - `sonnet` (default), `haiku`, or `opus`
- `parallelThreshold` - Batch size before spawning parallel subagents (default: 8)

## bird CLI Dependency

Smaug uses [bird CLI](https://github.com/steipete/bird) for Twitter API access:
```bash
brew install steipete/tap/bird  # Recommended
# or: npm install -g @steipete/bird
```

Bird commands used:
- `bird bookmarks -n <count> --json` - Fetch bookmarks
- `bird bookmarks --folder-id <id> --all --json` - Fetch from specific folder
- `bird likes -n <count> --json` - Fetch likes
- `bird read <tweet_id> --json` - Fetch single tweet (for quote/reply context)

## Common Tasks

### Adding New Bookmark Categories

Edit `config.js` DEFAULT_CONFIG.categories:
```javascript
categories: {
  myCategory: {
    match: ['example.com', 'keyword'],
    action: 'file',  // or 'capture', 'transcribe'
    folder: './knowledge/mycategory',
    template: 'article',
    description: 'My custom category'
  }
}
```

### Debugging Fetch Issues

1. Check credentials: `npx smaug status`
2. Test bird directly: `bird bookmarks -n 1 --json`
3. Check pending file: `cat .state/pending-bookmarks.json | jq '.count'`

### Processing Large Backlogs

```bash
npx smaug run --limit 50 -t   # Process 50 at a time with token tracking
```

## Testing

```bash
npm test                      # Run all tests
node --test test/config.test.js
node --test test/processor.test.js
```

Test fixtures in `test/fixtures/`:
- `pending-bookmarks.json` - Sample bookmark data
- `sample-bookmarks.json` - Raw bird CLI output format

## Environment Variables

Override config file settings:
- `AUTH_TOKEN`, `CT0` - Twitter credentials
- `SOURCE` - bookmarks/likes/both
- `INCLUDE_MEDIA` - true/false
- `CLAUDE_MODEL` - sonnet/haiku/opus
- `WEBHOOK_URL` - Discord/Slack notification URL
