import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, AlertCircle, BarChart3, TrendingUp, DollarSign, Award, CheckCircle2, FileSpreadsheet, Trophy, RefreshCcw, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { appDb } from "../firebase";
import { VendaSoftcom } from "../types";

export default function RelatoriosVendasModule() {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Dados do Firebase
  const [registrosDb, setRegistrosDb] = useState<VendaSoftcom[]>([]);
  const [fetchingDb, setFetchingDb] = useState(true);

  // Estados derivados para exibição
  const [selectedGrupo, setSelectedGrupo] = useState<string>("Todos");
  const [gruposDisponiveis, setGruposDisponiveis] = useState<string[]>([]);
  
  const [vendas, setVendas] = useState<any[]>([]);
  const [vendasPorGarcom, setVendasPorGarcom] = useState<any[]>([]);
  const [kpis, setKpis] = useState<{ totalVendas: number; totalItens: number; ticketMedio: number; topGarcom?: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = appDb.subscribe("vendas_softcom", (data) => {
      const records = data as VendaSoftcom[];
      setRegistrosDb(records);
      
      const grupos = Array.from(new Set(records.map(r => r.grupo || "Geral"))).sort();
      setGruposDisponiveis(["Todos", ...grupos]);

      setFetchingDb(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (registrosDb.length > 0) {
      processDbData(registrosDb, selectedGrupo);
    } else {
      setKpis(null);
      setVendas([]);
      setVendasPorGarcom([]);
    }
  }, [registrosDb, selectedGrupo]);

  const processDbData = (records: VendaSoftcom[], grupoFiltro: string) => {
    let filteredRecords = records;
    if (grupoFiltro !== "Todos") {
      filteredRecords = records.filter(r => (r.grupo || "Geral") === grupoFiltro);
    }

    let totalVendas = 0;
    let totalItens = 0;
    
    // Agrupar itens duplicados
    const groupedItems: Record<string, any> = {};
    const garcomStats: Record<string, number> = {};

    filteredRecords.forEach(item => {
      totalVendas += item.valorVenda;
      totalItens += item.quantidade;

      const key = item.nome.toUpperCase().trim();
      if (!groupedItems[key]) {
        groupedItems[key] = { 
          nome: item.nome, 
          quantidade: item.quantidade, 
          valorTotal: item.valorVenda,
          grupo: item.grupo || "Sem Grupo" 
        };
      } else {
        groupedItems[key].quantidade += item.quantidade;
        groupedItems[key].valorTotal += item.valorVenda;
      }

      const garcom = item.garcom || "Não Identificado";
      if (!garcomStats[garcom]) { garcomStats[garcom] = 0; }
      garcomStats[garcom] += item.valorVenda;
    });

    const ticketMedio = totalItens > 0 ? totalVendas / totalItens : 0;
    const sortedVendas = Object.values(groupedItems).sort((a, b) => b.quantidade - a.quantidade);
    
    const garcomArray = Object.keys(garcomStats).map(key => ({
      nome: key,
      valor: garcomStats[key]
    })).sort((a, b) => b.valor - a.valor);

    setVendas(sortedVendas);
    setVendasPorGarcom(garcomArray);
    
    setKpis({
      totalVendas,
      totalItens,
      ticketMedio,
      topGarcom: garcomArray.length > 0 ? garcomArray[0].nome : "Nenhum"
    });
  };

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<any>(worksheet);

      const itemsToAdd: any[] = [];
      const uploadDate = new Date().toISOString();

      json.forEach(row => {
        // Tentativa de adivinhar colunas baseadas em relatórios comuns do Softcom
        const nome = row["Nome"] || row["nome"] || row["Produto"] || row["NOME"];
        const quantidade = parseFloat(row["Quantidade"] || row["quantidade"] || row["Qtd"] || row["QTD"] || 0);
        const garcom = row["Garçom"] || row["garçom"] || row["Vendedor"] || row["vendedor"] || row["Atendente"] || row["atendente"] || "Não Identificado";
        const grupo = row["Grupo"] || row["grupo"] || row["Categoria"] || "Geral";
        
        let valorRaw = row["Valor Venda (R$)"] || row["Valor Venda"] || row["valor venda"] || row["Total"] || row["Valor"] || row["Valor Total"] || 0;
        if (typeof valorRaw === "string") {
          valorRaw = parseFloat(valorRaw.replace(/\./g, "").replace(",", "."));
        }

        if (nome && quantidade > 0) {
          itemsToAdd.push({
            dataUpload: uploadDate,
            garcom: String(garcom).trim(),
            nome: String(nome).trim(),
            grupo: String(grupo).trim(),
            quantidade: quantidade,
            valorVenda: valorRaw || 0
          });
        }
      });

      if (itemsToAdd.length === 0) {
        setError("Nenhum dado válido de venda encontrado na planilha.");
        setLoading(false);
        return;
      }

      await saveToDb(itemsToAdd);

    } catch (err: any) {
      setError("Erro ao ler arquivo Excel: " + err.message);
      setLoading(false);
    }
  };

  const saveToDb = async (items: any[]) => {
    try {
      // Salva no Firestore
      // Se forem muitos itens, seria ideal usar batch. Por enquanto gravamos individualmente ou com Promise.all.
      // O appDb.add já cuida da adição. Como pode ser um array grande, faremos em chunks para não travar
      const chunkSize = 50;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await Promise.all(chunk.map(item => appDb.add("vendas_softcom", item)));
      }
      
      setError(null);
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError("Erro ao salvar no banco de dados: " + err.message);
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingMsg("Processando e gravando dados...");
    setError(null);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".csv");

    if (isExcel) {
      parseExcel(file);
    } else {
      setError("Formato de arquivo não suportado. Por favor, envie arquivos .xlsx ou .csv");
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (confirm("Tem certeza que deseja apagar todos os dados de vendas armazenados? Esta ação não pode ser desfeita.")) {
      setLoading(true);
      setLoadingMsg("Limpando base de dados...");
      try {
        const chunkSize = 50;
        for (let i = 0; i < registrosDb.length; i += chunkSize) {
          const chunk = registrosDb.slice(i, i + chunkSize);
          await Promise.all(chunk.map(item => appDb.delete("vendas_softcom", item.id)));
        }
      } catch (err: any) {
        alert("Erro ao limpar dados: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  if (fetchingDb) {
    return <div className="p-8 text-slate-400">Carregando dados...</div>;
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-fuchsia-400" />
            Análise de Vendas (Softcom)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Faça upload do seu relatório de vendas para calcular KPIs e comissões automaticamente. Os dados ficam salvos para análises.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {registrosDb.length > 0 && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg text-sm font-medium text-white transition flex items-center gap-2 disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              Adicionar Planilha
            </button>
          )}
          {registrosDb.length > 0 && (
            <button 
              onClick={handleClearData}
              disabled={loading}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-sm font-medium text-rose-400 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Base de Dados
            </button>
          )}
        </div>
      </div>

      <input 
        type="file" 
        accept=".xlsx, .csv" 
        className="hidden"
        onChange={handleFileUpload}
        ref={fileInputRef}
        disabled={loading}
      />

      {/* UPLOAD AREA */}
      {registrosDb.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center border-dashed relative">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Upload file"
          />
          
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-300 font-medium">Processando e gravando dados...</p>
              <p className="text-slate-500 text-xs mt-1">Isso pode levar alguns segundos</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-fuchsia-400">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">Arraste seu relatório aqui</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md">
                Suporta planilhas Excel (.xlsx, .csv) do Softcom contendo as colunas de Garçom, Produto, Grupo, Quantidade e Valor Venda.
              </p>
              <button className="mt-6 px-6 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-medium transition shadow-lg flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Selecionar Arquivo
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Erro na leitura ou gravação do relatório</p>
            <p className="opacity-80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      {kpis && registrosDb.length > 0 && !loading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">Análise Consolidada</h2>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-slate-400 font-medium">Filtrar por Grupo:</span>
              <select 
                value={selectedGrupo} 
                onChange={(e) => setSelectedGrupo(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                {gruposDisponiveis.map(grupo => (
                  <option key={grupo} value={grupo}>{grupo}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* KPIs GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                Venda Total Bruta
              </p>
              <p className="text-2xl font-bold font-mono text-white">
                R$ {kpis.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
                Volume de Itens Vendidos
              </p>
              <p className="text-2xl font-bold font-mono text-white">
                {kpis.totalItens} <span className="text-sm text-slate-500 font-sans">unid.</span>
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                Ticket Médio (por item)
              </p>
              <p className="text-2xl font-bold font-mono text-white">
                R$ {kpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-gradient-to-br from-fuchsia-900/40 to-slate-900 border border-fuchsia-500/20 rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
              <Award className="absolute -right-4 -bottom-4 h-24 w-24 text-fuchsia-500/10 rotate-12" />
              <p className="text-xs text-fuchsia-400 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                Top Garçom
              </p>
              <p className="text-xl font-bold text-white relative z-10 truncate">
                {kpis.topGarcom}
              </p>
            </div>
          </div>

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-fuchsia-400" />
                Top 5 Itens Mais Vendidos (Qtd)
              </h3>
              <p className="text-xs text-slate-500 mb-4 font-sans">
                {selectedGrupo === "Todos" ? "Todos os grupos" : `Filtrado por: ${selectedGrupo}`}
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendas.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="nome" type="category" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: '#1e293b'}} 
                      contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px'}} 
                      itemStyle={{color: '#e879f9'}} 
                    />
                    <Bar dataKey="quantidade" fill="#d946ef" radius={[0, 4, 4, 0]}>
                      {vendas.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#d946ef' : '#c026d3'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono mb-1 flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                Venda por Garçom (R$)
              </h3>
              <p className="text-xs text-slate-500 mb-4 font-sans">
                {selectedGrupo === "Todos" ? "Todos os grupos" : `Filtrado por: ${selectedGrupo}`}
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendasPorGarcom.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="nome" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                    <Tooltip 
                      cursor={{fill: '#1e293b'}} 
                      contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px'}} 
                      itemStyle={{color: '#fbbf24'}}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Total']}
                    />
                    <Bar dataKey="valor" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* LISTA DE ITENS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Ranking de Produtos Vendidos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-mono">
                    <th className="p-4 font-semibold w-12 text-center">#</th>
                    <th className="p-4 font-semibold">Produto</th>
                    <th className="p-4 font-semibold">Grupo</th>
                    <th className="p-4 font-semibold text-right">Qtd.</th>
                    <th className="p-4 font-semibold text-right text-emerald-400">Total Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {vendas.slice(0, 100).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-200">{item.nome}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                          {item.grupo}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-300">
                        {item.quantidade}
                      </td>
                      <td className="p-4 text-right font-mono text-white font-bold">
                        R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
      
      {/* LOADING OVERLAY ON DELETE OR UPLOAD */}
      {loading && registrosDb.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="h-12 w-12 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white font-medium text-lg">{loadingMsg || "Processando..."}</p>
        </div>
      )}

    </div>
  );
}
