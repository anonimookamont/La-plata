import { services, requireUser, providerJson, fail } from './_firebase.js';
import { creditConfirmedPix } from './_pix-credit.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  try {
    const user = await requireUser(req);
    const {db} = services();
    // Uma consulta por minuto por usuário, inclusive entre abas.
    const checkRef = db.collection('pix_status_checks').doc(user.uid);
    const now = Date.now();
    const retryAfterSeconds = await db.runTransaction(async tx => {
      const snap = await tx.get(checkRef);
      const next = snap.exists ? Number(snap.data().nextCheckAt || 0) : 0;
      if (next > now) return Math.ceil((next-now)/1000);
      tx.set(checkRef,{nextCheckAt:now+60000});
      return 0;
    });
    const getBalance = async () => {
      const snap = await db.collection('users').doc(user.uid).get();
      if (!snap.exists) throw Object.assign(new Error('Usuário não encontrado'),{status:404});
      return Number(snap.data().balance || 0);
    };
    if (retryAfterSeconds) return res.status(200).json({success:true,rateLimited:true,retryAfterSeconds,balance:await getBalance()});

    const snapshot = await db.collection('pix_deposits').where('userId','==',user.uid).get();
    const deposits = snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    const pending = deposits.filter(d=>d.status==='created').sort((a,b)=>b.createdAt-a.createdAt).slice(0,3);
    const missingReceipts = deposits.filter(d=>d.status==='paid'&&!d.receiptRecorded).slice(0,20);
    let credited = 0, receipts = 0, checked = 0, failed = 0;
    // Recuperar avisos antigos de depósitos já creditados sem somar o saldo novamente.
    for (const d of missingReceipts) {
      const result = await creditConfirmedPix(d.id,{id:d.id,status:'paid',value:d.amountCents},user.uid);
      if (result.receiptCreated) receipts++;
    }
    const token = process.env.PUSHINPAY_TOKEN;
    const base = process.env.PUSHINPAY_API_BASE || 'https://api-sandbox.pushinpay.com.br/api';
    if (pending.length && !token) throw new Error('PushinPay não configurada');
    for (const d of pending) {
      try {
        const payment = await providerJson(base+'/transactions/'+encodeURIComponent(d.id), {
          headers:{Authorization:'Bearer '+token,Accept:'application/json'}
        });
        checked++;
        if (payment.status === 'paid') {
          const result = await creditConfirmedPix(d.id,payment,user.uid);
          if (result.credited) credited++;
          if (result.receiptCreated) receipts++;
        }
      } catch (error) {
        failed++;
        // Não registrar resposta do provedor, tokens nem dados pessoais.
        console.error('pix_reconciliation_failed',{code:error.status || 500});
      }
    }
    return res.status(200).json({
      success:true,checked,credited,receipts,failed,balance:await getBalance(),
      pending:Math.max(0,deposits.filter(d=>d.status==='created').length-credited)
    });
  } catch(error) {return fail(res,error);}
}
