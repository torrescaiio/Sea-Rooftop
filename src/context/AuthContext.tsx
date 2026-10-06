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
  signOut: async () => {},
  refreshRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole>("admin");
  const [loading, setLoading] = useState(true);

  // Helper para inferir role inicial baseado no e-mail ou nome
  const inferRole = (email?: string | null, displayName?: string | null): UserRole => {
    const text = `${email || ""} ${displayName || ""}`.toLowerCase();
    if (text.includes("cozinha") || text.includes("chef_cozinha")) return "chef_cozinha";
    if (text.includes("bar") || text.includes("chef_bar") || text.includes("bartender")) return "chef_bar";
    return "admin";
  };

  const loadUserRole = async (rawUser: any): Promise<{ role: UserRole; allowedModules: any; setor: any }> => {
    if (!rawUser) return { role: "admin", allowedModules: "ALL", setor: "geral" };

    try {
      const roleDoc = await appDb.get("user_roles", rawUser.uid);
      if (roleDoc && roleDoc.role) {
        return {
          role: roleDoc.role as UserRole,
          allowedModules: roleDoc.allowedModules || "ALL",
          setor: roleDoc.setor || (roleDoc.role === "chef_cozinha" ? "cozinha" : roleDoc.role === "chef_bar" ? "bar" : "geral")
        };
      } else {
        // Se ainda não tem documento no Firestore, cria com a role inferida
        const defaultRole = inferRole(rawUser.email, rawUser.displayName);
        const setor = defaultRole === "chef_cozinha" ? "cozinha" : defaultRole === "chef_bar" ? "bar" : "geral";
        const newDoc = {
          email: rawUser.email || "usuario@searooftop.com.br",
          displayName: rawUser.displayName || "Usuário",
          role: defaultRole,
          setor,
          allowedModules: defaultRole === "admin" ? "ALL" : ["gestao_compras", "fichas_tecnicas", "checklist"],
          createdAt: new Date().toISOString()
        };
        await appDb.set("user_roles", rawUser.uid, newDoc);
        return {
          role: defaultRole,
          allowedModules: newDoc.allowedModules,
          setor
        };
      }
    } catch (err) {
      console.warn("Aviso ao carregar role do usuário no Firestore:", err);
      const fallbackRole = inferRole(rawUser.email, rawUser.displayName);
      return {
        role: fallbackRole,
        allowedModules: "ALL",
        setor: fallbackRole === "chef_cozinha" ? "cozinha" : fallbackRole === "chef_bar" ? "bar" : "geral"
      };
    }
  };

  useEffect(() => {
    const unsubscribe = appAuth.onAuthStateChange(async (firebaseUser: any) => {
      if (firebaseUser) {
        const { role: userRole, allowedModules, setor } = await loadUserRole(firebaseUser);
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

  const setRole = async (newRole: UserRole) => {
    setRoleState(newRole);
    if (user) {
      const setor = newRole === "chef_cozinha" ? "cozinha" : newRole === "chef_bar" ? "bar" : "geral";
      const updatedUser: AppUser = {
        ...user,
        role: newRole,
        setor
      };
      setUser(updatedUser);

      // Persiste no Firestore para manter consistência
      try {
        await appDb.update("user_roles", user.uid, {
          role: newRole,
          setor,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Aviso ao salvar nova role no Firestore:", err);
      }
    }
  };

  const refreshRole = async () => {
    if (user) {
      const { role: refreshedRole, allowedModules, setor } = await loadUserRole(user);
      setRoleState(refreshedRole);
      setUser(prev => prev ? { ...prev, role: refreshedRole, allowedModules, setor } : null);
    }
  };

  const signOut = async () => {
    await appAuth.signOut();
    setUser(null);
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
        signOut,
        refreshRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
