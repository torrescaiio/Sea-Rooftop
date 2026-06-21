import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  getDocs, 
  query, 
  orderBy 
} from "firebase/firestore";

// ============================================================================
// CONFIGURAÇÃO DO FIREBASE (INSIRA SUAS CREDENCIAIS AQUI)
// Substitua os valores abaixo pelas credenciais geradas no console do Firebase:
// https://console.firebase.google.com/
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBpApuPKd44R-cYeWulXfO31zicyEaEOkI",
  authDomain: "gen-lang-client-0659252454.firebaseapp.com",
  projectId: "gen-lang-client-0659252454",
  storageBucket: "gen-lang-client-0659252454.firebasestorage.app",
  messagingSenderId: "349915801304",
  appId: "1:349915801304:web:eab216151dbd43dd3e19ad"
};

// Verifica se as credenciais foram preenchidas e são válidas
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "INSIRA_SUA_API_KEY_AQUI" && 
  firebaseConfig.apiKey !== "";

let db: any = null;
let auth: any = null;

if (isConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app, "ai-studio-889f45a6-e68b-47c9-bb87-2fa91d25cdcd");
    console.log("🔥 Firebase initialized successfully!");
  } catch (err) {
    console.error("❌ Error initializing real Firebase, falling back to simulation:", err);
  }
} else {
  console.warn("⚠️ Firebase credentials not configured. Running in simulated offline-first mode with LocalStorage!");
}

