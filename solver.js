import { chromium } from 'playwright';

const SPA_ORIGIN  = 'https://mtacc.mobilelegends.com';
const TARGET_HOST = 'accountmtapi.mobilelegends.com';
const TARGET_URL  = `https://${TARGET_HOST}/`;

const UA = process.env.SOLVER_UA ||
  'Mozilla/5.0 (Linux; Android 12; TECNO LG7n Build/SP1A.210812.016; wv) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 ' +
  'Mobile Safari/537.36;UniWebView;mtakit';

const WAF_MARKERS = [
  '_waf_bd8ce2ce37', 'aliyun_waf_aa', 'aliyun_waf_oo', 'aliyun_waf_00',
  'aliyun_waf_bb', 'aliyunwaf_6a6f5ea8', 'aliyunwaf_c0e0d6d7', 'Lblfpo', 'acw_sc__v2'
];

export function isChallenge(html) {
  if (!html || typeof html !== 'string') return false;
  return WAF_MARKERS.some(m => html.includes(m));
}

export async function solveWaf({ timeout_ms = 60000 } = {}) {
  const t0 = Date.now();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 412, height: 915 },
    locale: 'en-US',
    timezoneId: 'Asia/Manila',
    extraHTTPHeaders: { 'X-Requested-With': 'com.mobile.legends', 'Origin': SPA_ORIGIN }
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  const page = await ctx.newPage();
  let challengeHtml = null;

  try {
    await page.goto(`${SPA_ORIGIN}/v3.0/`, { waitUntil: 'domcontentloaded', timeout: timeout_ms });
    await page.waitForTimeout(1200);

    const probe = await page.evaluate(async ({ url }) => {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'ping' }) });
      return { status: res.status, text: await res.text() };
    }, { url: TARGET_URL });

    if (isChallenge(probe.text)) {
      challengeHtml = probe.text;
      await page.route(`https://${TARGET_HOST}/**`, async (route) => {
        const req = route.request();
        if (req.isNavigationRequest() && req.resourceType() === 'document') {
          await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: challengeHtml });
        } else {
          await route.continue();
        }
      });

      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: timeout_ms });
      
      const deadline = Date.now() + timeout_ms;
      while (Date.now() < deadline) {
        const cookies = await ctx.cookies(TARGET_URL);
        const names = cookies.map(c => c.name);
        if (names.includes('acw_tc') && names.some(n => n.startsWith('ssxmod'))) break;
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(2000);
      await page.unroute(`https://${TARGET_HOST}/**`);
    }

    // Kukunin lahat ng cookies (walang filter)
    const finalCookies = await ctx.cookies(TARGET_URL);

    return {
      ok: true,
      cookies: finalCookies, 
      elapsed_ms: Date.now() - t0
    };
  } finally {
    await browser.close();
  }
}