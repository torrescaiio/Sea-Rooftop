import React, { useState } from "react";
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  Wrench, 
  ShoppingCart, 
  Flame, 
  LogOut, 
  LayoutDashboard,
  Menu,
  Settings,
  X,
  BookOpen,
  Wine,
  Briefcase,
  FileSpreadsheet,
  Activity,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { isFirebaseActive } from "../firebase";

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  user: any;
  onSignOut: () => void;
}

export const MENU_ITEMS = [
  { id: "dashboard", name: "Visão Geral", icon: LayoutDashboard },
  { id: "gestao_compras", name: "Requisições de Compras", icon: ShoppingCart },
  { id: "fichas_tecnicas", name: "Fichas Técnicas", icon: BookOpen },
  { id: "equipe", name: "Equipe Operacional", icon: Users },
  { id: "checklist", name: "Checklist Gerencial", icon: CheckSquare },
  { id: "ocorrencias", name: "Ocorrências no Salão", icon: AlertTriangle },
  { id: "manutencao", name: "Manutenção & Facilities", icon: Wrench },
  { id: "compras", name: "Compras Gerais", icon: ShoppingCart },
  { id: "vinhos", name: "Carta de Vinhos", icon: Wine },
  { id: "limpeza", name: "Materiais de Limpeza", icon: Sparkles },
  { id: "agenda", name: "Eventos & Atrações", icon: Calendar },
  { id: "balanco_eventos", name: "Balanço de Eventos", icon: Activity },
  { id: "contatos", name: "Agenda de Contatos", icon: BookOpen },
  { id: "extras", name: "Diárias", icon: Briefcase },
  { id: "relatorios", name: "Relatórios & KPIs", icon: FileSpreadsheet },
  { id: "configuracoes", name: "Configurações", icon: Settings },
];

export default function Sidebar({ activeModule, setActiveModule, user, onSignOut }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const firebaseConnected = isFirebaseActive();

  const isSolicitante = user?.role === "chef_cozinha" || user?.role === "chef_bar";

  const menuItems = user?.allowedModules && user.allowedModules !== "ALL" 
    ? MENU_ITEMS.filter(m => user.allowedModules.includes(m.id))
    : isSolicitante
    ? MENU_ITEMS.filter(m => ["gestao_compras", "fichas_tecnicas", "checklist", "dashboard"].includes(m.id))
    : MENU_ITEMS;

  // Encontra o nome do módulo ativo para exibir no cabeçalho mobile
  const currentModule = menuItems.find(m => m.id === activeModule) || menuItems[0];

  // Módulos prioritários para a Bottom Navigation rápida no celular
  const bottomQuickModules = [
    menuItems.find(m => m.id === "gestao_compras") || menuItems.find(m => m.id === "dashboard"),
    menuItems.find(m => m.id === "fichas_tecnicas"),
    menuItems.find(m => m.id === "dashboard"),
    menuItems.find(m => m.id === "relatorios") || menuItems.find(m => m.id === "checklist"),
  ].filter(Boolean) as typeof MENU_ITEMS;

  const handleSelectModule = (id: string) => {
    setActiveModule(id);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0a0a0a] lg:bg-transparent text-slate-100 font-sans">
      {/* Brand Header */}
      <div className="p-5 sm:p-6 pt-6 sm:pt-8 flex items-center justify-between border-b border-white/[0.05] lg:border-b-0">
        <div className="flex items-center space-x-3 select-none">
          <div className="p-2 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
              Sea Rooftop
            </h1>
            <p className="text-[9px] font-mono tracking-[0.2em] text-cyan-400 font-semibold uppercase">
              Command Center
            </p>
          </div>
        </div>

        {/* Botão Fechar no Mobile (Área de toque de 44px) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 sm:px-4 py-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold tracking-widest text-slate-500 uppercase mt-2 mb-2">
          Módulos Operacionais
        </p>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectModule(item.id)}
              className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 shadow-sm border border-cyan-500/30"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <IconComponent className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-cyan-400"}`} />
                <span className="truncate">{item.name}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 text-cyan-400 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Database Connection Status & User Footer */}
      <div className="p-4 sm:p-5 border-t border-white/[0.05] flex flex-col gap-3 shrink-0 bg-[#070707] lg:bg-transparent">
        {firebaseConnected ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 select-none w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="tracking-widest uppercase">Sistema Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-medium text-amber-500 border border-amber-500/20 bg-amber-500/5 select-none w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="tracking-widest uppercase">Modo Simulado</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-sm shrink-0 border border-slate-700">
              {user?.displayName ? user.displayName[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "G"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.displayName || "Usuário"}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                  user?.role === "admin" 
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    : user?.role === "chef_cozinha"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                }`}>
                  {user?.role === "admin" ? "Gerência" : user?.role === "chef_cozinha" ? "Chef Cozinha" : user?.role === "chef_bar" ? "Chef Bar" : "Operador"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sair do painel"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
            aria-label="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. TOP BAR MOBILE (Substitui cabeçalho pesado com toque amigável de 44px) */}
      <div className="lg:hidden h-16 pt-[env(safe-area-inset-top)] px-4 bg-[#0a0a0a] border-b border-slate-800/80 flex items-center justify-between shrink-0 z-30 sticky top-0 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg shadow-sm">
            <Flame className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-white">SEA ROOFTOP</span>
            <span className="text-[10px] text-cyan-400 font-medium truncate max-w-[170px]">
              {currentModule?.name}
            </span>
          </div>
        </div>

        {/* Botão Hamburguer com toque amigável de 44px */}
        <button
          onClick={() => setMobileOpen(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-6 w-6 text-cyan-400" />
        </button>
      </div>

      {/* 2. SIDEBAR DESKTOP (Fixo em telas grandes) */}
      <aside className="hidden lg:block w-64 shrink-0 h-[100dvh] sticky top-0 border-r border-slate-800/80 bg-[#050505]">
        {sidebarContent}
      </aside>

      {/* 3. MENU HAMBURGUER OFFCANVAS (Mobile Drawer com Backdrop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop escuro com desfoque */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
            onClick={() => setMobileOpen(false)} 
            aria-hidden="true"
          />

          {/* Gaveta lateral deslizante */}
          <div className="relative w-[280px] max-w-[85vw] h-full flex flex-col z-10 bg-[#0a0a0a] border-r border-slate-800 shadow-2xl animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* 4. BARRA DE NAVEGAÇÃO INFERIOR RÁPIDA (BOTTOM NAVIGATION MOBILE) */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#050505]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around lg:hidden pb-[max(0.375rem,env(safe-area-inset-bottom))]"
        aria-label="Navegação rápida inferior"
      >
        {bottomQuickModules.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectModule(item.id)}
              className={`min-h-[44px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors py-1 ${
                isActive 
                  ? "text-cyan-400 font-bold" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
              <span className="text-[10px] leading-none truncate max-w-[64px]">
                {item.id === "dashboard" ? "Início" : item.id === "fichas_tecnicas" ? "Fichas" : item.id === "relatorios" ? "Vendas" : "Compras"}
              </span>
            </button>
          );
        })}

        {/* Botão Mais Módulos */}
        <button
          onClick={() => setMobileOpen(true)}
          className="min-h-[44px] min-w-[48px] flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white rounded-lg transition-colors py-1"
        >
          <Menu className="h-4 w-4 text-slate-400" />
          <span className="text-[10px] leading-none">Mais</span>
        </button>
      </nav>
    </>
  );
}
