import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndPrepareBookmarks } from '../src/processor.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

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

  test('a pending file without a bookmarks array is treated as empty', async () => {
    setup('empty-pending.json');
    const result = await fetchOnce();
    assert.strictEqual(result.count, 2);
    assert.deepStrictEqual(readPending().bookmarks.map(b => b.id), ['1234567890', '1234567891']);
  });
});
