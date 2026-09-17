import React, { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, AlertCircle, Calendar, ArrowLeft } from 'lucide-react';

interface CategoriaData {
  total: number;
  subcategorias: Record<string, number>;
}

interface PeriodData {
  total: number;
  categorias: Record<string, CategoriaData>;
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
  const [categoriaExpandida, setCategoriaExpandida] = useState<string | null>(null);

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

  // Reset drill-down when month changes
  useEffect(() => {
    setCategoriaExpandida(null);
  }, [mesSelecionado]);

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

    if (categoriaExpandida && categorias[categoriaExpandida]) {
      // Drill-down: Show Subcategorias for the selected category
      const catData = categorias[categoriaExpandida];
      const catTotal = catData.total;
      const subcategorias = catData.subcategorias || {};

      const formattedData = Object.entries(subcategorias).map(([name, value]) => ({
        name,
        value: value as number,
        percentage: catTotal > 0 ? ((value as number) / catTotal) * 100 : 0
      }));
      
      formattedData.sort((a, b) => b.value - a.value);
      return formattedData;
    } else {
      // Overview: Show Categorias
      const formattedData = Object.entries(categorias || {}).map(([name, catData]) => ({
        name,
        value: catData.total,
        percentage: periodTotal > 0 ? (catData.total / periodTotal) * 100 : 0
      }));
      
      formattedData.sort((a, b) => b.value - a.value);
      return formattedData;
    }
  }, [currentPeriodData, categoriaExpandida]);

  const availableMonths = useMemo(() => {
    if (!data || !data.meses) return [];
    return Object.keys(data.meses).sort();
  }, [data]);

  const headerTotal = useMemo(() => {
    if (!currentPeriodData) return 0;
    if (categoriaExpandida && currentPeriodData.categorias[categoriaExpandida]) {
      return currentPeriodData.categorias[categoriaExpandida].total;
    }
    return currentPeriodData.total;
  }, [currentPeriodData, categoriaExpandida]);

  const headerTitle = categoriaExpandida 
    ? `Detalhes: ${categoriaExpandida}` 
    : 'Visão Geral de Compras';

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto w-full flex justify-center items-start">
      <div className="bg-[#121212] border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-2xl w-full max-w-5xl mt-4">
        
        {/* Header */}
        <div className="mb-10 border-b border-zinc-800/80 pb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6">
          <div>
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">{headerTitle}</h2>
            <div className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              {formatCurrency(headerTotal)}
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-zinc-500 hidden sm:block" />
              <select 
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium cursor-pointer w-full sm:w-auto min-w-[200px]"
              >
                <option value="geral">VISÃO GERAL (TODOS)</option>
                {availableMonths.map(mes => (
                  <option key={mes} value={mes}>
                    {nomesMeses[mes] ? nomesMeses[mes] : `MÊS ${mes}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full">
              NFe Sincronizada
            </div>
          </div>
        </div>

        {/* Content */}
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
                  {categoriaExpandida ? 'Subcategorias' : 'Categorias'}
                </span>
                <span className="text-3xl font-black text-white">{chartData.length}</span>
              </div>
            )}
          </div>

          {/* Table/Legend Section */}
          <div className="flex flex-col h-[350px]">
            {categoriaExpandida && (
              <button 
                onClick={() => setCategoriaExpandida(null)}
                className="self-start text-cyan-400 hover:text-cyan-300 text-[11px] font-bold uppercase tracking-widest mb-4 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para Categorias Gerais
              </button>
            )}
            
            <div className="bg-zinc-900/40 rounded-2xl p-2 border border-zinc-800/50 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10">
                    <tr>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                        {categoriaExpandida ? 'Subcategoria' : 'Setor/Categoria'}
                      </th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">Custo Total</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-b border-zinc-800">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {chartData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-zinc-600 text-sm">Nenhum registro encontrado.</td>
                      </tr>
                    )}
                    {chartData.map((item, index) => (
                      <tr 
                        key={item.name} 
                        onClick={() => {
                          if (!categoriaExpandida) {
                            setCategoriaExpandida(item.name);
                          }
                        }}
                        className={`hover:bg-zinc-800/40 transition-colors group ${!categoriaExpandida ? 'cursor-pointer' : ''}`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className={`text-sm font-bold text-zinc-200 transition-colors ${!categoriaExpandida ? 'group-hover:text-cyan-400' : 'group-hover:text-white'}`}>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
