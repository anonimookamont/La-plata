import { FieldValue } from 'firebase-admin/firestore';
import { services, requireUser, fail } from './_firebase.js';
import { activePlanCount } from '../Js/plan-capacity.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  try {
    const user = await requireUser(req);
    const planId = String(req.body?.planId || '');
    const requestId = String(req.body?.requestId || '');
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(planId) || !/^[a-f0-9-]{36}$/i.test(requestId))
      return res.status(400).json({error:'Solicitação de aporte inválida'});
    const {db} = services();
    const userRef = db.collection('users').doc(user.uid);
    const planRef = db.collection('plans').doc(planId);
    const purchaseRef = db.collection('transactions').doc('plan_'+user.uid+'_'+requestId);
    const result = await db.runTransaction(async tx => {
      const existing = await tx.get(purchaseRef);
      if (existing.exists) {
        const saved = existing.data();
        if(saved.userId !== user.uid || saved.planId !== planId) throw Object.assign(new Error('Solicitação já utilizada'),{status:409});
        return {success:true,id:purchaseRef.id,replayed:true};
      }
      const planSnap = await tx.get(planRef);
      const userSnap = await tx.get(userRef);
      const items = await tx.get(db.collection('transactions').where('userId','==',user.uid));
      if (!planSnap.exists) throw Object.assign(new Error('Plano indisponível'),{status:404});
      if (!userSnap.exists) throw Object.assign(new Error('Usuário não encontrado'),{status:404});
      const plan = {id:planId,...planSnap.data()};
      const price = Number(plan.price);
      const cents = Math.round(price*100);
      const days = Number(plan.durationDays || 30);
      const totalReturn = Number(plan.totalReturn || price*1.30);
      if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isFinite(price) || Math.abs(price*100-cents)>1e-7
        || !Number.isFinite(days) || days<=0 || !Number.isFinite(totalReturn) || totalReturn<0)
        throw Object.assign(new Error('Configuração do plano inválida'),{status:409});
      const now = Date.now();
      const active = activePlanCount(items.docs.map(d=>d.data()),plan,now);
      const limit = Math.max(0,Number(plan.limitPerUser)||0);
      if (limit && active >= limit) throw Object.assign(new Error('Limite de aportes ativos atingido. Uma vaga será liberada ao encerrar um ciclo.'),{status:409});
      const balanceCents = Math.round(Number(userSnap.data().balance || 0)*100);
      if (!Number.isSafeInteger(balanceCents) || balanceCents<cents) throw Object.assign(new Error('Saldo insuficiente'),{status:400});
      const endDate = now+days*86400000;
      if (!Number.isSafeInteger(endDate)) throw Object.assign(new Error('Prazo do plano inválido'),{status:409});
      tx.create(purchaseRef,{
        userId:user.uid,planId,type:'produto_adquirido',
        description:'Aplicação: '+String(plan.title || 'Carteira')+' ('+String(plan.frequency||'diario').toUpperCase()+')',
        amount:cents/100,totalReturn:Math.round(totalReturn*100)/100,
        frequency:plan.frequency||'diario',durationDays:days,startDate:now,endDate,status:'ativo',createdAt:now
      });
      tx.update(userRef,{balance:FieldValue.increment(-cents/100)});
      return {success:true,id:purchaseRef.id,active:active+1,available:limit?Math.max(0,limit-active-1):null};
    });
    return res.status(200).json(result);
  } catch(error) {return fail(res,error);}
}
