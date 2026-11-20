import React, { createContext, useContext, useState, useEffect } from "react";
import { appAuth, appDb, isFirebaseActive } from "../firebase";

export type UserRole = "admin" | "chef_cozinha" | "chef_bar";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  allowedModules?: string[] | "ALL";
  setor?: "bar" | "cozinha" | "geral";
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole;
  setRole: (role: UserRole) => Promise<void>;
  isAdmin: boolean;
  isChefCozinha: boolean;
  isChefBar: boolean;
  isSolicitante: boolean;
  loading: boolean;
  noAccess: boolean;
  isRealAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "admin",
  setRole: async () => {},
  isAdmin: true,
  isChefCozinha: false,
  isChefBar: false,
  isSolicitante: false,
  loading: true,
  noAccess: false,
  isRealAdmin: false,
  signOut: async () => {},
  refreshRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole>("admin");
  const [loading, setLoading] = useState(true);

  // true quando a pessoa fez login mas não foi cadastrada pela gerência
  const [noAccess, setNoAccess] = useState(false);

  // Só quem tem cadastro em user_roles (feito pela gerência em Configurações) entra.
  // Sem cadastro ou com erro de leitura: sem acesso (nunca vira admin por padrão).
  const loadUserRole = async (rawUser: any): Promise<{ role: UserRole; allowedModules: any; setor: any } | null> => {
    if (!rawUser) return null;

    try {
      const roleDoc = await appDb.get("user_roles", rawUser.uid);
      if (roleDoc && roleDoc.role) {
        return {
          role: roleDoc.role as UserRole,
          allowedModules: roleDoc.allowedModules || "ALL",
          setor: roleDoc.setor || (roleDoc.role === "chef_cozinha" ? "cozinha" : roleDoc.role === "chef_bar" ? "bar" : "geral")
        };
      }
      return null;
    } catch (err) {
      console.warn("Aviso ao carregar role do usuário no Firestore:", err);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = appAuth.onAuthStateChange(async (firebaseUser: any) => {
      if (firebaseUser) {
        const loaded = await loadUserRole(firebaseUser);
        if (!loaded) {
          setNoAccess(true);
          setUser(null);
          setLoading(false);
          return;
        }
        setNoAccess(false);
        const { role: userRole, allowedModules, setor } = loaded;
        setRoleState(userRole);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuário",
          role: userRole,
          allowedModules,
          setor
        });
      } else {
        setUser(null);
        setRoleState("admin");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // "Ver como" cozinha/bar: só para admin e só nesta tela (não grava no banco).
  // Assim o admin nunca perde o próprio acesso ao trocar a visão.
  const setRole = async (newRole: UserRole) => {
    if (!user || user.role !== "admin") return;
    setRoleState(newRole);
  };

  const refreshRole = async () => {
    if (user) {
      const loaded = await loadUserRole(user);
      if (!loaded) {
        setNoAccess(true);
        setUser(null);
        return;
      }
      setRoleState(loaded.role);
      setUser(prev => prev ? { ...prev, role: loaded.role, allowedModules: loaded.allowedModules, setor: loaded.setor } : null);
    }
  };

  const signOut = async () => {
    await appAuth.signOut();
    setUser(null);
    setNoAccess(false);
    setRoleState("admin");
  };

  const isAdmin = role === "admin";
  const isChefCozinha = role === "chef_cozinha";
  const isChefBar = role === "chef_bar";
  const isSolicitante = isChefCozinha || isChefBar;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        isAdmin,
        isChefCozinha,
        isChefBar,
        isSolicitante,
        loading,
        noAccess,
        isRealAdmin: user?.role === "admin",
        signOut,
        refreshRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
