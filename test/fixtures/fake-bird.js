#!/usr/bin/env node
// Stands in for the bird CLI in tests: answers `bookmarks`, `likes` and `read`
// with fixture tweets the way `bird ... --json` prints them. When FAKE_BIRD_LOG
// is set, each call's arguments are appended to that file as one JSON line.
// FAKE_BIRD_BOOKMARKS names another fixture file for `bookmarks` to print.
// When FAKE_BIRD_PENDING_FILE is set, `read` also adds bookmark 5555555555 to
// that pending file, standing in for another run changing it mid-fetch.
import fs from 'fs';

const args = process.argv.slice(2);
if (process.env.FAKE_BIRD_LOG) {
  fs.appendFileSync(process.env.FAKE_BIRD_LOG, JSON.stringify(args) + '\n');
}

const [command, id] = args;
if (command === 'bookmarks') {
  const fixture = process.env.FAKE_BIRD_BOOKMARKS || 'sample-bookmarks.json';
  process.stdout.write(fs.readFileSync(new URL(`./${fixture}`, import.meta.url), 'utf8'));
} else if (command === 'likes') {
  process.stdout.write('[]');
} else if (command === 'read') {
  const pendingFile = process.env.FAKE_BIRD_PENDING_FILE;
  if (pendingFile) {
    const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    pending.bookmarks = [...(pending.bookmarks || []), { id: '5555555555', author: 'other', text: 'Added mid-fetch' }];
    fs.writeFileSync(pendingFile, JSON.stringify(pending));
  }
  process.stdout.write(JSON.stringify({
    id,
    text: 'Parent tweet text',
    author: { username: 'parentuser', name: 'Parent User' }
  }));
} else {
  process.exit(1);
}
