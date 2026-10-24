import { services, providerJson, fail } from './_firebase.js';
import { creditConfirmedPix } from './_pix-credit.js';

// A notificação é apenas um gatilho. A confirmação vem da API autenticada.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  try {
    const rawId = req.body?.id || req.body?.transaction_id;
    if (!rawId) return res.status(200).json({received:true,credited:false});
    if(typeof rawId !== 'string' || !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(rawId)) return res.status(400).json({error:'ID inválido'});
    const {db}=services();
    // Só consultar cobranças criadas por este site; preservar a caixa do ID salvo.
    let dep;
    for(const id of [...new Set([rawId,rawId.toLowerCase(),rawId.toUpperCase()])]) {
      const snap=await db.collection('pix_deposits').doc(id).get();
      if(snap.exists){dep=snap;break;}
    }
    if(!dep) return res.status(200).json({received:true,credited:false});
    if(dep.data().status==='paid' && dep.data().receiptRecorded) return res.status(200).json({received:true,credited:false});
    const token=process.env.PUSHINPAY_TOKEN;
    if(!token) return res.status(503).json({error:'Consulta de pagamento indisponível'});
    // Limitar consultas concorrentes/repetidas por cobrança sem aceitar o payload como prova.
    const lock=db.collection('pix_webhook_checks').doc(dep.id);
    const now=Date.now();
    const acquired=await db.runTransaction(async tx=>{
      const snap=await tx.get(lock);
      if(snap.exists && Number(snap.data().nextCheckAt)>now)return false;
      tx.set(lock,{nextCheckAt:now+10000});
      return true;
    });
    if(!acquired){res.setHeader('Retry-After','10');return res.status(429).json({error:'Tente novamente em alguns segundos'});}
    const base=process.env.PUSHINPAY_API_BASE || 'https://api-sandbox.pushinpay.com.br/api';
    const payment=await providerJson(base+'/transactions/'+encodeURIComponent(dep.id),{
      headers:{Authorization:'Bearer '+token,Accept:'application/json'}
    });
    if(typeof payment.id!=='string'||payment.id.toLowerCase()!==dep.id.toLowerCase()) return res.status(409).json({error:'Transação divergente'});
    if(payment.status!=='paid')return res.status(200).json({received:true,credited:false});
    const result=await creditConfirmedPix(dep.id,payment);
    return res.status(200).json({received:true,credited:result.credited});
  }catch(error){return fail(res,error);}
}
