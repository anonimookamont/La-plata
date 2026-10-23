import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function services() {
  if (!getApps().length) {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
    if (!projectId || !clientEmail || !key) throw new Error('Firebase Admin não configurado');
    const privateKey = key.includes('BEGIN PRIVATE KEY') ? key.replace(/\\n/g, '\n') : Buffer.from(key, 'base64').toString('utf8').replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { db: getFirestore(), auth: getAuth() };
}
export async function requireUser(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) throw Object.assign(new Error('Autenticação necessária'), { status: 401 });
  let auth;
  try { auth = services().auth; }
  catch (error) {
    console.error('firebase_admin_init_failed', {code: String(error.code || 'initialization_error')});
    throw Object.assign(new Error('Configuração do servidor Firebase inválida. Contate o administrador.'), {status:503});
  }
  try { return await auth.verifyIdToken(match[1], true); }
  catch (error) {
    const code = String(error.code || 'verification_error');
    console.error('firebase_token_verification_failed', {code});
    const serverError = ['auth/invalid-credential', 'auth/insufficient-permission', 'app/invalid-credential', 'auth/internal-error'].includes(code);
    const expired = ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled'].includes(code);
    throw Object.assign(new Error(serverError ? 'Falha na configuração de autenticação do servidor.' : expired ? 'Sessão expirada ou encerrada. Saia e entre novamente.' : 'Sessão inválida. Saia e entre novamente.'), {status:serverError ? 503 : 401});
  }
}
export async function providerJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw Object.assign(new Error(`Provedor retornou resposta não JSON (HTTP ${response.status})`), { status: 502 }); }
  if (!response.ok) throw Object.assign(new Error(`Provedor rejeitou solicitação (HTTP ${response.status}): ${String(data.message || data.error || 'verifique token e parâmetros').slice(0, 120)}`), { status: 502 });
  return data;
}
export function fail(res, error) { console.error(error); return res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno. Consulte os logs.' }); }
