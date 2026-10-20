import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"; // se usar versão modular
import { 
  signInWithEmailAndPassword as loginEmail, 
  createUserWithEmailAndPassword as createEmail, 
  onAuthStateChanged as onAuth, 
  signOut as logout 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, setDoc, addDoc, collection, getDocs, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let isSignUp = false;

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authTitle = document.getElementById("auth-title");
const nameGroup = document.getElementById("name-group");
const btnSubmit = document.getElementById("btn-submit");
const btnToggleMode = document.getElementById("btn-toggle-mode");

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

if (btnSubmit) {
  btnSubmit.addEventListener("click", async () => {
    const emailInput = document.getElementById("auth-email").value.trim();
    const passwordInput = document.getElementById("auth-password").value.trim();
    const nameInput = document.getElementById("auth-name").value.trim();

    if (!emailInput || !passwordInput) {
      alert("Por favor, preencha e-mail e senha.");
      return;
    }

    try {
      if (isSignUp) {
        if (!nameInput) return alert("Preencha seu nome completo.");
        
        const res = await createEmail(auth, emailInput, passwordInput);
        
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
          description: "Conta criada com sucesso na La Plata!",
          amount: 0.00,
          status: "concluido",
          createdAt: new Date().getTime()
        });

        alert("Conta criada com sucesso!");
      } else {
        await loginEmail(auth, emailInput, passwordInput);
      }
    } catch (error) {
      alert("Erro: " + error.message);
    }
  });
}

// MANTÉM SESSÃO ATIVA E CARREGA DADOS DE FORMA DIRETA
onAuth(auth, (user) => {
  if (user) {
    if (authSection) authSection.classList.add("hidden");
    if (dashboardSection) dashboardSection.classList.remove("hidden");
    
    document.getElementById("profile-email").value = user.email || "";
    document.getElementById("profile-uid").value = user.uid || "";

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
      document.getElementById("user-name").innerText = data.name || "Investidor";
      document.getElementById("user-balance").innerText = `$ ${(data.balance || 0).toFixed(2)}`;
      document.getElementById("user-yield").innerText = `$ ${(data.yieldTotal || 0).toFixed(2)}`;
      document.getElementById("profile-name").value = data.name || "";
    }
  });
}

window.buyInvestment = async (amount) => {
  const user = auth.currentUser;
  if (!user) return alert("Você precisa estar logado.");

  if (!confirm(`Confirmar investimento de $${amount}?`)) return;

  try {
    await addDoc(collection(db, "transactions"), {
      userId: user.uid,
      type: "produto_adquirido",
      description: `Investimento Plano ($${amount})`,
      amount: amount,
      status: "ativo",
      createdAt: new Date().getTime()
    });

    alert("Investimento realizado com sucesso!");
  } catch (error) {
    alert("Erro na compra: " + error.message);
  }
};

// BUSCA SIMPLIFICADA SEM EXIGIR ÍNDICE COMPLEXO
function loadTransactions(uid) {
  const list = document.getElementById("transactions-list");
  if (!list) return;

  const q = query(collection(db, "transactions"), where("userId", "==", uid));

  onSnapshot(q, (snapshot) => {
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum registro no histórico.</td></tr>`;
      return;
    }

    let items = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data());
    });

    // Ordena localmente por data (mais recente primeiro)
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    items.forEach((t) => {
      const dataFormatada = t.createdAt ? new Date(t.createdAt).toLocaleString("pt-BR") : "Data recente";
      let statusClass = t.status === 'pendente' ? 'badge-pending' : (t.status === 'rejeitado' ? 'badge-rejected' : 'badge-approved');

      list.innerHTML += `
        <tr>
          <td>${dataFormatada}</td>
          <td><strong>${(t.type || 'INVESTIMENTO').toUpperCase()}</strong></td>
          <td>${t.description || '-'}</td>
          <td>$ ${(t.amount || 0).toFixed(2)}</td>
          <td class="${statusClass}">${(t.status || 'concluido').toUpperCase()}</td>
        </tr>
      `;
    });
  }, (err) => {
    console.error("Erro Firestore:", err);
  });
}

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => logout(auth));
}
