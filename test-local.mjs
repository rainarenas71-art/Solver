// test-local.mjs — node test-local.mjs
// Run this locally (with PLAYWRIGHT_BROWSERS_PATH unset so Playwright uses default cache)
import { solveWaf } from './solver.js';

const r = await solveWaf();
console.log(JSON.stringify(r, null, 2));
process.exit(r.ok ? 0 : 1);