import React, { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, AlertCircle, Calendar, ChevronRight, Search, ArrowLeft, TrendingUp } from 'lucide-react';

interface ItemData {
  total: number;
  qtd: number;
}

interface TipoData {
  total: number;
  itens: Record<string, ItemData>;
}

interface SubcategoriaData {
  total: number;
  tipos: Record<string, TipoData>;
}

interface CategoriaData {
  total: number;
  subcategorias: Record<string, SubcategoriaData>;
}

interface PeriodData {
  total: number;
  categorias: Record<string, CategoriaData>;
  itensBusca: Record<string, ItemData>;
}

interface ComprasData {
  sucesso: boolean;
  geral: PeriodData;
  meses: Record<string, PeriodData>;
}

interface ChartData {
  name: string;
  value: number;
  percentage: number;
}

const COLORS = ['#06b6d4', '#a855f7', '#f97316', '#22c55e', '#ec4899', '#eab308', '#3b82f6']; 

const nomesMeses: Record<string, string> = { 
  "1": "JANEIRO", "01": "JANEIRO", 
  "2": "FEVEREIRO", "02": "FEVEREIRO", 
  "3": "MARÇO", "03": "MARÇO", 
  "4": "ABRIL", "04": "ABRIL", 
  "5": "MAIO", "05": "MAIO", 
  "6": "JUNHO", "06": "JUNHO", 
  "7": "JULHO", "07": "JULHO", 
  "8": "AGOSTO", "08": "AGOSTO", 
  "9": "SETEMBRO", "09": "SETEMBRO", 
  "10": "OUTUBRO", 
  "11": "NOVEMBRO", 
  "12": "DEZEMBRO" 
};

