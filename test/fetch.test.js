import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { fetchAndPrepareBookmarks } from '../src/processor.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(testDir, 'fixtures');

// Config the environment would otherwise override (see loadConfig)
for (const name of ['ARCHIVE_FILE', 'PENDING_FILE', 'STATE_FILE', 'TIMEZONE', 'BIRD_PATH', 'SOURCE', 'INCLUDE_MEDIA']) {
  delete process.env[name];
}

// Runs fetchAndPrepareBookmarks against the fake bird CLI in a fresh directory
// holding an archive with one bookmark already filed and the given pending file.
let dir;
let config;

function setup(pendingFixture) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaug-test-'));
  config = {
    archiveFile: path.join(dir, 'bookmarks.md'),
    pendingFile: path.join(dir, 'pending.json'),
    stateFile: path.join(dir, 'state.json'),
    timezone: 'UTC',
    birdPath: path.join(fixtures, 'fake-bird.js')
  };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  fs.writeFileSync(config.archiveFile, '- **Tweet:** https://x.com/archived/status/1234567892\n');
  if (pendingFixture) {
    fs.copyFileSync(path.join(fixtures, pendingFixture), config.pendingFile);
  }
}

const fetchOnce = (options = {}) =>
  fetchAndPrepareBookmarks({ configPath: path.join(dir, 'config.json'), ...options });
const readPending = () => JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));

describe('fetchAndPrepareBookmarks', () => {
  beforeEach(() => setup('pending-bookmarks.json'));

  test('merges new bookmarks into the pending file, oldest first, skipping archived ones', async () => {
    const result = await fetchOnce();
    assert.strictEqual(result.count, 2);

    const pending = readPending();
    assert.deepStrictEqual(pending.bookmarks.map(b => b.id), ['9876543210', '1234567890', '1234567891']);
    assert.strictEqual(pending.count, 3);

    const [, quote, reply] = pending.bookmarks;
    assert.strictEqual(quote.date, 'Monday, December 15, 2025');
    assert.strictEqual(quote.tweetUrl, 'https://x.com/testuser/status/1234567890');
    assert.deepStrictEqual(quote.quoteContext, {
      id: '2222222222',
      author: 'quoted',
      authorName: 'Quoted Person',
      text: 'The quoted tweet',
      tweetUrl: 'https://x.com/quoted/status/2222222222',
      source: 'native-quote'
    });
    assert.strictEqual(reply.isReply, true);
    assert.deepStrictEqual(reply.replyContext, {
      id: '1111111111',
      author: 'parentuser',
      authorName: 'Parent User',
      text: 'Parent tweet text',
      tweetUrl: 'https://x.com/parentuser/status/1111111111'
    });

    assert.ok(JSON.parse(fs.readFileSync(config.stateFile, 'utf8')).last_check);
  });

  test('a second fetch adds nothing already pending', async () => {
    await fetchOnce();
    const result = await fetchOnce();
    assert.strictEqual(result.count, 0);
    assert.strictEqual(readPending().count, 3);
  });

  test('--force re-fetches archived bookmarks without duplicating pending ones', async () => {
    await fetchOnce({ force: true });
    await fetchOnce({ force: true });
    const ids = readPending().bookmarks.map(b => b.id);
    assert.deepStrictEqual(ids, ['9876543210', '1234567892', '1234567890', '1234567891']);
  });

  test('keeps bookmarks another run added to the pending file mid-fetch', async () => {
    process.env.FAKE_BIRD_PENDING_FILE = config.pendingFile;
    try {
      await fetchOnce();
    } finally {
      delete process.env.FAKE_BIRD_PENDING_FILE;
    }
    assert.ok(readPending().bookmarks.some(b => b.id === '5555555555'));
  });

  test('expands, types and fetches each link', async () => {
    const pages = {
      'https://t.co/repo': { url: 'https://github.com/owner/repo' },
      'https://t.co/quote': { url: 'https://x.com/someone/status/3333333333' },
      'https://t.co/flix': { url: 'https://www.netflix.com/title/1' },
      'https://api.github.com/repos/owner/repo': {
        ok: true,
        json: async () => ({ name: 'repo', full_name: 'owner/repo', stargazers_count: 5, html_url: 'https://github.com/owner/repo' })
      },
      'https://api.github.com/repos/owner/repo/readme': { ok: false, status: 404, json: async () => ({}) },
      'https://www.netflix.com/title/1': { ok: true, text: async () => 'film page '.repeat(200) }
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => pages[url];
    process.env.FAKE_BIRD_BOOKMARKS = 'link-bookmarks.json';
    try {
      await fetchOnce();
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.FAKE_BIRD_BOOKMARKS;
    }

    const links = readPending().bookmarks.find(b => b.id === '1234567893').links;
    assert.deepStrictEqual(links.map(l => [l.original, l.expanded, l.type]), [
      ['https://t.co/repo', 'https://github.com/owner/repo', 'github'],
      ['https://t.co/quote', 'https://x.com/someone/status/3333333333', 'tweet'],
      ['https://t.co/flix', 'https://www.netflix.com/title/1', 'article']
    ]);
    assert.strictEqual(links[0].content.fullName, 'owner/repo');
    assert.strictEqual(links[0].content.source, 'github-api');
    assert.deepStrictEqual(links[1].content, {
      id: '3333333333',
      author: 'parentuser',
      authorName: 'Parent User',
      text: 'Parent tweet text',
      tweetUrl: 'https://x.com/parentuser/status/3333333333',
      source: 'quote-tweet'
    });
    assert.strictEqual(links[2].content.source, 'direct');
    assert.ok(links[2].content.text.startsWith('film page'));
  });

  test('a pending file without a bookmarks array is treated as empty', async () => {
    setup('empty-pending.json');
    const result = await fetchOnce();
    assert.strictEqual(result.count, 2);
    assert.deepStrictEqual(readPending().bookmarks.map(b => b.id), ['1234567890', '1234567891']);
  });
});

describe('smaug fetch arguments', () => {
  // Runs the CLI in a fresh directory and returns the bird calls it made
  function birdCalls(...args) {
    setup();
    fs.renameSync(path.join(dir, 'config.json'), path.join(dir, 'smaug.config.json'));
    const log = path.join(dir, 'bird.log');
    execFileSync(process.execPath, [path.join(testDir, '../src/cli.js'), 'fetch', ...args], {
      cwd: dir,
      env: { ...process.env, FAKE_BIRD_LOG: log },
      stdio: 'ignore'
    });
    return fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(a => a[0] !== 'read');
  }

  test('--max-pages does not set the fetch count', () => {
    assert.deepStrictEqual(birdCalls('--source', 'both', '--all', '--max-pages', '3'), [
      ['bookmarks', '--all', '--max-pages', '3', '--json'],
      ['likes', '-n', '20', '--json']
    ]);
  });

  test('a bare number sets the count, before or after --max-pages', () => {
    assert.deepStrictEqual(birdCalls('30', '--max-pages', '3'), [['bookmarks', '-n', '30', '--json']]);
    assert.deepStrictEqual(birdCalls('--max-pages', '3', '30'), [['bookmarks', '-n', '30', '--json']]);
  });
});