// ============================================================================
// SEED SEED DATA (DADOS INICIAIS CASO O LOCAL STORAGE ESTEJA VAZIO)
// ============================================================================
const INITIAL_SEEDS: Record<string, any[]> = {
  equipe: [
    { id: "e1", nome: "Carlos Oliveira", cargo: "Garçom Sênior", pontuacao: 9, situacaoAtual: "Excelente pontualidade e destaque em feedback positivo de mesas VIP.", status: "Ativo", createdAt: new Date().toISOString() },
    { id: "e2", nome: "Mariana Souza", cargo: "Barman", pontuacao: 8, situacaoAtual: "Responsável pelo novo menu de drinks autorais. Sem faltas registradas.", status: "Ativo", createdAt: new Date().toISOString() },
    { id: "e3", nome: "Roberto Silva", cargo: "Cumim", pontuacao: 6, situacaoAtual: "Atrasou duas vezes na semana passada devido ao trânsito na ponte.", status: "Ativo", createdAt: new Date().toISOString() },
    { id: "e4", nome: "Juliana Santos", cargo: "Hostess", pontuacao: 10, situacaoAtual: "Gestão cirúrgica de fila de espera em dias de pico.", status: "Ativo", createdAt: new Date().toISOString() }
  ],
  reservas: [
    { id: "r1", nomeCliente: "Bruno Mezenga (Mesa VIP 1)", data: new Date().toISOString().split('T')[0], horario: "20:00", quantidadePessoas: 4, mesaDesignada: "Mesa 12 (Rooftop Vista Mar)", status: "Confirmada", createdAt: new Date().toISOString() },
    { id: "r2", nomeCliente: "Patrícia Amorim", data: new Date().toISOString().split('T')[0], horario: "19:30", quantidadePessoas: 2, mesaDesignada: "Mesa 04 (Lounge)", status: "Sentado", createdAt: new Date().toISOString() },
    { id: "r3", nomeCliente: "Doutor Marcelo", data: new Date().toISOString().split('T')[0], horario: "21:30", quantidadePessoas: 6, mesaDesignada: "Mesa VIP 2", status: "Confirmada", createdAt: new Date().toISOString() }
  ],
  checklist_gerencial: [
    { id: "c1", tarefa: "Ajustar transferência de mesas da espera", categoria: "Processo de Reservas", status: "Em Andamento", createdAt: new Date().toISOString() },
    { id: "c2", tarefa: "Monitorar tempo de saída de drinks nos intervalos", categoria: "Gestão de Bar", status: "Pendente", createdAt: new Date().toISOString() },
    { id: "c3", tarefa: "Briefing de abertura com foco no vinho tinto de destaque", categoria: "Serviço de Salão", status: "Concluído", createdAt: new Date().toISOString() },
    { id: "c4", tarefa: "Revisão do ar-condicionado na área da passadora", categoria: "Tempo de Passe/Cozinha", status: "Pendente", createdAt: new Date().toISOString() }
  ],
  ocorrencias: [
    { id: "o1", data: new Date().toISOString().split('T')[0], categoria: "Sistema", descricaoDetalhada: "Queda temporária de Wi-Fi das comandas. Reiniciado roteador principal.", responsavelResolucao: "Suporte Técnico Interno (Carlos)", status: "Resolvido", createdAt: new Date().toISOString() },
    { id: "o2", data: new Date().toISOString().split('T')[0], categoria: "Cliente", descricaoDetalhada: "Cliente reclamou de barulho excessivo vindo da caixa de som traseira. Volume foi atenuado.", responsavelResolucao: "Gerente Operacional", status: "Resolvido", createdAt: new Date().toISOString() },
    { id: "o3", data: new Date().toISOString().split('T')[0], categoria: "Funcionários", descricaoDetalhada: "Garçom Ricardo informou que não poderá comparecer ao turno noturno devido a mal-estar.", responsavelResolucao: "Sub-gerente (Escala de Plantão)", status: "Aberto", createdAt: new Date().toISOString() }
  ],
  manutencao_reparos: [
    { id: "mr1", item: "Consertar goteira", local: "Toldo central do deck principal", prioridade: "Urgente", status: "Em Andamento", createdAt: new Date().toISOString() },
    { id: "mr2", item: "Estabilizar Mesa 4", local: "Salão interna esquerda", prioridade: "Média", status: "Pendente", createdAt: new Date().toISOString() },
    { id: "mr3", item: "Limpeza da Caixa de Gordura", local: "Subsolo de serviços", prioridade: "Urgente", status: "Resolvido", createdAt: new Date().toISOString() }
  ],
  manutencao_compras: [
    { id: "mc1", item: "Termômetro para freezers", fornecedor: "Refrimax Soluções", valorEstimado: 280, status: "Aprovado", createdAt: new Date().toISOString() },
    { id: "mc2", item: "Porta telada para cozinha", fornecedor: "Metalúrgica Central", valorEstimado: 650, status: "A Orçar", createdAt: new Date().toISOString() }
  ],
  compras_gerais: [
    { id: "cg1", item: "Fôrmas de gelo silicone 5x5", categoria: "Bar", quantidade: 12, status: "Solicitado", createdAt: new Date().toISOString() },
    { id: "cg2", item: "Uniformes novos", categoria: "Estrutura", quantidade: 8, status: "A Orçar", createdAt: new Date().toISOString() },
    { id: "cg3", item: "Máquina de polir copos", categoria: "Bar", quantidade: 1, status: "Comprado", createdAt: new Date().toISOString() },
    { id: "cg4", item: "Papel A4 para cardápios", categoria: "Salão", quantidade: 3, status: "Comprado", createdAt: new Date().toISOString() }
  ],
  agenda_eventos: [
    { 
      id: "ae1", 
      data: new Date().toISOString().split('T')[0], 
      tipoEvento: "Música ao Vivo", 
      artistaNome: "Rodízio de Cantores (2 tempos alternados) - Guto & Léo", 
      horarioPassagemSom: "17:30", 
      horarioInicio: "19:30", 
      horarioTermino: "23:00", 
      cacheCusto: 600, 
      necessidadesTecnicas: "2 microfones dinâmicos, 2 canais P10 para violão, mesa de som de 6 canais, 1 caixa de retorno ativa.",
      status: "Confirmado", 
      createdAt: new Date().toISOString() 
    },
    { 
      id: "ae2", 
      data: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
      tipoEvento: "DJ", 
      artistaNome: "Sunset Beat Session - DJ Mary", 
      horarioPassagemSom: "16:00", 
      horarioInicio: "18:00", 
      horarioTermino: "22:00", 
      cacheCusto: 800, 
      necessidadesTecnicas: "Cabine Pioneer Nexus 2, monitor ativo na cabine, conexão RCA/XLR balanceada.",
      status: "Confirmado", 
      createdAt: new Date().toISOString() 
    },
    { 
      id: "ae3", 
      data: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // in 2 days
      tipoEvento: "Transmissão Esportiva", 
      artistaNome: "Transmissão Jogo do Brasil (Decisão de Título)", 
      horarioPassagemSom: "15:00", 
      horarioInicio: "16:00", 
      horarioTermino: "19:00", 
      cacheCusto: 150, 
      necessidadesTecnicas: "Sincronização do projetor HD central, som estéreo em toda a casa integrada na mesa master.",
      status: "A Confirmar", 
      createdAt: new Date().toISOString() 
    }
  ]
};

