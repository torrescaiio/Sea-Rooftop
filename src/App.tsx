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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
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
      case "configuracoes":
        return <ConfiguracoesModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
        user={activeUser}
        onSignOut={handleSignOut}
      />

      {/* 2. DYNAMIC WORKSPACE LAYER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Panel */}
        <header className="px-6 py-4 bg-slate-900 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4 text-amber-400 animate-spin-slow" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                ESTAÇÃO ATIVA • SEA ROOFTOP
              </span>
            </div>
            <h2 className="text-sm font-semibold text-slate-200 mt-0.5">
              Olá, {activeUser.displayName || "Operador"} 
              <span className="text-slate-500 font-normal"> (Acesso Gerencial Autorizado)</span>
            </h2>
          </div>

          {/* System Date Clock and helper */}
          <div className="flex items-center space-x-4">
            <div className="px-3.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-2 text-xs text-slate-400 font-mono shadow-inner">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>{systemTime || "Sincronizando..."}</span>
            </div>
          </div>
        </header>

        {/* Workspace core */}
        <section className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderSelectedModule()}
        </section>

      </main>
    </div>
  );
}
