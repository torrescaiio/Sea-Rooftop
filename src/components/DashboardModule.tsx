import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Users, 
  CheckSquare, 
  AlertTriangle, 
  Wrench, 
  ShoppingCart, 
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Plus,
  X,
  Wine,
  Briefcase
} from "lucide-react";

export default function DashboardModule() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [reparos, setReparos] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [vinhos, setVinhos] = useState<any[]>([]);
  const [pedidosVinho, setPedidosVinho] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);

  const [quickAction, setQuickAction] = useState<'ocorrencia' | 'compra' | null>(null);
  
  // Quick Action form state
  const [qaItem, setQaItem] = useState("");
  const [qaDesc, setQaDesc] = useState("");
  const [qaQtd, setQaQtd] = useState(1);


  useEffect(() => {
    // Subs to all collections for summary
    const unsubEquipe = appDb.subscribe("equipe", setEquipe);
    const unsubChecklist = appDb.subscribe("checklist_gerencial", setChecklist);
    const unsubOcorrencias = appDb.subscribe("ocorrencias", setOcorrencias);
    const unsubReparos = appDb.subscribe("manutencao_reparos", setReparos);
    const unsubCompras = appDb.subscribe("compras_gerais", setCompras);
    const unsubAgenda = appDb.subscribe("agenda_eventos", setAgenda);
    const unsubVinhos = appDb.subscribe("vinhos", setVinhos);
    const unsubPedidosVinho = appDb.subscribe("pedidos_vinho", setPedidosVinho);
    const unsubExtras = appDb.subscribe("extras_semana", setExtras);

    return () => {
      unsubEquipe();
      unsubChecklist();
      unsubOcorrencias();
      unsubReparos();
      unsubCompras();
      unsubAgenda();
      unsubVinhos();
      unsubPedidosVinho();
      unsubExtras();
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

  const currentMonthDate = new Date();
  const currentMonthString = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const pendingPedidosVinho = pedidosVinho.filter(p => p.status === "Pendente").length;
  const totalDiariasMes = extras.filter(e => e.data && e.data.startsWith(currentMonthString)).reduce((acc, curr) => acc + (curr.valor || 0), 0);

  const handleCreateOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaDesc.trim()) return;
    try {
      await appDb.add("ocorrencias", {
        data: new Date().toLocaleDateString('pt-BR'),
        categoria: "Sistema",
        descricaoDetalhada: qaDesc.trim(),
        responsavelResolucao: "Operador (Quick Action)",
        funcionarioEnvolvidoId: null,
        status: "Aberto"
      });
      appDb.dispatchUpdate();
      setQuickAction(null);
      setQaDesc("");
    } catch (err: any) { alert(err.message); }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaItem.trim() || qaQtd <= 0) return;
    try {
      await appDb.add("compras_gerais", {
        item: qaItem.trim(),
        categoria: "Outros", // Fallback, could be Bar
        quantidade: Number(qaQtd),
        status: "A Orçar",
        fornecedor: "",
        valorComprado: null
      });
      appDb.dispatchUpdate();
      setQuickAction(null);
      setQaItem("");
      setQaQtd(1);
    } catch (err: any) { alert(err.message); }
  };

  // --- CHART DATA PREPARATION --- //
  
  // 1. Ocorrências por Colaborador
  const occurrencesByColab = ocorrencias.reduce((acc, curr) => {
    const identifier = curr.funcionarioEnvolvidoId || curr.responsavelResolucao;
    if (identifier && identifier.trim() !== "") {
      acc[identifier] = (acc[identifier] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const occurrencesChartData = Object.keys(occurrencesByColab).map(identifier => {
    const colab = equipe.find(e => e.id === identifier);
    const rawName = colab ? colab.nome : identifier;
    return {
      name: rawName.split(' ')[0], // First name only
      ocorrencias: occurrencesByColab[identifier]
    };
  }).filter(d => d.ocorrencias > 0)
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, 6);

  // 2. Consumo Financeiro por Categoria de Compras (Ao longo do mês)
  const financialByCategory = compras.reduce((acc, curr) => {
    // Assuming 'createdAt' or fallback
    const isThisMonth = !curr.createdAt || new Date(curr.createdAt).getMonth() === currentMonthDate.getMonth();
    
    if (isThisMonth && curr.status === 'Comprado' && curr.valorComprado) {
      acc[curr.categoria] = (acc[curr.categoria] || 0) + curr.valorComprado;
    }
    return acc;
  }, {} as Record<string, number>);

  const financialChartData = Object.keys(financialByCategory).map(cat => ({
    name: cat,
    valor: financialByCategory[cat]
  })).sort((a, b) => b.valor - a.valor);

  // 3. Diárias por Função (Este mês)
  const diariasThisMonthData = extras.filter(e => e.data && e.data.startsWith(currentMonthString));
  const diariasByFuncao = diariasThisMonthData.reduce((acc, curr) => {
    const funcao = curr.funcao || "Outros";
    acc[funcao] = (acc[funcao] || 0) + (curr.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  const diariasChartData = Object.keys(diariasByFuncao).map(f => ({
    name: f,
    valor: diariasByFuncao[f]
  })).sort((a, b) => b.valor - a.valor).slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-3">
          <Activity className="h-8 w-8 md:h-12 md:w-12 text-cyan-500" />
          VISÃO GERAL
        </h2>
        <p className="text-slate-400 font-mono tracking-widest uppercase text-xs">
          Resumo em tempo real do ecossistema • Sea Rooftop
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Equipe Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 uppercase">
              Equipe
            </span>
          </div>
          <div>
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{activeStaff}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Colaboradores ativos de {equipe.length}</p>
          </div>
        </div>

        {/* Checklist Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckSquare className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 uppercase">
              Checklist
            </span>
          </div>
          <div>
            <div className="flex items-end gap-3 mb-4">
              <div className="text-5xl font-bold text-white tracking-tight">{pendingTasks}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-500 pb-1.5">pendentes</div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }}></div>
            </div>
            <p className="text-[10px] font-bold font-mono tracking-widest text-emerald-500 uppercase">{checklistProgress}% concluído hoje</p>
          </div>
        </div>

        {/* Ocorrências Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-rose-500/50 transition-colors relative overflow-hidden group">
          {openOcorrencias > 0 && (
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                <AlertTriangle className="h-32 w-32 text-rose-500 shadow-xl" />
             </div>
          )}
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div className={`p-3 rounded-lg border ${openOcorrencias > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <span className={`text-[10px] font-bold tracking-widest px-3 py-1 rounded-full border uppercase ${openOcorrencias > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
              Ocorrências
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{openOcorrencias}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              {openOcorrencias === 0 ? "Zero em aberto" : "Atenção necessária"}
            </p>
          </div>
        </div>

        {/* Manutenção Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-orange-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Wrench className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20 uppercase">
              Manutenção

            </span>
          </div>
          <div>
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{pendingRepairs}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Reparos na fila ou andamento</p>
          </div>
        </div>

        {/* Compras Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-sky-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20 uppercase">
              Compras
            </span>
          </div>
          <div>
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{pendingCompras}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Pedidos aguardando compra</p>
          </div>
        </div>

        {/* Agenda Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-fuchsia-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-fuchsia-500/10 text-fuchsia-400 rounded-full border border-fuchsia-500/20 uppercase">
              Eventos
            </span>
          </div>
          <div>
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{upcomingEvents}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Agendamentos futuros</p>
          </div>
        </div>

        {/* Vinhos Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-violet-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Wine className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-violet-500/10 text-violet-400 rounded-full border border-violet-500/20 uppercase">
              Adega
            </span>
          </div>
          <div>
            <div className="text-5xl font-bold text-white mb-2 tracking-tight">{pendingPedidosVinho}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Pedidos aguardando envio</p>
          </div>
        </div>

        {/* Diárias Stats */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-500/50 transition-colors">
          <div className="flex items-start justify-between mb-8">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold tracking-widest px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 uppercase">
              Diárias
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-2 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">R$ {totalDiariasMes.toFixed(2)}</div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Gasto neste mês</p>
          </div>
        </div>

      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Gráfico Ocorrências por Colaborador */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-white tracking-widest uppercase mb-6 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-rose-500" />
            Ocorrências por Colaborador
          </h3>
          <div className="h-[300px] w-full" style={{ minWidth: 0, minHeight: 0 }}>
            {occurrencesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={occurrencesChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#ffffff10', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#f43f5e' }}
                  />
                  <Bar dataKey="ocorrencias" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
                Sem dados para exibir
              </div>
            )}
          </div>
        </div>

        {/* Gráfico Gasto com Diárias por Função */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-white tracking-widest uppercase mb-6 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-amber-500" />
            Gastos Extras por Função (Mês Atual)
          </h3>
          <div className="h-[300px] w-full" style={{ minWidth: 0, minHeight: 0 }}>
            {diariasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={diariasChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#ffffff10', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#f59e0b' }}
                  />
                  <Bar dataKey="valor" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
                Sem gastos registrados neste mês
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="mt-8 pt-8 border-t border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-widest uppercase">Ações Rápidas</h3>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setQuickAction('ocorrencia')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 transition-colors font-semibold text-sm uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" /> Nova Ocorrência
          </button>
          
          <button
            onClick={() => setQuickAction('compra')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-400 text-slate-300 transition-colors font-semibold text-sm uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" /> Registrar Compra
          </button>
        </div>
      </div>

      {quickAction === 'ocorrencia' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setQuickAction(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-white tracking-tight mb-6 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              NOVA OCORRÊNCIA
            </h3>
            <form onSubmit={handleCreateOccurrence} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">Descrição</label>
                <textarea
                  required
                  rows={4}
                  value={qaDesc}
                  onChange={e => setQaDesc(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-slate-200 text-sm focus:border-rose-500 focus:outline-none resize-none"
                  placeholder="Relate o problema rapidamente..."
                />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-rose-500/20 text-rose-400 font-bold uppercase tracking-widest text-xs hover:bg-rose-500/30 transition-colors border border-rose-500/20">
                Enviar Ocorrência
              </button>
            </form>
          </div>
        </div>
      )}

      {quickAction === 'compra' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setQuickAction(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-white tracking-tight mb-6 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-sky-500" />
              NOVA COMPRA
            </h3>
            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">Nome do Item</label>
                <input
                  type="text"
                  required
                  value={qaItem}
                  onChange={e => setQaItem(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="O que precisa ser comprado?"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={qaQtd}
                  onChange={e => setQaQtd(Number(e.target.value))}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-slate-200 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-sky-500/20 text-sky-400 font-bold uppercase tracking-widest text-xs hover:bg-sky-500/30 transition-colors border border-sky-500/20 mt-2">
                Criar Solicitação
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
