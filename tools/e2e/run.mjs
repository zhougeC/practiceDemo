// TASK-002 P0 browser gates: plan.md 5.7 smoke + PR-2 / PR-3 (UD-4: build-time only).
// Opens tools/three-smoke.html over file:// in a real Chromium, reads the page's own
// WebGL readings and rendered-pixel counts, counts non-file requests, and screenshots.
// Method per AMD-P0-001 / ADR-20: two scenarios only (default WebGL2, --disable-webgl2),
// capability assertions instead of flag-name assertions, console errors and pageerrors
// must both be empty with no whitelist; warnings are recorded but never fail a gate.
// Usage: node run.mjs            (headed: real GPU/ANGLE path, visible window)
//        PW_HEADLESS=1 node run.mjs
//        PW_CHANNEL=chrome node run.mjs   (fallback: system Chrome instead of bundled Chromium)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SMOKE_URL = pathToFileURL(join(ROOT, 'tools', 'three-smoke.html')).href;
const EVIDENCE = process.env.TASK002_EVIDENCE || join(homedir(), '.evidence', 'task-002', 'implementation', 'P0');
const SCREEN_DIR = join(EVIDENCE, 'screens');

const SCENARIOS = [
  {
    id: 'webgl2-default',
    label: 'default Chromium: WebGL2 path',
    args: [],
    expectWebGL2: true,
  },
  {
    id: 'webgl1-disable-webgl2',
    label: 'Chromium --disable-webgl2: real WebGL1 path (ADR-20 capability assertions)',
    args: ['--disable-webgl2'],
    expectWebGL2: false,
  },
];

const failures = [];
const results = [];

function check(scenario, name, actual, expected, ok) {
  const pass = ok === undefined ? JSON.stringify(actual) === JSON.stringify(expected) : ok;
  if (!pass) failures.push({ scenario: scenario.id, name, actual, expected });
  return pass;
}

async function readUnmaskedRenderer(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('c');
    const isWebGL2 = window.__smoke && window.__smoke.isWebGL2;
    const gl = canvas.getContext(isWebGL2 ? 'webgl2' : 'webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
}

mkdirSync(SCREEN_DIR, { recursive: true });

const only = process.env.TASK002_ONLY ? process.env.TASK002_ONLY.split(',').map((id) => id.trim()) : null;
const scenarios = only ? SCENARIOS.filter((scenario) => only.includes(scenario.id)) : SCENARIOS;
const offline = process.env.TASK002_OFFLINE === '1';

for (const scenario of scenarios) {
  const browser = await chromium.launch({
    headless: process.env.PW_HEADLESS === '1',
    channel: process.env.PW_CHANNEL || undefined,
    args: scenario.args,
  });
  const browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  if (offline) await context.setOffline(true);
  const page = await context.newPage();
  const requests = [];
  const consoleMessages = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => consoleMessages.push({ type: 'pageerror', text: String(error && error.message) }));

  const response = await page.goto(SMOKE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__smokeReady === true, null, { timeout: 20000 });
  const smoke = await page.evaluate(() => window.__smoke);
  const unmaskedRenderer = await readUnmaskedRenderer(page);
  await page.screenshot({ path: join(SCREEN_DIR, `${scenario.id}.png`), fullPage: false });

  const httpStatus = response ? response.status() : null;
  const nonFileRequests = requests.filter((url) => !url.startsWith('file://'));
  // plan.md 5.4 item 2: error and pageerror are hard failures, no whitelist, no filtering.
  const consoleErrors = consoleMessages.filter((message) => message.type === 'error' || message.type === 'pageerror');
  const consoleWarnings = consoleMessages.filter((message) => message.type === 'warning');
  const pageErrors = consoleMessages.filter((message) => message.type === 'pageerror');

  const before = failures.length;
  check(scenario, 'document loaded', httpStatus, null, httpStatus === null || httpStatus < 400);
  check(scenario, 'page url is the smoke page', page.url(), SMOKE_URL);
  check(scenario, 'smoke.ok', smoke.ok, true);
  check(scenario, 'smoke.error is null', smoke.error, null);
  check(scenario, 'pageErrors empty', smoke.pageErrors, []);
  check(scenario, 'THREE.REVISION', smoke.revision, '162');
  check(scenario, 'renderer.capabilities.isWebGL2', smoke.isWebGL2, scenario.expectWebGL2);
  check(scenario, 'gl context is WebGL2RenderingContext', smoke.glIsWebGL2Context, scenario.expectWebGL2);
  check(scenario, 'rendered triangles = 12', smoke.triangles, 12);
  check(scenario, 'non-background cube pixels > 0', smoke.coloredPixels, null, smoke.coloredPixels > 0);
  check(scenario, 'distinct colors > 5', smoke.distinctColors, null, smoke.distinctColors > 5);
  check(scenario, 'non-file requests', nonFileRequests, []);
  check(scenario, 'console errors (error + pageerror)', consoleErrors, []);
  check(scenario, 'pageerror count', pageErrors.length, 0);
  if (scenario.expectWebGL2) {
    check(scenario, 'gl.VERSION starts with WebGL 2.0', String(smoke.glVersion).startsWith('WebGL 2.0'), true);
  } else {
    check(scenario, 'gl.VERSION starts with WebGL 1.0', String(smoke.glVersion).startsWith('WebGL 1.0'), true);
  }

  results.push({
    id: scenario.id,
    label: scenario.label,
    args: scenario.args,
    browser: browserVersion,
    ok: failures.length === before,
    smoke,
    unmaskedRenderer,
    glVersion: smoke.glVersion,
    requestCount: requests.length,
    nonFileRequests,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    screenshot: join(SCREEN_DIR, `${scenario.id}.png`),
  });
  await context.close();
  await browser.close();
}

const summary = { pass: results.filter((result) => result.ok).length, fail: results.length - results.filter((result) => result.ok).length };
const report = {
  generatedBy: 'tools/e2e/run.mjs',
  planRefs: ['plan.md 5.7', 'plan.md 5.4 item 2', 'PR-2', 'PR-3', 'UD-4', 'AMD-P0-001', 'ADR-20'],
  node: process.version,
  headless: process.env.PW_HEADLESS === '1',
  channel: process.env.PW_CHANNEL || 'bundled-chromium',
  offline,
  only,
  smokePage: SMOKE_URL,
  summary,
  failures,
  results,
};
mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(join(EVIDENCE, 'p0-browser-gates.json'), JSON.stringify(report, null, 2) + '\n');

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id}: isWebGL2=${result.smoke.isWebGL2} glIsWebGL2Context=${result.smoke.glIsWebGL2Context} revision=${result.smoke.revision} triangles=${result.smoke.triangles} coloredPixels=${result.smoke.coloredPixels} distinct=${result.smoke.distinctColors} angle=${result.smoke.angleInstancedArrays} threeExtHas=${result.smoke.threeExtHas} nonFileRequests=${result.nonFileRequests.length} consoleErrors=${result.consoleErrors.length} pageErrors=${result.pageErrors.length} warnings=${result.consoleWarnings.length}`);
  console.log(`     browser=${result.browser} gl=${result.smoke.glVersion} | ${result.smoke.glRenderer} | unmasked=${result.unmaskedRenderer}`);
  for (const warning of result.consoleWarnings) console.log(`     WARNING [${result.id}] ${warning.text}`);
}
if (failures.length) {
  console.error('FAILURES:', JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log(`PASS all ${summary.pass} P0 browser scenarios; report: ${join(EVIDENCE, 'p0-browser-gates.json')}`);
