// Vercel serverless function — fetches a URL server-side to bypass browser CORS.
// Replaces the third-party corsproxy.io dependency. Used by the Tailor tab to read job postings.

export default async function handler(req, res) {
  const url = req.query?.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query param' });
  }

  // Basic safety: only allow http/https
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Only http(s) URLs are allowed' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        // Pretend to be a real browser so job sites return real content
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    const text = await upstream.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: e?.message ?? 'Fetch failed' });
  }
}
