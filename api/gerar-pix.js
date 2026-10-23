import { services, requireUser, providerJson, fail } from './_firebase.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  try {
    const user = await requireUser(req);
    const amount = Number(req.body?.valor);
    const cents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount < 1 || !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 1e-7) return res.status(400).json({error:'Valor inválido (mínimo R$ 1,00, duas casas decimais)'});
    const token = process.env.PUSHINPAY_TOKEN;
    if (!token) throw new Error('PUSHINPAY_TOKEN ausente');
    const base = process.env.PUSHINPAY_API_BASE || 'https://api-sandbox.pushinpay.com.br/api';
    const webhookUrl = process.env.PUSHINPAY_WEBHOOK_URL;
    if (!webhookUrl?.startsWith('https://')) throw new Error('PUSHINPAY_WEBHOOK_URL deve ser HTTPS');
    if (!process.env.PUSHINPAY_WEBHOOK_SECRET) return res.status(503).json({error:'Recebimento PIX ainda não configurado. Aguarde a configuração do webhook.'});
    const data = await providerJson(`${base}/pix/cashIn`, {method:'POST', headers:{Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json'}, body:JSON.stringify({value:cents,webhook_url:webhookUrl})});
    if (!data.id || !data.qr_code) throw new Error('Resposta da PushinPay sem ID ou código PIX');
    const { db } = services();
    await db.collection('pix_deposits').doc(String(data.id)).create({userId:user.uid, amountCents:cents, status:'created', createdAt:Date.now(), provider:'pushinpay'});
    return res.status(200).json({success:true,idTransacao:data.id,qrCode:data.qr_code_base64 || '',copiaECola:data.qr_code});
  } catch(error) { return fail(res,error); }
}
