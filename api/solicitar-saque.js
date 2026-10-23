import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Inicializa o Firebase Admin na Vercel
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  // Configuração de cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { userId, valor, tipoChave, chavePix } = body;

    // Validações dos dados enviados
    if (!userId || !valor || !chavePix || !tipoChave) {
      return res.status(400).json({ error: 'Dados incompletos. Informe userId, valor, tipoChave e chavePix.' });
    }

    const valorSaque = Number(valor);
    if (isNaN(valorSaque) || valorSaque <= 0) {
      return res.status(400).json({ error: 'Valor de saque inválido.' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const userData = userDoc.data();
    const saldoAtual = userData.saldo || 0;

    // Verifica se o usuário tem saldo suficiente
    if (saldoAtual < valorSaque) {
      return res.status(400).json({ error: 'Saldo insuficiente para realizar o saque.' });
    }

    // 1. Deduz o valor do saldo do usuário no Firestore
    await userRef.update({
      saldo: FieldValue.increment(-valorSaque)
    });

    // 2. Registra a solicitação de saque na coleção 'saques'
    const saqueRef = await db.collection('saques').add({
      userId: userId,
      valor: valorSaque,
      tipoChave: tipoChave, // ex: 'cpf', 'email', 'telefone', 'aleatoria'
      chavePix: chavePix,
      status: 'pendente', // 'pendente', 'concluido', 'rejeitado'
      criadoEm: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Solicitação de saque realizada com sucesso!',
      saqueId: saqueRef.id,
      novoSaldo: saldoAtual - valorSaque
    });

  } catch (error) {
    console.error('Erro ao processar saque:', error);
    return res.status(500).json({ error: error.message });
  }
}
  
