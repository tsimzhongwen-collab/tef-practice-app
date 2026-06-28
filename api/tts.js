export default async function handler(req, res) {
  const text = String(req.query.q || '').trim();
  if (!text) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const query = text.slice(0, 200);
    const urls = [
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fr&q=${encodeURIComponent(query)}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr&q=${encodeURIComponent(query)}`
    ];

    let upstream = null;
    for (const ttsUrl of urls) {
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://translate.google.com/'
        }
      });
      if (response.ok) {
        upstream = response;
        break;
      }
    }

    if (!upstream) {
      res.status(502).json({ error: 'TTS request failed' });
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.status(200).send(audio);
  } catch (error) {
    res.status(500).json({ error: 'TTS proxy failed' });
  }
}
