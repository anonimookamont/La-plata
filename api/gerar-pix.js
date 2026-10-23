export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    body = body || {};

    const rawValor = body.valor !== undefined ? body.valor : (body.amount !== undefined ? body.amount : body.value);
    const valorNumerico = Number(rawValor);

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({ error: 'Valor inválido para depósito.' });
    }

    const pushinPayToken = process.env.PUSHINPAY_TOKEN;
    if (!pushinPayToken) {
      return res.status(500).json({ error: 'Token da PushinPay não configurado na Vercel.' });
    }

    const valorEmCentavos = Math.round(valorNumerico * 100);

    const response = await fetch('https://api.pushinpay.com.br/api/v1/pix/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pushinPayToken.trim()}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: valorEmCentavos
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Erro ao gerar PIX na PushinPay.');
    }

    return res.status(200).json({
      success: true,
      idTransacao: data.id || data.transaction_id,
      qrCode: data.qr_code_base64 || data.qr_code || data.emv,
      copiaECola: data.qr_code || data.emv || data.qr_code_base64
    });

  } catch (error) {
    console.error('Erro no gerar-pix:', error);
    return res.status(500).json({ error: error.message });
  }
}
