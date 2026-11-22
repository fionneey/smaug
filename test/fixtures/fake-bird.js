#!/usr/bin/env node
// Stands in for the bird CLI in tests: answers `bookmarks`, `likes` and `read`
// with fixture tweets the way `bird ... --json` prints them. When FAKE_BIRD_LOG
// is set, each call's arguments are appended to that file as one JSON line.
import fs from 'fs';

const args = process.argv.slice(2);
if (process.env.FAKE_BIRD_LOG) {
  fs.appendFileSync(process.env.FAKE_BIRD_LOG, JSON.stringify(args) + '\n');
}

const [command, id] = args;
if (command === 'bookmarks') {
  process.stdout.write(fs.readFileSync(new URL('./sample-bookmarks.json', import.meta.url), 'utf8'));
} else if (command === 'likes') {
  process.stdout.write('[]');
} else if (command === 'read') {
  process.stdout.write(JSON.stringify({
    id,
    text: 'Parent tweet text',
    author: { username: 'parentuser', name: 'Parent User' }
  }));
} else {
  process.exit(1);
}
