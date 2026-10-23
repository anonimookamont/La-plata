import { timingSafeEqual } from 'node:crypto';
import { services, providerJson, fail } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
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
    const {db}=services();
    await db.runTransaction(async tx => {
      const depRef=db.collection('pix_deposits').doc(id);
      const dep=await tx.get(depRef);
      if(!dep.exists) throw Object.assign(new Error('Depósito desconhecido'),{status:404});
      const d=dep.data();
      if(d.status==='paid') return;
      if(Number(payment.value)!==d.amountCents) throw Object.assign(new Error('Valor divergente'),{status:409});
      const userRef=db.collection('users').doc(d.userId);
      const u=await tx.get(userRef);
      if(!u.exists) throw Object.assign(new Error('Usuário não encontrado'),{status:404});
      tx.update(userRef,{balance:FieldValue.increment(d.amountCents/100)});
      tx.update(depRef,{status:'paid',paidAt:Date.now()});
    });
    return res.status(200).json({received:true});
  } catch(error) {return fail(res,error);}
}
