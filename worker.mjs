// NEW: Auto-solve WAF and Login in one request
app.post('/login', async (req, reply) => {
  const { account, md5pwd } = req.body || {};
  if (!account || !md5pwd) {
    return reply.code(400).send({ ok: false, error: 'account and md5pwd required' });
  }

  // 1. Solve WAF
  const waf = await solveWaf();
  if (!waf.ok) {
    return reply.code(502).send({ ok: false, error: 'waf_failed', details: waf });
  }

  // 2. Format cookies and extract ssxmod_itna
  const cookieHeader = waf.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const wafToken = waf.cookies.find(c => c.name === 'ssxmod_itna')?.value || '';

  // 3. Fire Auth POST (Appending the WAF token to the URL just like the trace)
  const targetUrl = wafToken 
    ? `https://accountmtapi.mobilelegends.com/?ssxmod_itna=${encodeURIComponent(wafToken)}` 
    : 'https://accountmtapi.mobilelegends.com/';

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Host': 'accountmtapi.mobilelegends.com',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://mtacc.mobilelegends.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; TECNO LG7n Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 Mobile Safari/537.36;UniWebView;mtakit',
        'X-Requested-With': 'com.mobile.legends',
        'Referer': 'https://mtacc.mobilelegends.com/',
        'sec-ch-ua': '"Android WebView";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        op: "new_login_pwd",
        sign: "1cbf013210a41809ef138e7a93859a06", // Static sign from your capture
        params: { account, md5pwd, country: "" },
        lang: "en"
      })
    });
    
    const text = await res.text();
    return { 
      ok: !text.includes('aliyun_waf'), 
      status: res.status, 
      account: account,
      response: text 
    };
  } catch (e) {
    return reply.code(500).send({ ok: false, error: e.message });
  }
});