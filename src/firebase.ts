import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
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
  updateProfile,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
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
    // Use experimentalAutoDetectLongPolling to bypass adblockers/VPNs blocking WebSockets in iframe
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    }, "ai-studio-889f45a6-e68b-47c9-bb87-2fa91d25cdcd");
    console.log("🔥 Firebase initialized successfully!");
  } catch (err) {
    console.error("❌ Error initializing Firebase:", err);
  }
} else {
  console.warn("⚠️ Firebase credentials not configured!");
}

// INITIAL_SEEDS removed, strictly Firebase now


// ============================================================================
// EXPORTING GENERIC WRAPPERS (HANDLES REAL FIREBASE ONLY)
// ============================================================================

export const isFirebaseActive = () => true;

// 1. AUTHENTICATION SERVICE
export const appAuth = {
  signIn: async (email: string, pass: string): Promise<any> => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      return credential.user;
    } catch (error: any) {
      throw new Error(translateAuthError(error.code) || error.message);
    }
  },

  signUp: async (email: string, pass: string): Promise<any> => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      return credential.user;
    } catch (error: any) {
      throw new Error(translateAuthError(error.code) || error.message);
    }
  },

  createUserWithoutSwitchingSession: async (email: string, pass: string, displayName?: string): Promise<{ uid: string; email: string }> => {
    if (!isConfigured) {
      throw new Error("Firebase não está configurado.");
    }
    // Cria uma instância secundária isolada do Firebase App
    // para cadastrar o usuário no Firebase Auth sem deslogar o administrador da sessão atual!
    const secondaryAppName = `AdminProvisionApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      const userResult = {
        uid: credential.user.uid,
        email: credential.user.email || email,
      };
      await firebaseSignOut(secondaryAuth);
      return userResult;
    } catch (error: any) {
      throw new Error(translateAuthError(error.code) || error.message);
    } finally {
      try {
        await deleteApp(secondaryApp);
      } catch (_) {}
    }
  },

  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("Usuário não está logado para alterar senha.");
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await firebaseUpdatePassword(auth.currentUser, newPassword);
    } catch (error: any) {
      throw new Error(translateAuthError(error.code) || error.message);
    }
  },

  updateProfile: async (displayName: string, role?: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("Usuário não está logado para atualizar perfil.");
    try {
      await updateProfile(auth.currentUser, { displayName });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(translateAuthError(error.code) || error.message);
    }
  }
};

// 2. FIRESTORE DATABASE WRAPPER
export const appDb = {
  // Read All
  getAll: async (collectionName: string): Promise<any[]> => {
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
  },

  // Add Item
  add: async (collectionName: string, itemData: any): Promise<any> => {
    const userEmail = auth.currentUser?.email || "Sistema";
    const enrichedData = {
      ...itemData,
      createdAt: new Date().toISOString(),
      createdBy: userEmail
    };
    try {
      const docRef = await addDoc(collection(db, collectionName), enrichedData);
      return { id: docRef.id, ...enrichedData };
    } catch (error) {
      console.error(`Error adding to ${collectionName} with Firestore:`, error);
      throw error;
    }
  },

  // Update Item
  update: async (collectionName: string, id: string, updates: any): Promise<void> => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error(`Error updating in ${collectionName} (id: ${id}) with Firestore:`, error);
      throw error;
    }
  },

  // Set Item (overwrite/create specific ID)
  set: async (collectionName: string, id: string, itemData: any): Promise<void> => {
    try {
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, itemData);
    } catch (error) {
      console.error(`Error setting doc in ${collectionName} (id: ${id}) with Firestore:`, error);
      throw error;
    }
  },

  // Get Single Document
  get: async (collectionName: string, id: string): Promise<any | null> => {
    try {
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      return null;
    } catch (error) {
      console.error(`Error getting doc from ${collectionName} (id: ${id}) with Firestore:`, error);
      throw error;
    }
  },

  // Delete Item
  delete: async (collectionName: string, id: string): Promise<void> => {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting from ${collectionName} (id: ${id}) with Firestore:`, error);
      throw error;
    }
  },

  // OnSnapshot wrapper for real-time updates
  subscribe: (collectionName: string, onUpdate: (data: any[]) => void, onError?: (err: any) => void) => {
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
  },

  // Trigger simulated change
  dispatchUpdate: () => {
    // Only kept for backwards compatibility of interfaces if used anywhere
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
