import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { 
  Users, 
  CheckSquare, 
  AlertTriangle, 
  Wrench, 
  ShoppingCart, 
  Sparkles,
  TrendingUp,
  Activity
} from "lucide-react";

export default function DashboardModule() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [reparos, setReparos] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);

  useEffect(() => {
    // Subs to all collections for summary
    const unsubEquipe = appDb.subscribe("equipe", setEquipe);
    const unsubChecklist = appDb.subscribe("checklist_gerencial", setChecklist);
    const unsubOcorrencias = appDb.subscribe("ocorrencias", setOcorrencias);
    const unsubReparos = appDb.subscribe("manutencao_reparos", setReparos);
    const unsubCompras = appDb.subscribe("compras_gerais", setCompras);
    const unsubAgenda = appDb.subscribe("agenda_eventos", setAgenda);

    return () => {
      unsubEquipe();
      unsubChecklist();
      unsubOcorrencias();
      unsubReparos();
      unsubCompras();
      unsubAgenda();
    };
  }, []);

  // Basic computed fields
  const activeStaff = equipe.filter(e => e.status === "Ativo").length;
  
  const pendingTasks = checklist.filter(t => t.status === "Pendente").length;
  const completedTasks = checklist.filter(t => t.status === "Concluído").length;
  const checklistProgress = checklist.length === 0 ? 0 : Math.round((completedTasks / checklist.length) * 100);

  const openOcorrencias = ocorrencias.filter(o => o.status === "Aberto").length;
  
  const pendingRepairs = reparos.filter(r => r.status === "Pendente" || r.status === "Em Andamento").length;
  
  const pendingCompras = compras.filter(c => c.status === "A Orçar" || c.status === "Solicitado").length;
  
  const currentDate = new Date().toISOString().split("T")[0];
  const upcomingEvents = agenda.filter(a => a.data >= currentDate && a.status !== "Cancelado").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-cyan-400" />
            Visão Geral da Operação
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Resumo em tempo real do ecossistema Sea Rooftop.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Equipe Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Users className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              Equipe
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{activeStaff}</div>
            <p className="text-sm text-slate-400">Colaboradores ativos de um total de {equipe.length}.</p>
          </div>
        </div>

        {/* Checklist Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckSquare className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              Checklist
            </span>
          </div>
          <div>
            <div className="flex items-end gap-2 mb-2">
              <div className="text-3xl font-bold text-white">{pendingTasks}</div>
              <div className="text-sm text-slate-400 pb-1">tarefas pendentes</div>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mb-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }}></div>
            </div>
            <p className="text-xs text-slate-500">{checklistProgress}% concluído hoje.</p>
          </div>
        </div>

        {/* Ocorrências Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-rose-900/50 transition relative overflow-hidden group">
          {openOcorrencias > 0 && (
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertTriangle className="h-24 w-24 text-rose-500" />
             </div>
          )}
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${openOcorrencias > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800 border-slate-700'}`}>
              <AlertTriangle className={`h-5 w-5 ${openOcorrencias > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${openOcorrencias > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              Ocorrências
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-bold text-white mb-1">{openOcorrencias}</div>
            <p className="text-sm text-slate-400">
              {openOcorrencias === 0 ? "Nenhuma ocorrência em aberto." : "Ocorrências necessitam de atenção."}
            </p>
          </div>
        </div>

        {/* Manutenção Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <Wrench className="h-5 w-5 text-orange-400" />
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20">
              Manutenção
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{pendingRepairs}</div>
            <p className="text-sm text-slate-400">Reparos na fila ou em andamento.</p>
          </div>
        </div>

        {/* Compras Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
              <ShoppingCart className="h-5 w-5 text-sky-400" />
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20">
              Compras
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{pendingCompras}</div>
            <p className="text-sm text-slate-400">Pedidos solicitados ou aprovados.</p>
          </div>
        </div>

        {/* Agenda Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20">
              <Sparkles className="h-5 w-5 text-fuchsia-400" />
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-fuchsia-500/10 text-fuchsia-400 rounded-full border border-fuchsia-500/20">
              Eventos
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{upcomingEvents}</div>
            <p className="text-sm text-slate-400">Eventos programados para o futuro.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
