import { services } from './_firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

export async function creditConfirmedPix(id, payment, expectedUserId = null) {
  const {db} = services();
  return db.runTransaction(async tx => {
    const depRef = db.collection('pix_deposits').doc(id);
    const dep = await tx.get(depRef);
    if (!dep.exists) throw Object.assign(new Error('Depósito desconhecido'), {status:404});
    const d = dep.data();
    if (expectedUserId && d.userId !== expectedUserId) throw Object.assign(new Error('Depósito não autorizado'), {status:403});
    if (!Number.isSafeInteger(d.amountCents) || d.amountCents <= 0) throw Object.assign(new Error('Valor do depósito inválido'), {status:409});
    if (payment.status !== 'paid') return {credited:false,receiptCreated:false};
    if (payment.id && String(payment.id).toLowerCase() !== id.toLowerCase()) throw Object.assign(new Error('Transação divergente'), {status:409});
    if (Number(payment.value) !== d.amountCents) throw Object.assign(new Error('Valor divergente'), {status:409});

    const userRef = db.collection('users').doc(d.userId);
    const movementRef = db.collection('transactions').doc('pix_' + id);
    const noticeRef = db.collection('transactions').doc('pix_notice_' + id);
    // Todas as leituras precedem as escritas da transação.
    const user = await tx.get(userRef);
    const movement = await tx.get(movementRef);
    const notice = await tx.get(noticeRef);
    if (!user.exists) throw Object.assign(new Error('Usuário não encontrado'), {status:404});
    const amount = d.amountCents / 100;
    const paidAt = d.paidAt || Date.now();
    const credited = d.status !== 'paid';
    if (credited) tx.update(userRef, {balance:FieldValue.increment(amount)});
    if (!movement.exists) tx.create(movementRef, {
      userId:d.userId,type:'deposito_pix',description:'Depósito PIX confirmado',
      amount,status:'concluido',createdAt:paidAt,provider:'pushinpay',providerTransactionId:id
    });
    if (!notice.exists) tx.create(noticeRef, {
      userId:d.userId,type:'notificacao',category:'deposito_pix',
      description:'Depósito PIX de ' + amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) + ' confirmado e creditado no seu saldo.',
      amount:0,depositAmount:amount,status:'concluido',createdAt:paidAt,providerTransactionId:id
    });
    tx.update(depRef,{status:'paid',paidAt,receiptRecorded:true});
    return {credited,receiptCreated:!notice.exists,amount};
  });
}
