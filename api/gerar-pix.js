export default async function handler(req, res) {
  // Cabeçalhos CORS para permitir requisições do seu site
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
    const { transaction_amount, description, email, userId } = body;

    // Se não informar o valor, o padrão para teste passa a ser R$ 1.00
    const valorDeposito = transaction_amount ? Number(transaction_amount) : 1.00;

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_TOKEN}`
      },
      body: JSON.stringify({
        transaction_amount: valorDeposito,
        description: description || 'Aporte La Plata',
        payment_method_id: 'pix',
        external_reference: userId, // Identifica qual utilizador fez o depósito
        notification_url: 'https://laplata-five.vercel.app/api/webhook-pix', // Link do webhook
        payer: {
          email: email || 'cliente@email.com'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({
      id: data.id,
      qr_code: data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: data.point_of_interaction.transaction_data.ticket_url
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
