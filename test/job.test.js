import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(testDir, 'fixtures');

// Runs `smaug run --limit 2` in a fresh directory whose config keeps the
// pending queue at a custom path, with the fake claude CLI as the only claude
let dir;
let pendingFile;

function runJob(claudeExit) {
  const result = spawnSync(process.execPath, [path.join(fixtures, 'cli-with-fake-claude.js'), 'run', '--limit', '2'], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: `${path.join(fixtures, 'fake-claude')}${path.delimiter}${process.env.PATH}`,
      HOME: dir,
      TMPDIR: dir,
      FAKE_CLAUDE_LOG: path.join(dir, 'claude-args.txt'),
      FAKE_CLAUDE_QUEUE: pendingFile,
      FAKE_CLAUDE_EXIT: String(claudeExit)
    }
  });
  const ids = (file) => JSON.parse(fs.readFileSync(file, 'utf8')).bookmarks.map(b => b.id);
  return { status: result.status, seen: ids(path.join(dir, 'claude-args.txt.queue')), ids: ids(pendingFile) };
}

describe('smaug run', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smaug-job-'));
    fs.mkdirSync(path.join(dir, 'queue'));
    pendingFile = path.join(dir, 'queue', 'todo.json');
    fs.writeFileSync(path.join(dir, 'smaug.config.json'), JSON.stringify({
      pendingFile: './queue/todo.json',
      stateFile: './queue/state.json',
      timezone: 'UTC'
    }));
    fs.writeFileSync(pendingFile, JSON.stringify({
      bookmarks: [{ id: '1', author: 'a', text: 'one' }, { id: '2', author: 'b', text: 'two' }, { id: '3', author: 'c', text: 'three' }]
    }));
  });

  test('points Claude at the configured pending file and removes what it processed', () => {
    const { status, seen, ids } = runJob(0);
    assert.strictEqual(status, 0);
    assert.deepStrictEqual(seen, ['1', '2']);
    assert.deepStrictEqual(ids, ['3']);
    assert.ok(!fs.existsSync(pendingFile + '.full'));
    const prompt = fs.readFileSync(path.join(dir, 'claude-args.txt'), 'utf8').trim().split('\n').pop();
    assert.match(prompt, new RegExp(`^Process the 2 bookmark\\(s\\) in ${fs.realpathSync(pendingFile).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  });

  test('restores the whole queue when Claude fails', () => {
    const { status, seen, ids } = runJob(1);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(seen, ['1', '2']);
    assert.deepStrictEqual(ids, ['1', '2', '3']);
    assert.ok(!fs.existsSync(pendingFile + '.full'));
  });
});
