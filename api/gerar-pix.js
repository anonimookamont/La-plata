export default async function handler(req, res) {
  // Cabeçalhos CORS para permitir requisições do site
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { transaction_amount, description, email } = body || {};
    
    // Procura o token limpo de espaços
    const rawToken = process.env.MERCADO_PAGO_TOKEN || '';
    const accessToken = rawToken.trim();

    if (!accessToken) {
      return res.status(500).json({ error: 'Token do Mercado Pago ausente nas variáveis da Vercel.' });
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      },
      body: JSON.stringify({
        transaction_amount: Number(transaction_amount),
        description: description || 'Aporte La Plata',
        payment_method_id: 'pix',
        payer: {
          email: email || 'cliente@la-plata.app.br'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || 'Erro de autorização no Mercado Pago.',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
