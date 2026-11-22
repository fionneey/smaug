// Runs the smaug CLI with every fixed claude install location reported
// missing, so the job falls back to `which claude` and finds the fake on PATH.
import fs from 'fs';
import path from 'path';

const existsSync = fs.existsSync;
fs.existsSync = (p) => path.basename(String(p)) !== 'claude' && existsSync(p);

await import('../../src/cli.js');
