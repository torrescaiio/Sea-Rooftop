import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import DashboardModule from "./components/DashboardModule";
import EquipeModule from "./components/EquipeModule";
import ChecklistModule from "./components/ChecklistModule";
import OcorrenciasModule from "./components/OcorrenciasModule";
import ManutencaoModule from "./components/ManutencaoModule";
import ComprasModule from "./components/ComprasModule";
import AgendaModule from "./components/AgendaModule";
import ContatosModule from "./components/ContatosModule";
import VinhosModule from "./components/VinhosModule";
import ConfiguracoesModule from "./components/ConfiguracoesModule";
import { appAuth } from "./firebase";
import { Clock, HelpCircle, LogOut, Sun } from "lucide-react";

export default function App() {
  const [activeUser, setActiveUser] = useState<any>(null);
  const [activeModule, setActiveModule] = useState<string>("dashboard");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Live clock system
  const [systemTime, setSystemTime] = useState<string>("");

  useEffect(() => {
    // Sincroniza estado de autenticação real / simulado
    const unsubscribe = appAuth.onAuthStateChange((user) => {
      setActiveUser(user);
      setCheckingAuth(false);
    });

    // Loop do relógio interno
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + 
        " • " + 
        now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await appAuth.signOut();
      setActiveUser(null);
    } catch (err: any) {
      console.error("Erro ao desautenticar:", err);
    }
  };

  // Carregando estado de autenticação inicial
  if (checkingAuth) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-4 border-t-cyan-400 border-r-cyan-400 border-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono tracking-widest uppercase">
            Carregando Command Center...
          </p>
        </div>
      </div>
    );
  }

  // Se o usuário não estiver conectado, direciona para o Auth Gate
  if (!activeUser) {
    return <AuthScreen onAuthSuccess={(user) => setActiveUser(user)} />;
  }

  // Roteador dinâmico de módulos operacionais
  const renderSelectedModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <DashboardModule />;
      case "equipe":
        return <EquipeModule />;
      case "checklist":
        return <ChecklistModule />;
      case "ocorrencias":
        return <OcorrenciasModule />;
      case "manutencao":
        return <ManutencaoModule />;
      case "compras":
        return <ComprasModule />;
      case "agenda":
        return <AgendaModule />;
      case "contatos":
        return <ContatosModule />;
      case "vinhos":
        return <VinhosModule />;
      case "configuracoes":
        return <ConfiguracoesModule user={activeUser} />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-slate-300 flex flex-col lg:flex-row font-sans">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
        user={activeUser}
        onSignOut={handleSignOut}
      />

      {/* 2. DYNAMIC WORKSPACE LAYER */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto lg:p-3 pb-0 lg:pb-3 pl-0">
        <div className="flex-1 flex flex-col bg-[#050505] lg:border border-slate-800 lg:rounded-2xl overflow-hidden shadow-2xl relative">
          
          {/* Top Header Panel */}
          <header className="px-6 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] bg-transparent border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 relative z-0 backdrop-blur-md">
            <div>
              <div className="flex items-center space-x-2">
                <Sun className="h-4 w-4 text-cyan-400 animate-spin-slow" />
                <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest font-bold">
                  ESTAÇÃO ATIVA • SEA ROOFTOP
                </span>
              </div>
              <h2 className="text-xl tracking-tight text-white mt-1">
                Olá, {activeUser.displayName || "Operador"} 
                <span className="text-slate-500 text-sm ml-2 font-normal"> (Acesso Gerencial Autorizado)</span>
              </h2>
            </div>

            {/* System Date Clock and helper */}
            <div className="flex items-center space-x-4">
              <div className="px-4 py-2 bg-black/[0.3] rounded-full border border-white/[0.05] flex items-center space-x-2 text-xs text-slate-400 font-mono shadow-inner backdrop-blur-md">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>{systemTime || "Sincronizando..."}</span>
              </div>
            </div>
          </header>

          {/* Workspace core */}
          <section className="flex-1 p-6 lg:p-8 overflow-y-auto">
            {renderSelectedModule()}
          </section>
        </div>
      </main>
    </div>
  );
}