// Inicializa seed data no localStorage caso não exista ainda
const initSimulatedStorage = () => {
  Object.keys(INITIAL_SEEDS).forEach(key => {
    const storageKey = `sea_rooftop_v1_${key}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(INITIAL_SEEDS[key]));
    }
  });
  
  // Simulated authentication initialization
  if (!localStorage.getItem("sea_rooftop_auth_user")) {
    // Start without an active session
    // localStorage.setItem("sea_rooftop_auth_user", JSON.stringify({ email: "seu.email@searooftop.com.br", role: "admin", name: "Operacional" }));
  }
};

initSimulatedStorage();

// ============================================================================
// EXPORTING GENERIC WRAPPERS (HANDLES EITHER REAL FIREBASE OR SIMULATED STORAGE)
// ============================================================================

export const isFirebaseActive = () => isConfigured;

// 1. AUTHENTICATION SERVICE
export const appAuth = {
  signIn: async (email: string, pass: string): Promise<any> => {
    if (isConfigured) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, pass);
        return credential.user;
      } catch (error: any) {
        throw new Error(translateAuthError(error.code) || error.message);
      }
    } else {
      // Simulation
      await sleep(600);
      const userStr = localStorage.getItem("sea_rooftop_auth_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (email.toLowerCase() === user.email) {
            return { email: user.email, displayName: user.name, uid: "simulated-uid-123" };
        } else {
          // Allow custom credentials with 123456 for easy developer interaction
          if (email && pass.length >= 6) {
            return { email: email, displayName: email.split('@')[0], uid: "simulated-uid-" + Math.random() };
          }
          throw new Error("Credenciais inválidas no ambiente simulado.");
        }
      } else {
        if (email && pass.length >= 6) {
           return { email: email, displayName: email.split('@')[0], uid: "simulated-uid-" + Math.random() };
        }
      }
      throw new Error("Usuário ou senha inválidos.");
    }
  },

  signUp: async (email: string, pass: string): Promise<any> => {
    if (isConfigured) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, pass);
        return credential.user;
      } catch (error: any) {
        throw new Error(translateAuthError(error.code) || error.message);
      }
    } else {
      // Simulation
      await sleep(600);
      if (pass.length < 6) {
        throw new Error("A senha deve conter no mínimo 6 caracteres.");
      }
      const newUser = { email, name: email.split('@')[0], uid: "simulated-uid-" + Math.random() };
      localStorage.setItem("sea_rooftop_auth_user", JSON.stringify(newUser));
      return newUser;
    }
  },

  signOut: async (): Promise<void> => {
    if (isConfigured) {
      await firebaseSignOut(auth);
    } else {
      await sleep(200);
      localStorage.removeItem("sea_rooftop_auth_user");
    }
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    if (isConfigured) {
      return onAuthStateChanged(auth, (user) => {
        callback(user);
      });
    } else {
      // Simulated state listener
      const userStr = localStorage.getItem("sea_rooftop_auth_user");
      if (userStr) {
         callback(JSON.parse(userStr));
      } else {
         callback(null);
      }
      return () => {};
    }
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    if (isConfigured) {
      if (!auth.currentUser || !auth.currentUser.email) throw new Error("Usuário não está logado para alterar senha.");
      try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await firebaseUpdatePassword(auth.currentUser, newPassword);
      } catch (error: any) {
        throw new Error(translateAuthError(error.code) || error.message);
      }
    } else {
      await sleep(600);
      if (newPassword.length < 6) throw new Error("A senha deve conter no mínimo 6 caracteres.");
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    if (isConfigured) {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (error: any) {
        throw new Error(translateAuthError(error.code) || error.message);
      }
    } else {
      await sleep(600);
      return; // Simulated success
    }
  }
};

// 2. FIRESTORE / LOCAL STORAGE DATABASE WRAPPER
export const appDb = {
  // Read All
  getAll: async (collectionName: string): Promise<any[]> => {
    if (isConfigured) {
      try {
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const results: any[] = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        return results;
      } catch (error) {
        console.error(`Error loading collection ${collectionName} with Firestore:`, error);
        throw error;
      }
    } else {
      // LocalStorage fallback
      await sleep(150);
      const dataStr = localStorage.getItem(`sea_rooftop_v1_${collectionName}`);
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        // Sort by createdAt descending
        return parsed.sort((a: any, b: any) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      }
      return [];
    }
  },

  // Add Item
  add: async (collectionName: string, itemData: any): Promise<any> => {
    const enrichedData = {
      ...itemData,
      createdAt: new Date().toISOString()
    };

    if (isConfigured) {
      try {
        const docRef = await addDoc(collection(db, collectionName), enrichedData);
        return { id: docRef.id, ...enrichedData };
      } catch (error) {
        console.error(`Error adding to ${collectionName} with Firestore:`, error);
        throw error;
      }
    } else {
      await sleep(150);
      const storageKey = `sea_rooftop_v1_${collectionName}`;
      const currentListStr = localStorage.getItem(storageKey) || "[]";
      const currentList = JSON.parse(currentListStr);
      const newItem = {
        id: `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...enrichedData
      };
      currentList.push(newItem);
      localStorage.setItem(storageKey, JSON.stringify(currentList));
      return newItem;
    }
  },

  // Update Item
  update: async (collectionName: string, id: string, updates: any): Promise<void> => {
    if (isConfigured) {
      try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, updates);
      } catch (error) {
        console.error(`Error updating in ${collectionName} (id: ${id}) with Firestore:`, error);
        throw error;
      }
    } else {
      await sleep(150);
      const storageKey = `sea_rooftop_v1_${collectionName}`;
      const currentListStr = localStorage.getItem(storageKey) || "[]";
      let currentList = JSON.parse(currentListStr);
      currentList = currentList.map((item: any) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      localStorage.setItem(storageKey, JSON.stringify(currentList));
    }
  },

  // Delete Item
  delete: async (collectionName: string, id: string): Promise<void> => {
    if (isConfigured) {
      try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error(`Error deleting from ${collectionName} (id: ${id}) with Firestore:`, error);
        throw error;
      }
    } else {
      await sleep(150);
      const storageKey = `sea_rooftop_v1_${collectionName}`;
      const currentListStr = localStorage.getItem(storageKey) || "[]";
      let currentList = JSON.parse(currentListStr);
      currentList = currentList.filter((item: any) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(currentList));
    }
  },

  // OnSnapshot wrapper for real-time updates (useful in SPA React implementation)
  subscribe: (collectionName: string, onUpdate: (data: any[]) => void, onError?: (err: any) => void) => {
    if (isConfigured) {
      const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        onUpdate(list);
      }, (err) => {
        if (onError) onError(err);
      });
    } else {
      // LocalStorage loop check or plain event listener
      const storageKey = `sea_rooftop_v1_${collectionName}`;
      
      const refresh = () => {
        const currentData = localStorage.getItem(storageKey) || "[]";
        const parsed = JSON.parse(currentData);
        const sorted = parsed.sort((a: any, b: any) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        onUpdate(sorted);
      };

      refresh();

      // Listen for window storage changes or custom UI triggers
      const listener = (e: Event) => {
        if (e.type === "storage_update" || e.type === "storage") {
          refresh();
        }
      };

      window.addEventListener("storage_update", listener);
      window.addEventListener("storage", listener);

      return () => {
        window.removeEventListener("storage_update", listener);
        window.removeEventListener("storage", listener);
      };
    }
  },

  // Trigger simulated change
  dispatchUpdate: () => {
    window.dispatchEvent(new Event("storage_update"));
  }
};

// Helper to delay simulation operations for realistic professional feel
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Translations for standard Firebase auth errors for executive user comfort
function translateAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos. Por favor, revise as credenciais.";
    case "auth/invalid-email":
      return "O formato do e-mail inserido é inválido.";
    case "auth/user-disabled":
      return "Este usuário foi temporariamente desativado.";
    case "auth/email-already-in-use":
      return "Este e-mail já está sendo utilizado por outra conta.";
    case "auth/weak-password":
      return "A senha deve ter no mínimo 6 caracteres.";
    default:
      return "Erro: " + code + " | Você pode tentar cadastrar novamente.";
  }
}
