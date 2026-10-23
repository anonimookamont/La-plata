import {auth} from './firebase-config.js';
import {onAuthStateChanged,signInWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const labels={aberto:'Aberto',em_atendimento:'Em atendimento',aguardando_cliente:'Aguardando cliente',resolvido:'Resolvido'};
const categoryLabels={deposito:'Depósito Pix',saque:'Saque',planos:'Planos e aportes',conta:'Minha conta',outro:'Outro assunto'};
const root=document.querySelector('[data-support-center]');
if(root) {
  const admin=root.dataset.supportCenter==='admin';
  const prefix=admin?'support-admin':'support-client';
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const by=key=>root.querySelector('[data-support="'+key+'"]');
  let tickets=[],selectedId='',busy=false;
  root.innerHTML=`
    <div class="support-heading"><div><h2>${admin?'Central de atendimento':'Como podemos ajudar?'}</h2><p>${admin?'Acompanhe protocolos, responda clientes e organize os chamados.':'Abra um chamado e acompanhe a resposta da equipe por aqui.'}</p></div><button type="button" class="support-secondary" data-support="refresh">Atualizar</button></div>
    <p class="support-feedback" role="status" aria-live="polite" data-support="feedback"></p>
    ${admin?`<section class="support-login"><h3>Acesso da equipe de atendimento</h3><p>Use o e-mail autorizado e a senha da sua conta no site. Se ainda não tem conta, cadastre esse e-mail na página inicial.</p><form data-support="login"><label for="${prefix}-email">E-mail de acesso ao site</label><input id="${prefix}-email" name="email" type="email" autocomplete="username" required class="form-control"><label for="${prefix}-password">Senha da conta</label><input id="${prefix}-password" name="password" type="password" autocomplete="current-password" required class="form-control"><button class="btn btn-gold">Entrar no atendimento</button></form><button type="button" class="support-secondary" data-support="reset-password">Esqueci minha senha</button><p data-support="identity"></p><button type="button" class="support-secondary" data-support="verify">Enviar verificação do meu e-mail</button></section>`
    :`<button type="button" class="btn btn-gold" data-support="new">Abrir novo chamado</button><form class="support-new hidden" data-support="create"><label for="${prefix}-subject">Assunto</label><input class="form-control" id="${prefix}-subject" name="subject" minlength="3" maxlength="120" required placeholder="Resuma o que aconteceu"><div class="support-form-row"><div><label for="${prefix}-category">Categoria</label><select class="form-control" id="${prefix}-category" name="category"><option value="deposito">Depósito Pix</option><option value="saque">Saque</option><option value="planos">Planos e aportes</option><option value="conta">Minha conta</option><option value="outro">Outro assunto</option></select></div><div><label for="${prefix}-priority">Prioridade</label><select class="form-control" id="${prefix}-priority" name="priority"><option value="normal">Normal</option><option value="alta">Alta</option></select></div></div><label for="${prefix}-reference">ID da transação ou referência (opcional)</label><input class="form-control" id="${prefix}-reference" name="reference" maxlength="120" placeholder="Ajuda a localizar seu depósito ou aporte"><label for="${prefix}-message">O que aconteceu?</label><textarea class="form-control" id="${prefix}-message" name="message" rows="5" minlength="5" maxlength="4000" required placeholder="Conte o problema, a data e o que você esperava que acontecesse."></textarea><p class="support-tip">Não envie senhas, tokens, chaves privadas ou dados completos do cartão.</p><button class="btn btn-gold">Enviar para o atendimento</button></form>`}
    <div class="support-stats" data-support="stats"></div>
    <div class="support-toolbar"><label for="${prefix}-filter">Status<select id="${prefix}-filter" class="form-control" data-support="filter"><option value="">Todos</option>${Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')}</select></label><label for="${prefix}-search">Buscar<input id="${prefix}-search" class="form-control" data-support="search" placeholder="Assunto ou protocolo"></label></div>
    <div class="support-workspace"><div class="support-ticket-list" data-support="list"><p>Carregando chamados...</p></div><section class="support-detail hidden" data-support="detail"><div class="support-detail-heading"><div><p data-support="protocol"></p><h3 data-support="subject"></h3></div><span class="support-state" data-support="state"></span></div><p class="support-meta" data-support="meta"></p><div class="support-messages" role="log" aria-live="polite" data-support="messages"></div><form data-support="reply"><label for="${prefix}-reply">Mensagem</label><textarea id="${prefix}-reply" class="form-control" rows="4" name="message" maxlength="4000" required placeholder="Escreva uma resposta"></textarea>${admin?'<label class="support-note-check"><input type="checkbox" name="internal"> Nota interna — visível apenas para a equipe</label>':''}<button class="btn btn-gold">Enviar mensagem</button></form><div class="support-status-actions">${admin?`<label for="${prefix}-status">Alterar status<select id="${prefix}-status" class="form-control" data-support="status">${Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')}</select></label><button type="button" class="support-secondary" data-support="save-status">Salvar status</button>`:''}<button type="button" class="support-secondary" data-support="resolve">Marcar como resolvido</button><button type="button" class="support-secondary hidden" data-support="reopen">Reabrir chamado</button></div></section></div>`;
  const feedback=message=>{by('feedback').textContent=message;};
  async function api(id='',payload) {
    const user=auth.currentUser;
    if(!user) throw new Error('Entre na sua conta para acessar o atendimento.');
    const url='/api/atendimento?'+new URLSearchParams({...admin?{admin:'1'}:{},...id?{id}:{}});
    const res=await fetch(url,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+await user.getIdToken(true),...payload?{'Content-Type':'application/json'}:{}},...payload?{body:JSON.stringify(payload)}:{}});
    const data=await res.json();
    if(auth.currentUser?.uid!==user.uid)throw new Error('Sua sessão mudou. Atualize o atendimento.');
    if(!res.ok) {
      if(admin&&res.status===403&&data.uid) by('identity').textContent='UID da sua conta para autorização: '+data.uid;
      throw new Error(data.error||'Não foi possível acessar o atendimento.');
    }
    return data;
  }
  function renderList() {
    const list=by('list');list.replaceChildren();
    const filter=by('filter').value;
    const search=by('search').value.trim().toLowerCase();
    const items=tickets.filter(t=>(!filter||t.status===filter)&&(!search||[t.protocol,t.subject,t.userEmail].join(' ').toLowerCase().includes(search)));
    by('stats').replaceChildren(...[['Em aberto',tickets.filter(t=>t.status!=='resolvido').length],['Resolvidos',tickets.filter(t=>t.status==='resolvido').length]].map(([label,value])=>{const el=node('div','support-stat');el.append(node('strong','',String(value)),node('span','',label));return el;}));
    if(!items.length){list.append(node('p','support-empty','Nenhum chamado encontrado.'));return;}
    for(const t of items) {
      const button=node('button','support-ticket'+(selectedId===t.id?' selected':''));button.type='button';
      button.append(node('small','support-protocol',t.protocol),node('strong','',t.subject));
      const state=node('span','support-state',labels[t.status]||t.status);state.dataset.status=t.status;
      button.append(state,node('small','support-meta',new Date(t.updatedAt).toLocaleString('pt-BR')));
      if(admin)button.append(node('small','support-meta',t.userEmail||t.userId));
      button.addEventListener('click',()=>openTicket(t.id,true).catch(e=>feedback(e.message)));list.append(button);
    }
  }
  async function openTicket(id,change=false) {
    const data=await api(id);if(selectedId!==id&&change)by('reply').reset();
    selectedId=id;by('detail').classList.remove('hidden');
    const t=data.ticket;
    by('protocol').textContent=t.protocol;by('subject').textContent=t.subject;
    by('state').textContent=labels[t.status]||t.status;by('state').dataset.status=t.status;
    by('meta').textContent=[categoryLabels[t.category]||t.category,'Prioridade '+t.priority,t.reference?'Referência: '+t.reference:'',admin?(t.userEmail||t.userId):''].filter(Boolean).join(' · ');
    const log=by('messages');const atBottom=change||log.scrollHeight-log.scrollTop-log.clientHeight<60;log.replaceChildren();
    for(const m of data.messages) {
      const el=node('article','support-message support-message-'+m.authorRole+(m.internal?' support-internal':''));
      el.append(node('small','',m.internal?'Nota interna':m.authorRole==='admin'?'Atendimento':m.authorRole==='sistema'?'Sistema':'Cliente'),node('p','',m.text),node('time','',new Date(m.createdAt).toLocaleString('pt-BR')));log.append(el);
    }
    if(atBottom)log.scrollTop=log.scrollHeight;
    const resolved=t.status==='resolvido';by('reply').classList.toggle('hidden',resolved);
    by('resolve').classList.toggle('hidden',resolved);by('reopen').classList.toggle('hidden',!resolved);
    if(admin)by('status').value=t.status;
    renderList();
  }
  async function refresh() {
    if(!auth.currentUser){by('list').replaceChildren(node('p','support-empty','Entre na sua conta para consultar seus chamados.'));return;}
    const data=await api();tickets=data.tickets;renderList();
    if(selectedId&&tickets.some(t=>t.id===selectedId))await openTicket(selectedId);
    if(admin) {
      by('identity').textContent='Conta conectada: '+(auth.currentUser.email||auth.currentUser.uid);
      by('verify').classList.toggle('hidden',auth.currentUser.emailVerified===true);
    }
  }
  async function act(operation) {
    if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {await operation();}
    catch(e){feedback(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(e.code)?'E-mail ou senha incorretos. Use Esqueci minha senha para recuperar seu acesso.':e.message);}
    finally {busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  by('refresh').addEventListener('click',()=>act(async()=>{await refresh();feedback('Atendimento atualizado.');}));
  by('filter').addEventListener('change',renderList);by('search').addEventListener('input',renderList);
  if(!admin) {
    by('new').addEventListener('click',()=>by('create').classList.toggle('hidden'));
    by('create').addEventListener('submit',event=>{event.preventDefault();act(async()=>{
      const form=new FormData(by('create'));const result=await api('',{action:'create',...Object.fromEntries(form)});
      by('create').reset();by('create').classList.add('hidden');await refresh();await openTicket(result.id,true);
      feedback('Chamado '+result.protocol+' enviado. Você pode acompanhar e responder por aqui.');
    });});
  } else {
    by('login').addEventListener('submit',event=>{event.preventDefault();act(async()=>{
      const form=new FormData(by('login'));await signInWithEmailAndPassword(auth,String(form.get('email')),String(form.get('password')));
      by('login').reset();await refresh();feedback('Acesso ao atendimento confirmado.');
    });});
    by('reset-password').addEventListener('click',()=>act(async()=>{
      const input=by('login').elements.namedItem('email');
      if(!input.value.trim()||!input.reportValidity())throw new Error('Preencha seu e-mail de acesso primeiro.');
      await sendPasswordResetEmail(auth,input.value.trim());
      feedback('Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também o spam.');
    }));
    by('verify').addEventListener('click',()=>act(async()=>{
      if(!auth.currentUser)throw new Error('Entre com seu e-mail e senha primeiro.');
      await sendEmailVerification(auth.currentUser);feedback('Verificação enviada para seu e-mail. Após confirmar, entre novamente.');
    }));
    by('save-status').addEventListener('click',()=>changeStatus(by('status').value));
  }
  by('reply').addEventListener('submit',event=>{event.preventDefault();act(async()=>{
    const form=new FormData(by('reply'));await api(selectedId,{action:'reply',message:String(form.get('message')),internal:form.has('internal')});
    by('reply').reset();await refresh();feedback('Mensagem enviada.');
  });});
  const changeStatus=status=>act(async()=>{await api(selectedId,{action:'status',status});await refresh();feedback('Status atualizado.');});
  by('resolve').addEventListener('click',()=>changeStatus('resolvido'));by('reopen').addEventListener('click',()=>changeStatus('aberto'));
  onAuthStateChanged(auth,()=>{selectedId='';tickets=[];by('detail').classList.add('hidden');refresh().catch(e=>feedback(e.message));});
  const visible=()=>root.getClientRects().length>0&&document.visibilityState==='visible';
  window.supportRefresh=()=>{if(visible()&&!busy)refresh().catch(e=>feedback(e.message));};
  setInterval(()=>{if(visible()&&!busy)refresh().catch(e=>feedback(e.message));},30000);
  document.addEventListener('visibilitychange',()=>{if(visible()&&!busy)refresh().catch(e=>feedback(e.message));});
}