export default function ComprasModule() {
  const [data, setData] = useState<ComprasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>('geral');
  const [termoBusca, setTermoBusca] = useState<string>("");
  
  // Níveis de Drill-down
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [subAtiva, setSubAtiva] = useState<string | null>(null);
  const [tipoAtivo, setTipoAtivo] = useState<string | null>(null);
  
  // Gráfico de Evolução (Inflação)
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbzNyhNQFrmIZ7iB--EYhcdCcNhrquWatUveNQv85-Z4e61FKaB30gNyBuwUvf517sQVWQ/exec');
        if (!response.ok) {
          throw new Error('Falha ao buscar dados');
        }
        const result = await response.json();
        
        if (result.sucesso) {
          setData(result);
        } else {
          throw new Error('Retorno da API indicou falha na extração de dados.');
        }
      } catch (err: any) {
        setError(err.message || 'Ocorreu um erro ao sincronizar os dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Reset de estados dependentes
  useEffect(() => {
    setCatAtiva(null);
    setSubAtiva(null);
    setTipoAtivo(null);
    setItemExpandido(null);
  }, [mesSelecionado]);

  useEffect(() => {
    setItemExpandido(null);
  }, [termoBusca, catAtiva, subAtiva, tipoAtivo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const currentPeriodData = useMemo(() => {
    if (!data) return null;
    if (mesSelecionado === 'geral') return data.geral;
    return data.meses[mesSelecionado] || data.geral;
  }, [data, mesSelecionado]);

  const chartData = useMemo(() => {
    if (!currentPeriodData) return [];
    const { total: periodTotal, categorias } = currentPeriodData;

    if (catAtiva && categorias[catAtiva]) {
      const catData = categorias[catAtiva];
      
      if (subAtiva && catData.subcategorias && catData.subcategorias[subAtiva]) {
        // NÍVEL 3: Tipos
        const subData = catData.subcategorias[subAtiva];
        const subTotal = subData.total;
        const tipos = subData.tipos || {};

        const formattedData = Object.entries(tipos).map(([name, tipoData]) => {
          const data = tipoData as TipoData;
          return {
            name,
            value: data.total,
            percentage: subTotal > 0 ? (data.total / subTotal) * 100 : 0
          };
        });
        
        formattedData.sort((a, b) => b.value - a.value);
        return formattedData;
      } else {
        // NÍVEL 2: Subcategorias
        const catTotal = catData.total;
        const subcategorias = catData.subcategorias || {};

        const formattedData = Object.entries(subcategorias).map(([name, subCatData]) => {
          const data = subCatData as SubcategoriaData;
          return {
            name,
            value: data.total,
            percentage: catTotal > 0 ? (data.total / catTotal) * 100 : 0
          };
        });
        
        formattedData.sort((a, b) => b.value - a.value);
        return formattedData;
      }
    } else {
      // NÍVEL 1: Categorias
      const formattedData = Object.entries(categorias || {}).map(([name, catData]) => {
        const data = catData as CategoriaData;
        return {
          name,
          value: data.total,
          percentage: periodTotal > 0 ? (data.total / periodTotal) * 100 : 0
        };
      });
      
      formattedData.sort((a, b) => b.value - a.value);
      return formattedData;
    }
  }, [currentPeriodData, catAtiva, subAtiva]);

  const searchResults = useMemo(() => {
    if (!currentPeriodData || !termoBusca.trim()) return [];
    
    const itens = currentPeriodData.itensBusca || {};
    const termLower = termoBusca.toLowerCase().trim();
    
    const results = Object.entries(itens)
      .filter(([nome]) => nome.toLowerCase().includes(termLower))
      .map(([nome, itemData]) => {
        const data = itemData as ItemData;
        const precoMedio = (data.qtd && data.qtd > 0) ? (data.total / data.qtd) : 0;
        return { nome, valor: data.total, qtd: data.qtd, precoMedio };
      });
      
    results.sort((a, b) => b.valor - a.valor);
    
    return results;
  }, [currentPeriodData, termoBusca]);

  const level4Items = useMemo(() => {
    if (!currentPeriodData || !catAtiva || !subAtiva || !tipoAtivo) return [];
    const cat = currentPeriodData.categorias[catAtiva];
    if (!cat) return [];
    const sub = cat.subcategorias?.[subAtiva];
    if (!sub) return [];
    const tipo = sub.tipos?.[tipoAtivo];
    if (!tipo) return [];

    const results = Object.entries(tipo.itens || {}).map(([nome, itemData]) => {
      const data = itemData as ItemData;
      const precoMedio = (data.qtd && data.qtd > 0) ? (data.total / data.qtd) : 0;
      return { nome, valor: data.total, qtd: data.qtd, precoMedio };
    });

    results.sort((a, b) => b.valor - a.valor);
    return results;
  }, [currentPeriodData, catAtiva, subAtiva, tipoAtivo]);

  const historyData = useMemo(() => {
    if (!itemExpandido || !data || !data.meses) return [];
    const hist: { mes: string; preco: number; rawMes: number }[] = [];
    
    Object.entries(data.meses).forEach(([mesStr, mesData]) => {
      const pData = mesData as PeriodData;
      const itemInfo = pData.itensBusca?.[itemExpandido];
      if (itemInfo && itemInfo.total > 0 && itemInfo.qtd && itemInfo.qtd > 0) {
        const preco = itemInfo.total / itemInfo.qtd;
        hist.push({
          mes: nomesMeses[mesStr] ? nomesMeses[mesStr].substring(0, 3) : mesStr,
          preco,
          rawMes: parseInt(mesStr, 10)
        });
      }
    });
    
    hist.sort((a, b) => a.rawMes - b.rawMes);
    return hist.map(h => ({ mes: h.mes, preco: h.preco }));
  }, [itemExpandido, data]);

  const availableMonths = useMemo(() => {
    if (!data || !data.meses) return [];
    return Object.keys(data.meses).sort();
  }, [data]);

  const headerTotal = useMemo(() => {
    if (!currentPeriodData) return 0;
    
    if (termoBusca.trim().length > 0) {
      return searchResults.reduce((acc, curr) => acc + curr.valor, 0);
    }
    
    if (catAtiva && currentPeriodData.categorias[catAtiva]) {
      const subCatObj = currentPeriodData.categorias[catAtiva].subcategorias?.[subAtiva || ''];
      
      if (subAtiva && subCatObj) {
        const tipoObj = subCatObj.tipos?.[tipoAtivo || ''];
        if (tipoAtivo && tipoObj) {
          return tipoObj.total;
        }
        return subCatObj.total;
      }
      return currentPeriodData.categorias[catAtiva].total;
    }
    return currentPeriodData.total;
  }, [currentPeriodData, catAtiva, subAtiva, tipoAtivo, termoBusca, searchResults]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-zinc-400">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-6" />
        <p className="text-lg font-mono tracking-widest uppercase">Sincronizando com NFe...</p>
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

  const getNivelLabel = () => {
    if (catAtiva && subAtiva) return "Tipos";
    if (catAtiva) return "Subcategorias";
    return "Categorias";
  };
  
  const isSearchActive = termoBusca.trim().length > 0;
  const isLevel4Active = tipoAtivo !== null;

  const renderExpandedRow = (itemName: string) => {
    if (itemExpandido !== itemName) return null;
    
    return (
      <tr className="bg-zinc-900/60 border-b border-zinc-800/40">
        <td colSpan={3} className="px-4 py-6">
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-zinc-400">
              <TrendingUp className="w-4 h-4 text-cyan-500" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-500">
                Histórico de Preço Médio (Inflação)
              </h4>
            </div>
            
            {historyData.length > 0 ? (
              <div className="h-48 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="mes" 
                      stroke="#a1a1aa" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      stroke="#a1a1aa" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `R$ ${val}`} 
                      dx={-10}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Preço Médio']}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                      labelStyle={{ color: '#06b6d4', fontWeight: 900, marginBottom: '4px' }}
                      itemStyle={{ color: '#fff', fontWeight: 600 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="preco" 
                      stroke="#06b6d4" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#121212' }} 
                      activeDot={{ r: 6, fill: '#06b6d4' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-zinc-500 text-sm italic py-4">
                Dados insuficientes para traçar o gráfico de inflação (nenhum registro nos outros meses).
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto w-full flex justify-center items-start">
      <div className="bg-[#121212] border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-2xl w-full max-w-5xl mt-4">
        
        {/* Header */}
        <div className="mb-8 border-b border-zinc-800/80 pb-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                {isSearchActive ? 'Resultados da Busca' : 'Visão Geral de Compras'}
              </h2>
              <div className="text-4xl sm:text-6xl font-black text-white tracking-tight">
                {formatCurrency(headerTotal)}
              </div>
            </div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500 hidden sm:block shrink-0" />
                <select 
                  value={mesSelecionado}
                  onChange={(e) => setMesSelecionado(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium cursor-pointer w-full md:w-56 transition-colors"
                >
                  <option value="geral">VISÃO GERAL (TODOS)</option>
                  {availableMonths.map(mes => (
                    <option key={mes} value={mes}>
                      {nomesMeses[mes] ? nomesMeses[mes] : `MÊS ${mes}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative w-full md:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar item específico..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium w-full md:w-64 placeholder-zinc-600 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Conditional View: Search Results vs Drill-down Level 4 vs Dashboard */}
        {isSearchActive ? (
          <div className="flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-zinc-400 text-sm font-medium">
                Encontrados <span className="text-white font-bold">{searchResults.length}</span> resultados para "{termoBusca}"
              </p>
              <button 
                onClick={() => setTermoBusca("")}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider transition-colors"
              >
                Limpar Busca
              </button>
            </div>
            
            <div className="bg-zinc-900/40 rounded-2xl p-2 border border-zinc-800/50 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10">
                    <tr>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Item</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Preço Médio</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {searchResults.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center">
                          <p className="text-zinc-500 text-sm font-medium">Nenhum item encontrado.</p>
                        </td>
                      </tr>
                    ) : (
                      searchResults.map((item) => (
                        <React.Fragment key={item.nome}>
                          <tr 
                            onClick={() => setItemExpandido(prev => prev === item.nome ? null : item.nome)}
                            className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                          >
                            <td className="py-4 px-4">
                              <span className="text-sm font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors">{item.nome}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-mono font-medium text-zinc-400">
                                {formatCurrency(item.precoMedio)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(item.valor)}</span>
                            </td>
                          </tr>
                          {renderExpandedRow(item.nome)}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : isLevel4Active ? (
          <div className="flex flex-col h-[600px]">
            {/* Breadcrumbs for Level 4 */}
            <div className="flex items-center text-xs font-black tracking-widest uppercase mb-4 bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800/80 w-full overflow-x-auto whitespace-nowrap">
              <button 
                onClick={() => { setCatAtiva(null); setSubAtiva(null); setTipoAtivo(null); }}
                className="transition-colors text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                Visão Geral
              </button>
              
              <ChevronRight className="w-4 h-4 mx-2 text-zinc-600 shrink-0" />
              <button 
                onClick={() => { setSubAtiva(null); setTipoAtivo(null); }}
                className="transition-colors text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {catAtiva}
              </button>

              <ChevronRight className="w-4 h-4 mx-2 text-zinc-600 shrink-0" />
              <button 
                onClick={() => setTipoAtivo(null)}
                className="transition-colors text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {subAtiva}
              </button>

              <ChevronRight className="w-4 h-4 mx-2 text-zinc-600 shrink-0" />
              <span className="text-zinc-300">
                {tipoAtivo}
              </span>
            </div>

            <div className="flex items-center justify-between mb-4 mt-2">
              <p className="text-zinc-400 text-sm font-medium">
                Composição de Insumos: <span className="text-white font-bold">{tipoAtivo}</span>
              </p>
              <button 
                onClick={() => setTipoAtivo(null)}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para Tipos
              </button>
            </div>
            
            <div className="bg-zinc-900/40 rounded-2xl p-2 border border-zinc-800/50 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10">
                    <tr>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Insumo Individual</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Preço Médio</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {level4Items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center">
                          <p className="text-zinc-500 text-sm font-medium">Nenhum insumo específico registrado sob este tipo.</p>
                        </td>
                      </tr>
                    ) : (
                      level4Items.map((item) => (
                        <React.Fragment key={item.nome}>
                          <tr 
                            onClick={() => setItemExpandido(prev => prev === item.nome ? null : item.nome)}
                            className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                          >
                            <td className="py-4 px-4">
                              <span className="text-sm font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors">{item.nome}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-mono font-medium text-zinc-400">
                                {formatCurrency(item.precoMedio)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(item.valor)}</span>
                            </td>
                          </tr>
                          {renderExpandedRow(item.nome)}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Breadcrumbs */}
            <div className="flex items-center text-xs font-black tracking-widest uppercase mb-8 bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800/80 w-full overflow-x-auto whitespace-nowrap">
              <button 
                onClick={() => { setCatAtiva(null); setSubAtiva(null); setTipoAtivo(null); }}
                className={`transition-colors ${!catAtiva ? 'text-zinc-300 cursor-default' : 'text-cyan-400 hover:text-cyan-300 cursor-pointer'}`}
                disabled={!catAtiva}
              >
                Visão Geral
              </button>
              
              {catAtiva && (
                <>
                  <ChevronRight className="w-4 h-4 mx-2 text-zinc-600 shrink-0" />
                  <button 
                    onClick={() => { setSubAtiva(null); setTipoAtivo(null); }}
                    className={`transition-colors ${!subAtiva ? 'text-zinc-300 cursor-default' : 'text-cyan-400 hover:text-cyan-300 cursor-pointer'}`}
                    disabled={!subAtiva}
                  >
                    {catAtiva}
                  </button>
                </>
              )}

              {catAtiva && subAtiva && (
                <>
                  <ChevronRight className="w-4 h-4 mx-2 text-zinc-600 shrink-0" />
                  <span className="text-zinc-300">
                    {subAtiva}
                  </span>
                </>
              )}
            </div>

            {/* Drill-down Dashboard Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              {/* Chart Section */}
              <div className="h-80 w-full relative flex items-center justify-center">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={120}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={6}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                        itemStyle={{ color: '#fff', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-600 font-medium text-center">Nenhum dado encontrado</div>
                )}
                
                {/* Center Label */}
                {chartData.length > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                      {getNivelLabel()}
                    </span>
                    <span className="text-3xl font-black text-white">{chartData.length}</span>
                  </div>
                )}
              </div>

              {/* Table/Legend Section */}
              <div className="flex flex-col h-[350px]">
                <div className="bg-zinc-900/40 rounded-2xl p-2 border border-zinc-800/50 flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10">
                        <tr>
                          <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                            {getNivelLabel()}
                          </th>
                          <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Custo</th>
                          <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {chartData.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-zinc-600 text-sm">Nenhum registro encontrado.</td>
                          </tr>
                        )}
                        {chartData.map((item, index) => {
                          const isClickable = !catAtiva || (catAtiva && !subAtiva) || (catAtiva && subAtiva && !tipoAtivo);
                          return (
                            <tr 
                              key={item.name} 
                              onClick={() => {
                                if (!catAtiva) {
                                  setCatAtiva(item.name);
                                } else if (!subAtiva) {
                                  setSubAtiva(item.name);
                                } else if (!tipoAtivo) {
                                  setTipoAtivo(item.name);
                                }
                              }}
                              className={`hover:bg-zinc-800/40 transition-colors group ${isClickable ? 'cursor-pointer' : ''}`}
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  />
                                  <span className={`text-sm font-bold text-zinc-200 transition-colors ${isClickable ? 'group-hover:text-cyan-400' : 'group-hover:text-white'}`}>
                                    {item.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-sm font-mono font-medium text-zinc-300">{formatCurrency(item.value)}</span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-sm font-mono font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                                  {item.percentage.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
