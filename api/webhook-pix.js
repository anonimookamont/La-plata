import { timingSafeEqual } from 'node:crypto';
import { providerJson, fail } from './_firebase.js';
import { creditConfirmedPix } from './_pix-credit.js';
export default async function handler(req,res) {
  if(req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  try {
    // No painel PushinPay: Authorization = Bearer <segredo do webhook>.
    // Também aceita o header customizado X-Webhook-Secret.
    const expected = process.env.PUSHINPAY_WEBHOOK_SECRET;
    const authorization = req.headers.authorization;
    const received = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7) : req.headers['x-webhook-secret'];
    const expectedBytes = Buffer.from(expected || '');
    const receivedBytes = Buffer.from(typeof received === 'string' ? received : '');
    if(!expected || expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) return res.status(401).json({error:'Webhook não autorizado'});
    const id = String(req.body?.id || '');
    // O painel envia um POST de verificação sem transação. Autenticar acima,
    // confirmar somente o recebimento e nunca consultar o provedor ou creditar.
    if (!id) return res.status(200).json({received:true,credited:false,ignored:'missing_transaction_id'});
    if(!/^[a-zA-Z0-9-]{10,100}$/.test(id)) return res.status(400).json({error:'ID inválido'});
    const token = process.env.PUSHINPAY_TOKEN;
    const base = process.env.PUSHINPAY_API_BASE || 'https://api-sandbox.pushinpay.com.br/api';
    // Nunca confiar somente no payload do webhook: consultar o provedor.
    const payment = await providerJson(`${base}/transactions/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
    if(payment.status !== 'paid') return res.status(200).json({received:true,credited:false});
    const result = await creditConfirmedPix(id, payment);
    return res.status(200).json({received:true,credited:result.credited});
  } catch(error) {return fail(res,error);}
}
