module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { transaction_amount, description, email } = req.body;
    const accessToken = process.env.MERCADO_PAGO_TOKEN;

    if (!accessToken) {
      return res.status(500).json({ error: 'Token do Mercado Pago não configurado na Vercel.' });
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
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
      return res.status(400).json({ error: data.message || 'Erro ao gerar PIX' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
