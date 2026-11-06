// Intermediário das velas da Binance para o vigia dos alertas do Scanner de Estrutura.
// Corre no Vercel em Dublin (a Binance recusa os servidores do Google e da Cloudflare).
//   /api/velas?symbol=BTCUSDT&i=1M,1w,1d,4h,1h,15m,5m&limit=1000   → vários timeframes de uma vez
//   /api/velas?symbol=BTCUSDT&i=1h&limit=1000&endTime=...           → história mais antiga de um timeframe
// Resposta: { regiao, "1h": [[abertura, aberto, máximo, mínimo, fecho, volume, fecho_ms], ...], ... }
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
const IVS = ['1M', '1w', '1d', '4h', '1h', '15m', '5m'];

async function klines(q) {
  let last = null;
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + '/api/v3/klines?' + q);
      if (r.ok) return { rows: (await r.json()).map((k) => [k[0], +k[1], +k[2], +k[3], +k[4], +k[5], k[6]]) };
      last = { error: 'Binance ' + r.status + ' em ' + h.replace('https://', '') };
    } catch (e) { last = { error: String(e.message || e) }; }
  }
  return last;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const u = new URL(req.url, 'http://x'), p = u.searchParams;
  const symbol = (p.get('symbol') || '').toUpperCase();
  const ivs = (p.get('i') || '1h').split(',').filter((x) => IVS.includes(x));
  const limit = Math.max(1, Math.min(1000, +p.get('limit') || 1000));
  const endTime = /^\d+$/.test(p.get('endTime') || '') ? p.get('endTime') : null;
  if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !ivs.length) return res.status(400).json({ error: 'pedido inválido' });
  const out = { regiao: process.env.VERCEL_REGION || '?' };
  await Promise.all(ivs.map(async (iv) => {
    const r = await klines(`symbol=${symbol}&interval=${iv}&limit=${limit}` + (endTime ? `&endTime=${endTime}` : ''));
    out[iv] = r.rows || { error: r.error };
  }));
  res.status(200).json(out);
};
