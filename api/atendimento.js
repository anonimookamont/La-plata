import { services, requireUser, fail } from './_firebase.js';
const categories = ['deposito','saque','planos','conta','outro'];
const statuses = ['aberto','em_atendimento','aguardando_cliente','resolvido'];
function text(value,min,max,label) {
  if(typeof value !== 'string') throw Object.assign(new Error(label+' inválido'),{status:400});
  const result=value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  if(result.length<min||result.length>max) throw Object.assign(new Error(label+' deve ter entre '+min+' e '+max+' caracteres'),{status:400});
  return result;
}
function allowedAdmin(user) {
  if(user.admin===true||user.supportAdmin===true) return true;
  const uids=(process.env.SUPPORT_ADMIN_UIDS||'').split(',').map(v=>v.trim()).filter(Boolean);
  const emails=(process.env.SUPPORT_ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  return uids.includes(user.uid) || (user.email_verified===true && emails.includes(String(user.email||'').toLowerCase()));
}
function viewTicket(doc,admin) {
  const d=doc.data();
  const out={id:doc.id,protocol:d.protocol,subject:d.subject,category:d.category,priority:d.priority,
    status:d.status,reference:d.reference||'',createdAt:d.createdAt,updatedAt:d.updatedAt,lastMessage:d.lastMessage||''};
  if(admin) Object.assign(out,{userId:d.userId,userEmail:d.userEmail||'',userName:d.userName||'Cliente'});
  return out;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Método não permitido'});
  try {
    const user=await requireUser(req);
    const {db}=services();
    const admin=String(req.query?.admin||'')==='1';
    if(admin && !allowedAdmin(user)) return res.status(403).json({error:'Conta sem permissão de atendimento. Autorize seu UID no Vercel ou use um e-mail administrativo verificado.',uid:user.uid,emailVerified:user.email_verified===true});
    const id=String(req.query?.id||req.body?.id||'');
    if(id && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return res.status(400).json({error:'Protocolo inválido'});
    const tickets=db.collection('support_tickets');
    const load=async()=>{
      const doc=await tickets.doc(id).get();
      if(!doc.exists || (!admin && doc.data().userId!==user.uid)) throw Object.assign(new Error('Chamado não encontrado'),{status:404});
      return doc;
    };
    if(req.method==='GET') {
      if(!id) {
        const snap=await (admin?tickets:tickets.where('userId','==',user.uid)).get();
        const items=snap.docs.map(doc=>viewTicket(doc,admin)).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,100);
        return res.status(200).json({success:true,tickets:items});
      }
      const doc=await load();
      const msgs=await doc.ref.collection('messages').orderBy('createdAt','desc').limit(100).get();
      const messages=msgs.docs.map(m=>({id:m.id,...m.data()})).filter(m=>admin||!m.internal).reverse();
      return res.status(200).json({success:true,ticket:viewTicket(doc,admin),messages});
    }
    const action=String(req.body?.action||'');
    if(action==='create'&&!admin) {
      const subject=text(req.body.subject,3,120,'Assunto');
      const message=text(req.body.message,5,4000,'Mensagem');
      const category=String(req.body.category||'outro');
      if(!categories.includes(category)) return res.status(400).json({error:'Categoria inválida'});
      const reference=req.body.reference?text(req.body.reference,1,120,'Referência'):'';
      const priority=req.body.priority==='alta'?'alta':'normal';
      const ref=tickets.doc();
      const now=Date.now();
      const protocol='LP-'+new Date(now).toISOString().slice(0,10).replace(/-/g,'')+'-'+ref.id.slice(0,10).toUpperCase();
      const rateRef=db.collection('support_creation_limits').doc(user.uid);
      const msg=ref.collection('messages').doc();
      await db.runTransaction(async tx=>{
        const rate=await tx.get(rateRef);
        const existing=await tx.get(tickets.where('userId','==',user.uid));
        if(rate.exists && Number(rate.data().nextAt)>now) throw Object.assign(new Error('Aguarde um minuto antes de abrir outro chamado'),{status:429});
        if(existing.docs.filter(d=>d.data().status!=='resolvido').length>=5) throw Object.assign(new Error('Você já tem cinco chamados em aberto. Responda a um deles.'),{status:409});
        tx.set(rateRef,{nextAt:now+60000});
        tx.create(ref,{userId:user.uid,userEmail:user.email||'',userName:user.name||'Cliente',subject,category,reference,priority,
          protocol,status:'aberto',createdAt:now,updatedAt:now,lastMessage:message.slice(0,160),lastClientMessageAt:now});
        tx.create(msg,{authorRole:'cliente',text:message,createdAt:now,internal:false});
      });
      return res.status(201).json({success:true,id:ref.id,protocol});
    }
    if(!id) return res.status(400).json({error:'Informe o chamado'});
    if(!['reply','status'].includes(action)) return res.status(400).json({error:'Ação inválida'});
    const ref=tickets.doc(id);
    const now=Date.now();
    const message=action==='reply'?text(req.body.message,1,4000,'Mensagem'):'';
    const internal=admin&&req.body.internal===true;
    const target=String(req.body.status||'');
    if(action==='status' && (!statuses.includes(target)||(!admin&&!['aberto','resolvido'].includes(target))))
      return res.status(400).json({error:'Status inválido'});
    const messageRef=ref.collection('messages').doc();
    const noticeRef=db.collection('transactions').doc('support_'+messageRef.id);
    await db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if(!doc.exists||(!admin&&doc.data().userId!==user.uid)) throw Object.assign(new Error('Chamado não encontrado'),{status:404});
      const d=doc.data();
      if(action==='reply') {
        if(d.status==='resolvido') throw Object.assign(new Error('Reabra o chamado antes de responder'),{status:409});
        const last=Number(d[admin?'lastAdminMessageAt':'lastClientMessageAt']||0);
        if(now-last<3000) throw Object.assign(new Error('Aguarde alguns segundos para enviar outra mensagem'),{status:429});
        tx.create(messageRef,{authorRole:admin?'admin':'cliente',text:message,createdAt:now,internal});
        const patch={updatedAt:now,[admin?'lastAdminMessageAt':'lastClientMessageAt']:now};
        if(!internal) Object.assign(patch,{lastMessage:message.slice(0,160),status:admin?'aguardando_cliente':'aberto'});
        tx.update(ref,patch);
      } else {
        tx.update(ref,{status:target,updatedAt:now});
        tx.create(messageRef,{authorRole:'sistema',text:'Status alterado para '+target.replace(/_/g,' ')+'.',createdAt:now,internal:false});
      }
      if(admin&&!internal) tx.create(noticeRef,{userId:d.userId,type:'notificacao',category:'atendimento',
        description:'Atendimento '+d.protocol+': '+(action==='reply'?'você recebeu uma resposta. Abra a aba Atendimento.':'status atualizado. Consulte a aba Atendimento.'),
        amount:0,status:'concluido',createdAt:now,supportTicketId:id});
    });
    return res.status(200).json({success:true});
  } catch(error) {return fail(res,error);}
}
