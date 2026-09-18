import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  Search, Filter, TrendingUp, DollarSign, Package, Users, Award, Loader2, AlertCircle 
} from 'lucide-react';

interface ApiVenda {
  garcom: string;
  periodo: string;
  nome: string;
  grupo: string;
  quantidade: number;
  valorVenda: number;
}

const COLORS = ["#d946ef", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

const mesesOrdem: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, 
  "MAIO": 5, "JUNHO": 6, "JULHO": 7, "AGOSTO": 8, 
  "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
};

export default function RelatoriosVendasModule() {
  const [todasVendas, setTodasVendas] = useState<ApiVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("Todos");
  const [selectedGarcom, setSelectedGarcom] = useState<string>("Todos");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("Todos");
  const [searchItem, setSearchItem] = useState("");

  // Fetch initial data
  useEffect(() => {
    const fetchVendas = async () => {
      try {
        const response = await fetch("https://script.google.com/macros/s/AKfycbzZjwaEDHoyuIuBZ3omHGDmPxD3HA82b8In6ocV3Yp0s-6lzqeXjTs5EDUJ4HQmhx6k/exec");
        if (!response.ok) throw new Error("Falha na rede ao buscar dados.");
        const json = await response.json();
        
        if (json.sucesso && json.dados) {
          setTodasVendas(json.dados);
          
          // Set initial period to most recent
          const uniquePeriods = Array.from(new Set(json.dados.map((v: any) => v.periodo))).filter(Boolean) as string[];
          if (uniquePeriods.length > 0) {
            const sortedPeriods = uniquePeriods.sort((a, b) => {
              const valA = mesesOrdem[a.toUpperCase()] || 0;
              const valB = mesesOrdem[b.toUpperCase()] || 0;
              return valB - valA; // Descending, so [0] is the most recent
            });
            setSelectedPeriodo(sortedPeriods[0]);
          }
        } else {
          throw new Error("API retornou sucesso=false ou dados vazios.");
        }
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao carregar as vendas.");
      } finally {
        setLoading(false);
      }
    };
    fetchVendas();
  }, []);

  // Extração de opções únicas para os selects
  const { periodos, garcons, grupos } = useMemo(() => {
    const p = new Set<string>();
    const ga = new Set<string>();
    const gr = new Set<string>();
    
    todasVendas.forEach(v => {
      if (v.periodo) p.add(v.periodo);
      if (v.garcom) ga.add(v.garcom);
      if (v.grupo) gr.add(v.grupo);
    });

    const sortedPeriods = Array.from(p).sort((a, b) => {
      const valA = mesesOrdem[a.toUpperCase()] || 0;
      const valB = mesesOrdem[b.toUpperCase()] || 0;
      return valA - valB; // Ascending order
    });

    return {
      periodos: ["Todos", ...sortedPeriods],
      garcons: ["Todos", ...Array.from(ga).sort()],
      grupos: ["Todos", ...Array.from(gr).sort()]
    };
  }, [todasVendas]);

  // Aplicação dos filtros
  const vendasFiltradas = useMemo(() => {
    return todasVendas.filter(v => {
      const matchPeriodo = selectedPeriodo === "Todos" || v.periodo === selectedPeriodo;
      const matchGarcom = selectedGarcom === "Todos" || v.garcom === selectedGarcom;
      const matchGrupo = selectedGrupo === "Todos" || v.grupo === selectedGrupo;
      const matchSearch = searchItem === "" || v.nome.toLowerCase().includes(searchItem.toLowerCase());
      return matchPeriodo && matchGarcom && matchGrupo && matchSearch;
    });
  }, [todasVendas, selectedPeriodo, selectedGarcom, selectedGrupo, searchItem]);

  // Cálculo de KPIs
  const kpis = useMemo(() => {
    let totalValue = 0;
    let totalItems = 0;
    const garcomMap: Record<string, number> = {};

    vendasFiltradas.forEach(v => {
      totalValue += v.valorVenda;
      totalItems += v.quantidade;
      garcomMap[v.garcom] = (garcomMap[v.garcom] || 0) + v.valorVenda;
    });

    let topGarcom = { nome: "N/A", valor: 0 };
    Object.entries(garcomMap).forEach(([nome, valor]) => {
      if (valor > topGarcom.valor) {
        topGarcom = { nome, valor };
      }
    });

    return {
      totalFaturado: totalValue,
      totalItens: totalItems,
      ticketMedio: totalItems > 0 ? totalValue / totalItems : 0,
      topGarcom
    };
  }, [vendasFiltradas]);

  // Gráfico: Top 5 Itens
  const top5Itens = useMemo(() => {
    const itemMap: Record<string, { quantidade: number, valor: number, grupo: string }> = {};
    vendasFiltradas.forEach(v => {
      if (!itemMap[v.nome]) itemMap[v.nome] = { quantidade: 0, valor: 0, grupo: v.grupo };
      itemMap[v.nome].quantidade += v.quantidade;
      itemMap[v.nome].valor += v.valorVenda;
    });
    
    return Object.entries(itemMap)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [vendasFiltradas]);

  // Gráfico e Cards: Desempenho dos Garçons
  const garconsDesempenho = useMemo(() => {
    const map: Record<string, { valor: number, quantidade: number, categorias: Record<string, number> }> = {};
    vendasFiltradas.forEach(v => {
      if (!map[v.garcom]) map[v.garcom] = { valor: 0, quantidade: 0, categorias: {} };
      map[v.garcom].valor += v.valorVenda;
      map[v.garcom].quantidade += v.quantidade;
      if (!map[v.garcom].categorias[v.grupo]) map[v.garcom].categorias[v.grupo] = 0;
      map[v.garcom].categorias[v.grupo] += v.quantidade;
    });
    return Object.entries(map)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.valor - a.valor);
  }, [vendasFiltradas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Render States
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-zinc-400">
        <Loader2 className="w-12 h-12 animate-spin text-fuchsia-500 mb-6" />
        <p className="text-lg font-mono tracking-widest uppercase">Processando Vendas (API)...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-rose-400">
        <AlertCircle className="w-16 h-16 mb-6 opacity-80" />
        <p className="text-lg font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors text-sm font-bold uppercase tracking-wider"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto w-full bg-[#121212] text-slate-200 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER & FILTROS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <TrendingUp className="text-fuchsia-500 w-7 h-7" />
                Inteligência de Vendas
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Análise em tempo real do PDV via API REST.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            
            {/* Search Input */}
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar item..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-colors"
              />
            </div>

            {/* Select Período */}
            <select
              value={selectedPeriodo}
              onChange={(e) => setSelectedPeriodo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-colors truncate"
            >
              {periodos.map(p => (
                <option key={p} value={p}>{p === "Todos" ? "Todos os Períodos" : p}</option>
              ))}
            </select>

            {/* Select Grupo */}
            <select
              value={selectedGrupo}
              onChange={(e) => setSelectedGrupo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-colors truncate"
            >
              {grupos.map(g => (
                <option key={g} value={g}>{g === "Todos" ? "Todas as Categorias" : g}</option>
              ))}
            </select>

            {/* Select Garçom */}
            <select
              value={selectedGarcom}
              onChange={(e) => setSelectedGarcom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-colors truncate"
            >
              {garcons.map(g => (
                <option key={g} value={g}>{g === "Todos" ? "Todos os Garçons" : g}</option>
              ))}
            </select>

          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4 hover:border-fuchsia-500/30 transition-colors shadow-lg overflow-hidden">
            <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-500 shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium truncate">Faturamento Bruto</p>
              <h3 className="text-2xl font-black text-white mt-1 truncate">
                {formatCurrency(kpis.totalFaturado)}
              </h3>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4 hover:border-fuchsia-500/30 transition-colors shadow-lg overflow-hidden">
            <div className="bg-blue-500/10 p-3 rounded-lg text-blue-500 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium truncate">Volume de Itens</p>
              <h3 className="text-2xl font-black text-white mt-1 truncate">
                {kpis.totalItens.toLocaleString('pt-BR')} <span className="text-sm font-medium text-slate-500">un.</span>
              </h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4 hover:border-fuchsia-500/30 transition-colors shadow-lg overflow-hidden">
            <div className="bg-purple-500/10 p-3 rounded-lg text-purple-500 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium truncate">Ticket Médio</p>
              <h3 className="text-2xl font-black text-white mt-1 truncate">
                {formatCurrency(kpis.ticketMedio)}
              </h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4 hover:border-fuchsia-500/30 transition-colors shadow-lg overflow-hidden">
            <div className="bg-amber-500/10 p-3 rounded-lg text-amber-500 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium truncate">Destaque de Vendas</p>
              <h3 className="text-xl font-black text-white mt-1 truncate">
                {kpis.topGarcom.nome}
              </h3>
              <p className="text-xs text-emerald-400 mt-1 font-mono font-medium truncate">
                {formatCurrency(kpis.topGarcom.valor)}
              </p>
            </div>
          </div>
        </div>

        {/* CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Items Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono mb-6">
              Top 5 Itens (Faturamento)
            </h3>
            <div className="h-[300px] w-full">
              {top5Itens.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5Itens} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                    <YAxis dataKey="nome" type="category" stroke="#94a3b8" fontSize={11} width={120} />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                      cursor={false}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {top5Itens.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">Nenhum dado encontrado para os filtros.</div>
              )}
            </div>
          </div>

          {/* Vendas Por Garçom Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono mb-6">
              Faturamento por Garçom
            </h3>
            <div className="h-[300px] w-full">
              {garconsDesempenho.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={garconsDesempenho.slice(0, 10)} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="nome" stroke="#94a3b8" fontSize={11} interval={0} angle={-45} textAnchor="end" />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                      cursor={false}
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill="#d946ef" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">Nenhum dado encontrado para os filtros.</div>
              )}
            </div>
          </div>
        </div>

        {/* DETALHES DOS GARÇONS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-6">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Desempenho Detalhado por Garçom
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {garconsDesempenho.length > 0 ? (
                garconsDesempenho.map((garcom, idx) => (
                  <div key={idx} className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-5 hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-white text-lg">{garcom.nome}</h4>
                        <p className="text-sm text-emerald-400 font-mono font-medium">
                          {formatCurrency(garcom.valor)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {garcom.quantidade} itens vendidos
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                        <Award className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800/50">
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-3">
                        Volume por Categoria
                      </p>
                      <div className="space-y-2">
                        {Object.entries(garcom.categorias)
                          .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                          .map(([cat, qtd], cIdx) => (
                            <div key={cIdx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-300 truncate pr-2">{cat}</span>
                              <span className="text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded text-xs shrink-0">
                                {qtd} un
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-slate-500">
                  Nenhum registro encontrado para os filtros selecionados.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
