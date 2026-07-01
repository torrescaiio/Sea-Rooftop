import React from "react";
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  Wrench, 
  ShoppingCart, 
  Flame, 
  LogOut, 
  Database, 
  Sparkles,
  LayoutDashboard,
  Menu,
  Settings,
  X,
  BookOpen,
  Wine
} from "lucide-react";
import { isFirebaseActive } from "../firebase";

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  user: any;
  onSignOut: () => void;
}

export default function Sidebar({ activeModule, setActiveModule, user, onSignOut }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const firebaseConnected = isFirebaseActive();

  const menuItems = [
    { id: "dashboard", name: "Visão Geral", icon: LayoutDashboard },
    { id: "equipe", name: "Equipe Operacional", icon: Users },
    { id: "checklist", name: "Checklist Gerencial", icon: CheckSquare },
    { id: "ocorrencias", name: "Ocorrências no Salão", icon: AlertTriangle },
    { id: "manutencao", name: "Manutenção & Facilities", icon: Wrench },
    { id: "compras", name: "Compras Gerais", icon: ShoppingCart },
    { id: "agenda", name: "Eventos & Atrações", icon: Sparkles },
    { id: "contatos", name: "Agenda de Contatos", icon: BookOpen },
    { id: "vinhos", name: "Carta de Vinhos", icon: Wine },
    { id: "configuracoes", name: "Configurações", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-black lg:bg-transparent lg:border-r-0 border-r border-slate-800 text-slate-100 font-sans">
      {/* Brand Header */}
      <div className="p-6 pt-8 pr-8">
        <div className="flex items-center space-x-3 select-none">
          <div className="p-2 bg-gradient-to-tr from-white to-slate-400 rounded-lg shadow-xl shadow-white/5">
            <Flame className="h-5 w-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-0.5">
              Sea Rooftop
            </h1>
            <p className="text-[9px] font-mono tracking-[0.2em] text-slate-500 font-medium uppercase">
              Command Center
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-4 text-[10px] font-semibold tracking-widest text-slate-600 mb-3 uppercase mt-2">Modules</p>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveModule(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-white/[0.08] text-white shadow-sm ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <IconComponent className={`h-4 w-4 transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-cyan-500"}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Database Connection Status Bar */}
      <div className="px-8 pb-4 flex flex-col gap-4">
        {firebaseConnected ? (
          <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium text-emerald-400 border border-emerald-500/10 bg-emerald-500/5 select-none w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="tracking-widest uppercase">Sistema Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium text-amber-500 border border-amber-500/10 bg-amber-500/5 select-none w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="tracking-widest uppercase">Modo Simulado</span>
          </div>
        )}

        {/* User Footer Account & Log Out */}
        <div className="flex items-center justify-between py-4 border-t border-white/[0.05]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0 ring-1 ring-white/10">
              {user?.email ? user.email[0].toUpperCase() : "G"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.displayName || "Gerente"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || "gerente@searooftop.com"}</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sair do painel"
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg">
            <Flame className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-wider text-slate-200">SEA ROOFTOP</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Desktop Sidebar Sidebar container */}
      <div className="hidden lg:block w-64 shrink-0 h-[100dvh] sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-4 right-4 lg:hidden">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
