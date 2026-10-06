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
import BalancoEventosModule from "./components/BalancoEventosModule";
import ContatosModule from "./components/ContatosModule";
import VinhosModule from "./components/VinhosModule";
import LimpezaModule from "./components/LimpezaModule";
import ExtrasModule from "./components/ExtrasModule";
import RelatoriosVendasModule from "./components/RelatoriosVendasModule";
import ConfiguracoesModule from "./components/ConfiguracoesModule";
import FichasTecnicasModule from "./components/FichasTecnicasModule";
import GestaoDeComprasModule from "./components/GestaoDeComprasModule";
import { useAuth, UserRole } from "./context/AuthContext";
import { Clock, Sun, Shield, ChefHat, Wine } from "lucide-react";

export default function App() {
  const { 
    user: activeUser, 
    role, 
    setRole, 
    isAdmin, 
    isChefCozinha, 
    isChefBar, 
    isSolicitante, 
    loading: checkingAuth, 
    signOut: handleSignOut 
  } = useAuth();

  const [activeModule, setActiveModule] = useState<string>("dashboard");

  // Ajusta módulo inicial dependendo do cargo do usuário
  useEffect(() => {
    if (isSolicitante) {
      setActiveModule("gestao_compras");
    } else if (isAdmin && activeModule === "gestao_compras") {
      // Mantém se já estiver nele ou vai pro dashboard
    }
  }, [role, isSolicitante, isAdmin]);

  // Live clock system
  const [systemTime, setSystemTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + 
        " • " + 
        now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

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
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // Roteador dinâmico de módulos operacionais
  const renderSelectedModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <DashboardModule />;
      case "gestao_compras":
        return <GestaoDeComprasModule />;
      case "equipe":
        return <EquipeModule />;
      case "fichas_tecnicas":
        return <FichasTecnicasModule />;
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
      case "balanco_eventos":
        return <BalancoEventosModule />;
      case "contatos":
        return <ContatosModule />;
      case "vinhos":
        return <VinhosModule />;
      case "limpeza":
        return <LimpezaModule />;
      case "extras":
        return <ExtrasModule />;
      case "relatorios":
        return <RelatoriosVendasModule />;
      case "configuracoes":
        return <ConfiguracoesModule user={activeUser} />;
      default:
        return isSolicitante ? <GestaoDeComprasModule /> : <DashboardModule />;
    }
  };

  return (
    <div className="h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-black text-slate-300 flex flex-col lg:flex-row font-sans">
      
      {/* 1. NAVEGAÇÃO RESPONSIVA (Sidebar Desktop + Topbar & Offcanvas Mobile + Bottom Nav) */}
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
        user={activeUser}
        onSignOut={handleSignOut}
      />

      {/* 2. DYNAMIC WORKSPACE LAYER (Ocupa 100% da largura em mobile) */}
      <main className="flex-1 w-full min-w-0 min-h-0 flex flex-col overflow-y-auto lg:p-3 pb-16 lg:pb-3">
        <div className="flex-1 w-full flex flex-col bg-[#050505] lg:border border-slate-800/80 lg:rounded-2xl overflow-hidden shadow-2xl relative">
          
          {/* Top Header Panel (Compacto e responsivo com RBAC integrado) */}
          <header className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-[#050505]/95 border-b border-white/[0.05] flex flex-wrap items-center justify-between gap-3 shrink-0 relative z-10 backdrop-blur-md">
            <div>
              <div className="flex items-center space-x-2">
                <Sun className="h-3.5 w-3.5 text-cyan-400 animate-spin-slow" />
                <span className="text-[9px] sm:text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                  ESTAÇÃO ATIVA • SEA ROOFTOP
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white">
                  Olá, {activeUser.displayName || "Operador"}
                </h2>
                
                {/* Badge de Cargo Ativo */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                  isAdmin 
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
                    : isChefCozinha 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                }`}>
                  {isAdmin && <Shield className="h-3 w-3" />}
                  {isChefCozinha && <ChefHat className="h-3 w-3" />}
                  {isChefBar && <Wine className="h-3 w-3" />}
                  {isAdmin ? "Admin (Gerência)" : isChefCozinha ? "Chef de Cozinha" : "Chef de Bar"}
                </span>
              </div>
            </div>

            {/* Alternador Rápido de Cargo e Relógio do Sistema */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Role Quick Selector */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[32px] ${
                    role === "admin"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Mudar cargo para Gerente"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => setRole("chef_cozinha")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[32px] ${
                    role === "chef_cozinha"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Mudar cargo para Chef de Cozinha"
                >
                  🍳 Cozinha
                </button>
                <button
                  type="button"
                  onClick={() => setRole("chef_bar")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[32px] ${
                    role === "chef_bar"
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Mudar cargo para Chef de Bar"
                >
                  🍸 Bar
                </button>
              </div>

              {/* System Date Clock */}
              <div className="hidden sm:flex items-center px-3 py-1.5 bg-black/40 rounded-full border border-white/[0.06] space-x-2 text-[11px] text-slate-300 font-mono shadow-inner">
                <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>{systemTime || "Sincronizando..."}</span>
              </div>
            </div>
          </header>

          {/* Workspace core: 100% de largura e padding responsivo */}
          <section className="flex-1 w-full p-3 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
            {renderSelectedModule()}
          </section>
        </div>
      </main>
    </div>
  );
}
