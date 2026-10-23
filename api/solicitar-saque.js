import { services, requireUser, fail } from './_firebase.js';
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido'});
  try {
    const user=await requireUser(req);
    const amount=Number(req.body?.valor);
    if(Number.isFinite(amount)&&amount<120) return res.status(400).json({error:'O saque mínimo é de R$ 120,00.'});
    const key=String(req.body?.chavePix || '').trim();
    const type=String(req.body?.tipoChave || '');
    if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100||key.length<3||key.length>150||!['cpf','cnpj','email','phone','evp','national_registration','telefone','aleatoria'].includes(type)) return res.status(400).json({error:'Dados de saque inválidos'});
    const {db}=services();
    const withdrawalRef=db.collection('saques').doc();
    await db.runTransaction(async tx=>{
      const userRef=db.collection('users').doc(user.uid);
      const snap=await tx.get(userRef);
      if(!snap.exists) throw Object.assign(new Error('Usuário não encontrado'),{status:404});
      const balance=Number(snap.data().balance || 0);
      if(!Number.isFinite(balance)||balance<amount) throw Object.assign(new Error('Saldo insuficiente'),{status:400});
      tx.update(userRef,{balance:Math.round((balance-amount)*100)/100});
      tx.create(withdrawalRef,{userId:user.uid,valor:amount,tipoChave:type,chavePix:key,status:'pendente',createdAt:Date.now()});
    });
    return res.status(200).json({success:true,saqueId:withdrawalRef.id,message:'Saque solicitado; pagamento sujeito a conferência manual.'});
  }catch(error){return fail(res,error);}
}
