import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getFirebaseAdmin() {
  if (!getApps().length) {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("As credenciais do Firebase Admin não estão configuradas nas variáveis de ambiente da Vercel.");
    }

    privateKey = privateKey.trim();

    // Se estiver em Base64, decodifica para texto
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (e) {}
    }

    // Limpeza profunda de formatação e quebras de linha
    privateKey = privateKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\\\n/g, '\n')
      .replace(/\r\n/g, '\n');

    // Validação estrita do formato PEM para o OpenSSL
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }

    initializeApp({
      credential: cert({
        projectId: projectId.trim(),
        clientEmail: clientEmail.trim(),
        privateKey: privateKey
      })
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
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
    const db = getFirebaseAdmin();
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    body = body || {};

    const { userId, valor, tipoChave, chavePix } = body;

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
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    const userData = userDoc.data();
    const saldoAtual = userData.balance || userData.saldo || 0;

    if (saldoAtual < valorSaque) {
      return res.status(400).json({ error: 'Saldo insuficiente para realizar o saque.' });
    }

    await userRef.update({
      balance: FieldValue.increment(-valorSaque),
      saldo: FieldValue.increment(-valorSaque)
    });

    const saqueRef = await db.collection('saques').add({
      userId: userId,
      valor: valorSaque,
      tipoChave: tipoChave,
      chavePix: chavePix,
      status: 'pendente',
      createdAt: Date.now(),
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
