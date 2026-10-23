import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Configura o Firebase Admin se ainda não estiver inicializado
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { action, data } = req.body;

    // Verifica se a notificação do Mercado Pago é de um pagamento criado/atualizado
    if (action === 'payment.created' || action === 'payment.updated') {
      const paymentId = data.id;

      // Consulta os detalhes do pagamento na API do Mercado Pago
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADO_PAGO_TOKEN}`
        }
      });

      const payment = await response.json();

      // Se o status for "approved" (aprovado/pago)
      if (payment.status === 'approved') {
        const userId = payment.external_reference; // ID do usuário enviado na geração do PIX
        const valorPago = payment.transaction_amount;

        if (userId) {
          // Atualiza e incrementa o saldo do usuário no Firestore
          const userRef = db.collection('users').doc(userId);
          await userRef.update({
            saldo: FieldValue.increment(valorPago)
          });
        }
      }
    }

    // Responde 200 OK para o Mercado Pago não tentar reenviar
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
