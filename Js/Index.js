import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, setDoc, addDoc, collection, onSnapshot 
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
      if (authTitle) authTitle.innerText = "Criar Conta - La Plata";
      if (nameGroup) nameGroup.style.display = "block";
      if (btnSubmit) btnSubmit.innerText = "Cadastrar";
      btnToggleMode.innerText = "Já tenho uma conta";
    } else {
      if (authTitle) authTitle.innerText = "Login do Investidor";
      if (nameGroup) nameGroup.style.display = "none";
      if (btnSubmit) btnSubmit.innerText = "Entrar";
      btnToggleMode.innerText = "Criar uma conta";
    }
  });
}

// Botão de Entrar / Cadastrar com Alerta de Erro Detalhado do Firebase
if (btnSubmit) {
  btnSubmit.addEventListener("click", async () => {
    const emailInput = document.getElementById("auth-email").value.trim();
    const passwordInput = document.getElementById("auth-password").value.trim();
    const nameInput = document.getElementById("auth-name") ? document.getElementById("auth-name").value.trim() : "";

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
        
        const res = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          name: nameInput,
          email: emailInput,
          balance: 0.00,
          yieldTotal: 0.00,
          createdAt: new Date().getTime()
        });

        await addDoc(collection(db, "transactions"), {
          userId: res.user.uid,
          type: "notificacao",
          description: "Bem-vindo à plataforma La Plata! Conta criada com sucesso.",
          amount: 0.00,
          status: "concluido",
          createdAt: new Date().getTime()
        });

        alert("Conta criada com sucesso!");
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      }
    } catch (error) {
      console.error(error);
      alert("ERRO FIREBASE: " + error.code + " - " + error.message);
    }
  });
}

// Gestão de Sessão Global
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (authSection) authSection.classList.add("hidden");
    if (dashboardSection) dashboardSection.classList.remove("hidden");
    
    const emailElem = document.getElementById("profile-email");
    const uidElem = document.getElementById("profile-uid");
    if (emailElem) emailElem.value = user.email || "";
    if (uidElem) uidElem.value = user.uid || "";

    loadUserData(user.uid);
    loadTransactions(user.uid);
  } else {
    if (authSection) authSection.classList.remove("hidden");
    if (dashboardSection) dashboardSection.classList.add("hidden");
  }
});

function loadUserData(uid) {
  onSnapshot(doc(db, "users", uid), (snapshot) => {
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

// Comprar Investimento com Alerta de Erro Detalhado
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
      createdAt: new Date().getTime()
    });

    alert(`Parabéns! Investimento de $${amount} adquirido com sucesso.`);
  } catch (error) {
    console.error(error);
    alert("ERRO AO INVESTIR: " + error.code + " - " + error.message);
  }
};

function loadTransactions(uid) {
  if (!uid) return;
  
  const transactionsRef = collection(db, "transactions");
  
  onSnapshot(transactionsRef, (snapshot) => {
    const list = document.getElementById("transactions-list");
    if (!list) return;

    list.innerHTML = "";

    const docsData = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.userId === uid) {
        docsData.push({ id: docSnap.id, ...data });
      }
    });

    if (docsData.length === 0) {
      list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum registo encontrado no histórico.</td></tr>`;
      return;
    }

    docsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    docsData.forEach((t) => {
      let dateFormatted = t.createdAt ? new Date(t.createdAt).toLocaleString("pt-BR") : "Data recente";
      
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

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => signOut(auth));
}
