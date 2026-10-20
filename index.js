import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, setDoc, getDoc, addDoc, collection, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let isSignUp = false;

// Elementos DOM de Autenticação
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authTitle = document.getElementById("auth-title");
const nameGroup = document.getElementById("name-group");
const btnSubmit = document.getElementById("btn-submit");
const btnToggleMode = document.getElementById("btn-toggle-mode");

// Alternar entre Login e Cadastro
btnToggleMode.addEventListener("click", () => {
  isSignUp = !isSignUp;
  authTitle.innerText = isSignUp ? "Criar Conta - La Plata" : "Login do Investidor";
  nameGroup.style.display = isSignUp ? "block" : "none";
  btnSubmit.innerText = isSignUp ? "Cadastrar" : "Entrar";
  btnToggleMode.innerText = isSignUp ? "Já tenho uma conta" : "Criar uma conta";
});

// Autenticação (Login / Cadastro)
btnSubmit.addEventListener("click", async () => {
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value;

  try {
    if (isSignUp) {
      if (!name) return alert("Por favor, preencha o seu nome.");
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      // Cria o documento do usuário
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        name: name,
        email: email,
        balance: 0.00,
        yieldTotal: 0.00,
        isAdmin: false,
        createdAt: new Date()
      });

      // Cria uma notificação inicial de boas-vindas
      await addDoc(collection(db, "transactions"), {
        userId: res.user.uid,
        type: "notificacao",
        description: "Bem-vindo à plataforma La Plata! Conta criada com sucesso.",
        amount: 0.00,
        status: "concluido",
        createdAt: new Date()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    alert("Erro na autenticação: " + error.message);
  }
});

// Controle de Sessão
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    loadUserData(user.uid);
    loadTransactions(user.uid);
  } else {
    authSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
  }
});

// Carregar Dados do Usuário e Preencher Perfil
function loadUserData(uid) {
  onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      document.getElementById("user-name").innerText = data.name;
      document.getElementById("user-balance").innerText = `$ ${data.balance.toFixed(2)}`;
      document.getElementById("user-yield").innerText = `$ ${(data.yieldTotal || 0).toFixed(2)}`;
      
      // Preenche aba de perfil
      document.getElementById("profile-name").value = data.name;
      document.getElementById("profile-email").value = data.email;
      document.getElementById("profile-uid").value = data.uid;
    }
  });
}

// Comprar Produto de Investimento ($100, $250, $390, $670, $860, $1200)
window.buyInvestment = async (amount) => {
  const user = auth.currentUser;
  if (!user) return;

  const confirmBuy = confirm(`Deseja adquirir o plano de investimento no valor de $${amount}?`);
  if (!confirmBuy) return;

  try {
    // Registra a transação/aquisição do produto
    await addDoc(collection(db, "transactions"), {
      userId: user.uid,
      type: "produto_adquirido",
      description: `Aquisição de Plano de Investimento ($${amount})`,
      amount: amount,
      status: "ativo",
      createdAt: new Date()
    });

    alert(`Parabéns! Investimento de $${amount} adquirido com sucesso.`);
  } catch (error) {
    alert("Erro ao processar investimento: " + error.message);
  }
};

// Carregar Histórico Unificado (Pix Recebido, Pix Enviado, Produtos, Notificações)
function loadTransactions(uid) {
  const q = query(collection(db, "transactions"), where("userId", "==", uid));
  onSnapshot(q, (snapshot) => {
    const list = document.getElementById("transactions-list");
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum registro encontrado no histórico.</td></tr>`;
      return;
    }
    
    // Ordena localmente por data mais recente
    const docsData = [];
    snapshot.forEach((docSnap) => docsData.push(docSnap.data()));
    docsData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    docsData.forEach((t) => {
      const date = t.createdAt ? new Date(t.createdAt.toDate()).toLocaleString("pt-BR") : "-";
      
      let badgeClass = "badge-approved";
      if (t.status === 'pendente') badgeClass = "badge-pending";
      if (t.status === 'rejeitado') badgeClass = "badge-rejected";

      let typeFormatted = t.type.replace('_', ' ').toUpperCase();

      list.innerHTML += `
        <tr>
          <td>${date}</td>
          <td><strong>${typeFormatted}</strong></td>
          <td>${t.description || '-'}</td>
          <td>$ ${t.amount.toFixed(2)}</td>
          <td class="${badgeClass}">${t.status.toUpperCase()}</td>
        </tr>
      `;
    });
  });
}

// Sair (Log out)
document.getElementById("btn-logout").addEventListener("click", () => signOut(auth));
