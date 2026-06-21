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
  BookOpen
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
    { id: "configuracoes", name: "Configurações", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 font-sans">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
            <Flame className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Sea Rooftop
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-cyan-400 font-medium">
              COMMAND CENTER
            </p>
          </div>
        </div>
      </div>

      {/* Database Connection Status Bar */}
      <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800/65 flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <Database className="h-3 w-3 text-slate-500" /> Banco:
        </span>
        {firebaseConnected ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            FIREBASE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            SIMULADO (LOCAL)
          </span>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-300 border-l-4 border-cyan-500 pl-3"
                  : "text-slate-400 hover:bg-slate-800/55 hover:text-white"
              }`}
            >
              <IconComponent className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer Account & Log Out */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/30">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-cyan-600/20 flex items-center justify-center text-cyan-400 border border-cyan-500/20 font-bold text-sm shrink-0">
              {user?.email ? user.email[0].toUpperCase() : "G"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.displayName || "Gerente Operacional"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || "gerente@searooftop.com"}</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sair do painel"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1.5 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 text-center">
          <p className="text-[9px] text-slate-600 font-mono">Sea Rooftop © 2026</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden h-16 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
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
