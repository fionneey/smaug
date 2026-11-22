# Smaug 🐉

Archive your Twitter/X bookmarks (and/or optionally, likes) to markdown. Automatically.

*Like a dragon hoarding treasure, Smaug collects the valuable things you bookmark and like.*

## Contents

- [Quick Start](#quick-start-5-minutes)
- [Getting Twitter Credentials](#manually-getting-twitter-credentials)
- [What It Does](#what-smaug-actually-does)
- [Running](#running-manually)
- [Categories](#categories)
- [Bookmark Folders](#bookmark-folders)
- [Automation](#automation)
- [Output](#output)
- [Configuration](#configuration)
- [Claude Code Integration](#claude-code-integration)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

```
  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥
       _____ __  __   _   _   _  ____
      / ____|  \/  | / \ | | | |/ ___|
      \___ \| |\/| |/ _ \| | | | |  _
       ___) | |  | / ___ \ |_| | |_| |
      |____/|_|  |_/_/  \_\___/ \____|

   🐉 The dragon stirs... treasures to hoard!
```

## Quick Start (5 minutes)

```bash
# 1. Install bird CLI (Twitter API wrapper)
# See https://github.com/steipete/bird for installation

# 2. Clone and install Smaug
git clone https://github.com/alexknowshtml/smaug
cd smaug
npm install

# 3. Run the setup wizard
npx smaug setup

# 4. Run the full job (fetch + process with Claude)
npx smaug run
```

The setup wizard will:
- Create required directories
- Guide you through getting Twitter credentials
- Create your config file

## Manually Getting Twitter Credentials

Smaug uses the bird CLI which needs your Twitter session cookies.

If you don't want to use the wizard to make it easy, you can manually put your session info into the config.

1. Copy the example config:
   ```bash
   cp smaug.config.example.json smaug.config.json
   ```
2. Open Twitter/X in your browser
3. Open Developer Tools → Application → Cookies
4. Find and copy these values:
   - `auth_token`
   - `ct0`
5. Add them to your `smaug.config.json`:

```json
{
  "twitter": {
    "authToken": "your_auth_token_here",
    "ct0": "your_ct0_here"
  }
}
```

> **Note:** `smaug.config.json` is gitignored to prevent accidentally committing credentials. The example file is tracked instead.

## What Smaug Actually Does

1. **Fetches bookmarks** from Twitter/X using the bird CLI (can also fetch likes, or both)
2. **Expands t.co links** to reveal actual URLs
3. **Extracts content** from linked pages (GitHub repos, articles, quote tweets)
4. **Invokes Claude Code** to analyze and categorize each tweet
5. **Saves to markdown** organized by date with rich context
6. **Files to knowledge library** - GitHub repos to `knowledge/tools/`, articles to `knowledge/articles/`

## Running Manually

```bash
# Full job (fetch + process with Claude)
npx smaug run

# Fetch from bookmarks (default)
npx smaug fetch 20

# Fetch ALL bookmarks (paginated - requires bird CLI v0.6.0+)
npx smaug fetch --all
npx smaug fetch --all --max-pages 5  # Limit to 5 pages

# Fetch from likes instead
npx smaug fetch --source likes

# Fetch from both bookmarks AND likes
npx smaug fetch --source both

# List already-fetched tweets waiting to be processed
npx smaug process

# Re-fetch tweets even if already archived
npx smaug fetch --force

# Check what's pending
npx smaug status
```

### Fetching All Bookmarks

By default, Twitter's API returns ~50-70 bookmarks per request. To fetch more, use the `--all` flag which enables pagination:

```bash
npx smaug fetch --all              # Fetch all (up to 10 pages)
npx smaug fetch --all --max-pages 20  # Fetch up to 20 pages
```

**Note:** This requires bird CLI v0.6.0 or newer. See [Troubleshooting](#only-50-70-bookmarks-fetched) to update it.

**Cost warning:** Processing large bookmark backlogs can consume significant Claude tokens. Each bookmark with content-heavy links (long articles, GitHub READMEs, etc.) adds to the context. Process in batches to control costs:

```bash
npx smaug run --limit 50 -t    # Process 50 at a time with token tracking
```

Use the `-t` flag to monitor usage. See [Token Usage Tracking](#token-usage-tracking) for cost estimates by model.

## Categories

Categories define how different bookmark types are handled. Smaug comes with sensible defaults, but you can customize them in `smaug.config.json`.

### Default Categories

| Category | Matches | Action | Destination |
|----------|---------|--------|-------------|
| **article** | medium.com, substack.com, dev.to, "blog", "article" | file | `./knowledge/articles/` |
| **github** | github.com | file | `./knowledge/tools/` |
| **podcast** | podcasts.apple.com, spotify.com/episode, overcast.fm, pocketcasts.com, castro.fm | transcribe | `./knowledge/podcasts/` |
| **youtube** | youtube.com, youtu.be | transcribe | `./knowledge/videos/` |
| **video** | vimeo.com, loom.com | transcribe | `./knowledge/videos/` |
| **tweet** | (fallback) | capture | bookmarks.md only |

🔜 _Note: Transcription coming soon for podcasts, videos, etc but feel free to edit your own and submit back suggestions!_

### Actions

- **file**: Create a separate markdown file with rich metadata
- **capture**: Add to bookmarks.md only (no separate file)
- **transcribe**: Flag for future transcription *(auto-transcription coming soon! PRs welcome)*

### Custom Categories

Add your own categories in `smaug.config.json`:

```json
{
  "categories": {
    "research": {
      "match": ["arxiv.org", "papers.", "scholar.google"],
      "action": "file",
      "folder": "./knowledge/research",
      "template": "article",
      "description": "Academic papers"
    },
    "newsletter": {
      "match": ["buttondown.email", "beehiiv.com"],
      "action": "file",
      "folder": "./knowledge/newsletters",
      "template": "article",
      "description": "Newsletter issues"
    }
  }
}
```

Your custom categories merge with the defaults. To override a default, use the same key (e.g., `github`, `article`).

## Bookmark Folders

If you've organized your Twitter bookmarks into folders, Smaug can preserve that organization as tags. Configure folder IDs mapped to tag names:

```json
{
  "folders": {
    "1234567890": "ai-tools",
    "0987654321": "articles-to-read",
    "1122334455": "research"
  }
}
```

**How to find folder IDs:**
1. Open Twitter/X and go to your bookmarks
2. Click on a folder
3. The URL will be `https://x.com/i/bookmarks/1234567890` - the number is the folder ID

When folders are configured:
- Smaug fetches from each folder separately
- Each bookmark gets tagged with its folder name
- Tags appear in `bookmarks.md` entries and knowledge file frontmatter

**Note:** Twitter's API doesn't return folder membership when fetching all bookmarks at once, so Smaug must fetch each folder individually.

## Automation

Run Smaug automatically every 30 minutes:

### Option A: PM2 (recommended)

```bash
npm install -g pm2
pm2 start "npx smaug run" --cron "*/30 * * * *" --name smaug
pm2 save
pm2 startup    # Start on boot
```

### Option B: Cron

```bash
crontab -e
# Add:
*/30 * * * * cd /path/to/smaug && npx smaug run >> smaug.log 2>&1
```

### Option C: Bree

See [`examples/bree-scheduler.js`](examples/bree-scheduler.js).

## Output

### bookmarks.md

Your bookmarks organized by date:

```markdown
# Thursday, January 2, 2026

## @simonw - Gist Host Fork for Rendering GitHub Gists
> I forked the wonderful gistpreview.github.io to create gisthost.github.io

- **Tweet:** https://x.com/simonw/status/123456789
- **Link:** https://gisthost.github.io/
- **Filed:** [gisthost-gist-rendering.md](./knowledge/articles/gisthost-gist-rendering.md)
- **What:** Free GitHub Pages-hosted tool that renders HTML files from Gists.

---

## @tom_doerr - Whisper-Flow Real-time Transcription
> This is amazing - real-time transcription with Whisper

- **Tweet:** https://x.com/tom_doerr/status/987654321
- **Link:** https://github.com/dimastatz/whisper-flow
- **Filed:** [whisper-flow.md](./knowledge/tools/whisper-flow.md)
- **What:** Real-time speech-to-text using OpenAI Whisper with streaming support.
```

### knowledge/tools/*.md

GitHub repos get their own files:

```markdown
---
title: "whisper-flow"
type: tool
date_added: 2026-01-02
source: "https://github.com/dimastatz/whisper-flow"
tags: [ai, transcription, whisper, streaming]
via: "Twitter bookmark from @tom_doerr"
---

Real-time speech-to-text transcription using OpenAI Whisper...

## Key Features
- Streaming audio input
- Multiple language support
- Low latency output

## Links
- [GitHub](https://github.com/dimastatz/whisper-flow)
- [Original Tweet](https://x.com/tom_doerr/status/987654321)
```

## Configuration

Copy the example config and customize:

```bash
cp smaug.config.example.json smaug.config.json
```

Example `smaug.config.json`:

```json
{
  "source": "bookmarks",
  "archiveFile": "./bookmarks.md",
  "pendingFile": "./.state/pending-bookmarks.json",
  "stateFile": "./.state/bookmarks-state.json",
  "timezone": "America/New_York",
  "twitter": {
    "authToken": "your_auth_token",
    "ct0": "your_ct0"
  },
  "autoInvokeClaude": true,
  "claudeModel": "sonnet",
  "claudeTimeout": 900000,
  "allowedTools": "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite",
  "webhookUrl": null,
  "webhookType": "discord"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `source` | `bookmarks` | What to fetch: `bookmarks` (default), `likes`, or `both` |
| `includeMedia` | `false` | **EXPERIMENTAL**: Include media attachments (photos, videos, GIFs) |
| `archiveFile` | `./bookmarks.md` | Main archive file |
| `timezone` | `America/New_York` | For date formatting |
| `autoInvokeClaude` | `true` | Auto-run Claude Code for analysis |
| `claudeModel` | `sonnet` | Model to use (`sonnet`, `haiku`, or `opus`) |
| `claudeTimeout` | `900000` | Max processing time (15 min) |
| `parallelThreshold` | `8` | Min bookmarks before parallel processing kicks in |
| `webhookUrl` | `null` | Discord/Slack webhook for notifications |

Environment variables also work: `AUTH_TOKEN`, `CT0`, `SOURCE`, `INCLUDE_MEDIA`, `ARCHIVE_FILE`, `TIMEZONE`, `CLAUDE_MODEL`, etc.

### Experimental: Media Attachments

Media extraction (photos, videos, GIFs) is available but disabled by default. To enable:

```bash
# One-time with flag
npx smaug fetch --media

# Or in config
{
  "includeMedia": true
}
```

When enabled, the `media[]` array is included in the pending JSON with:
- `type`: "photo", "video", or "animated_gif"
- `url`: Full-size media URL
- `previewUrl`: Thumbnail (smaller, faster)
- `width`, `height`: Dimensions
- `videoUrl`, `durationMs`: For videos only

⚠️ **Why experimental?**
1. **Requires bird with media support** - PR [#14](https://github.com/steipete/bird/pull/14) adds media extraction. Until merged, you'll need a fork with this PR or wait for an upstream release. Without it, `--media` is a no-op (empty array).
2. **Workflow still being refined** - Short screengrabs (< 30s) don't need transcripts, but longer videos might. We're still figuring out the best handling.

## Claude Code Integration

Smaug uses Claude Code for intelligent bookmark processing. The `.claude/commands/process-bookmarks.md` file contains instructions for:

- Generating descriptive titles (not generic "Article" or "Tweet")
- Filing GitHub repos to `knowledge/tools/`
- Filing articles to `knowledge/articles/`
- Handling quote tweets with full context
- Processing reply threads with parent context
- Parallel processing for large batches (configurable threshold, default 8 bookmarks)

You can also run processing manually:

```bash
claude
> Run /process-bookmarks
```

### Token Usage Tracking

Track your API costs with the `-t` flag:

```bash
npx smaug run -t
# or
npx smaug run --track-tokens
```

This displays a breakdown at the end of each run:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TOKEN USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Main (sonnet):
  Input:               85 tokens  <$0.01
  Output:           5,327 tokens  $0.08
  Cache Read:     724,991 tokens  $0.22
  Cache Write:     62,233 tokens  $0.23

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 TOTAL COST: $0.53
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Cost Optimization: Haiku Subagents

For large batches (8+ bookmarks by default), Smaug spawns parallel subagents. By default, these use Haiku instead of Sonnet, which cuts costs nearly in half:

| Configuration | 20 Bookmarks | Time |
|---------------|--------------|------|
| Sonnet subagents | $1.00 | 4m 12s |
| **Haiku subagents** | **$0.53** | 4m 18s |

Same speed, ~50% cheaper. The categorization and filing tasks don't require Sonnet-level reasoning, so Haiku handles them well.

This is configured in `.claude/commands/process-bookmarks.md` with `model="haiku"` in the Task calls.

## Troubleshooting

### "No new bookmarks to process"

This means either:
1. No bookmarks were fetched (check bird CLI credentials)
2. All fetched bookmarks already exist in `bookmarks.md`

To start fresh:
```bash
rm -rf .state/ bookmarks.md knowledge/
mkdir -p .state knowledge/tools knowledge/articles
npx smaug run
```

### Bird CLI 403 errors

Your Twitter cookies may have expired. Get fresh ones from your browser.

### Processing is slow

- Try `haiku` model instead of `sonnet` in config for faster (but less thorough) processing
- Make sure you're not re-processing with `--force` (causes edits instead of appends)

### Only ~50-70 bookmarks fetched

bird CLI before v0.6.0 doesn't support pagination. Update it:

```bash
npm install -g @steipete/bird@latest
bird bookmarks --help  # Should show the --all flag
```

Then use `npx smaug fetch --all` to fetch all bookmarks with pagination.

## Credits

- [bird CLI](https://github.com/steipete/bird) by Peter Steinberger
- Built with Claude Code

## License

MIT
