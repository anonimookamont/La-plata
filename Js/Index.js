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

// Elementos DOM
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authTitle = document.getElementById("auth-title");
const nameGroup = document.getElementById("name-group");
const btnSubmit = document.getElementById("btn-submit");
const btnToggleMode = document.getElementById("btn-toggle-mode");

// Alternar entre Login e Cadastro
if (btnToggleMode) {
  btnToggleMode.addEventListener("click", () => {
    isSignUp = !isSignUp;
    if (isSignUp) {
      authTitle.innerText = "Criar Conta - La Plata";
      nameGroup.style.display = "block";
      btnSubmit.innerText = "Cadastrar";
      btnToggleMode.innerText = "Já tenho uma conta";
    } else {
      authTitle.innerText = "Login do Investidor";
      nameGroup.style.display = "none";
      btnSubmit.innerText = "Entrar";
      btnToggleMode.innerText = "Criar uma conta";
    }
  });
}

// Botão de Entrar / Cadastrar
if (btnSubmit) {
  btnSubmit.addEventListener("click", async () => {
    const emailInput = document.getElementById("auth-email").value.trim();
    const passwordInput = document.getElementById("auth-password").value.trim();
    const nameInput = document.getElementById("auth-name").value.trim();

    if (!emailInput || !passwordInput) {
      alert("Por favor, preencha o e-mail e a senha.");
      return;
    }

    try {
      if (isSignUp) {
        if (!nameInput) {
          alert("Por favor, preencha o seu nome completo.");
          return;
        }
        
        // Cria utilizador no Auth
        const res = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        
        // Salva dados do utilizador no Firestore
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          name: nameInput,
          email: emailInput,
          balance: 0.00,
          yieldTotal: 0.00,
          isAdmin: false,
          createdAt: new Date().toISOString()
        });

        // Cria notificação inicial no Histórico
        await addDoc(collection(db, "transactions"), {
          userId: res.user.uid,
          type: "notificacao",
          description: "Bem-vindo à plataforma La Plata! Conta criada com sucesso.",
          amount: 0.00,
          status: "concluido",
          createdAt: new Date().toISOString()
        });

        alert("Conta criada com sucesso!");
      } else {
        // Faz Login
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      }
    } catch (error) {
      console.error(error);
      alert("Erro na autenticação: " + error.message);
    }
  });
}

// Controle de Sessão em Tempo Real (Mantém os dados ao atualizar a página)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    
    // Carrega perfil e histórico do utilizador logado
    loadUserData(user);
    loadTransactions(user.uid);
  } else {
    authSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
  }
});

// Carregar Dados do Perfil do Utilizador
function loadUserData(user) {
  const emailElem = document.getElementById("profile-email");
  const uidElem = document.getElementById("profile-uid");
  
  if (emailElem) emailElem.value = user.email || "";
  if (uidElem) uidElem.value = user.uid || "";

  // Escuta atualizações do perfil no Firestore
  onSnapshot(doc(db, "users", user.uid), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      
      const userNameElem = document.getElementById("user-name");
      const userBalanceElem = document.getElementById("user-balance");
      const userYieldElem = document.getElementById("user-yield");
      const profileNameElem = document.getElementById("profile-name");

      if (userNameElem) userNameElem.innerText = data.name || "Investidor";
      if (userBalanceElem) userBalanceElem.innerText = `$ ${(data.balance || 0).toFixed(2)}`;
      if (userYieldElem) userYieldElem.innerText = `$ ${(data.yieldTotal || 0).toFixed(2)}`;
      if (profileNameElem) profileNameElem.value = data.name || "";
    }
  });
}

// Comprar Investimento (Guarda no Firestore de forma permanente)
window.buyInvestment = async (amount) => {
  const user = auth.currentUser;
  if (!user) return alert("Utilizador não autenticado.");

  const confirmBuy = confirm(`Deseja adquirir o plano de investimento no valor de $${amount}?`);
  if (!confirmBuy) return;

  try {
    await addDoc(collection(db, "transactions"), {
      userId: user.uid,
      type: "produto_adquirido",
      description: `Aquisição de Plano de Investimento ($${amount})`,
      amount: amount,
      status: "ativo",
      createdAt: new Date().toISOString()
    });

    alert(`Parabéns! Investimento de $${amount} adquirido com sucesso.`);
  } catch (error) {
    alert("Erro ao processar investimento: " + error.message);
  }
};

// Carregar Histórico de Transações Persistente
function loadTransactions(uid) {
  const transactionsRef = collection(db, "transactions");
  const q = query(transactionsRef, where("userId", "==", uid));
  
  onSnapshot(q, (snapshot) => {
    const list = document.getElementById("transactions-list");
    if (!list) return;

    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum registo encontrado no histórico.</td></tr>`;
      return;
    }
    
    const docsData = [];
    snapshot.forEach((docSnap) => {
      docsData.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Ordena do mais recente para o mais antigo no próprio JavaScript
    docsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    docsData.forEach((t) => {
      let dateFormatted = "Data recente";
      if (t.createdAt) {
        dateFormatted = new Date(t.createdAt).toLocaleString("pt-BR");
      }
      
      let badgeClass = "badge-approved";
      if (t.status === 'pendente') badgeClass = "badge-pending";
      if (t.status === 'rejeitado') badgeClass = "badge-rejected";

      let typeFormatted = t.type ? t.type.replace('_', ' ').toUpperCase() : "INVESTIMENTO";

      list.innerHTML += `
        <tr>
          <td>${dateFormatted}</td>
          <td><strong>${typeFormatted}</strong></td>
          <td>${t.description || '-'}</td>
          <td>$ ${(t.amount || 0).toFixed(2)}</td>
          <td class="${badgeClass}">${(t.status || 'concluido').toUpperCase()}</td>
        </tr>
      `;
    });
  }, (error) => {
    console.error("Erro ao carregar histórico:", error);
  });
}

// Logout
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => signOut(auth));
}
