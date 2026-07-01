import React, { useState, useRef } from "react";
import { UploadCloud, FileText, AlertCircle, BarChart3, TrendingUp, DollarSign, Award, CheckCircle2, FileSpreadsheet, Trophy } from "lucide-react";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

// Configuração do worker do PDF.js via CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface VendaItem {
  nome: string;
  quantidade: number;
  valorTotal: number;
}

export default function RelatoriosVendasModule() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendas, setVendas] = useState<VendaItem[]>([]);
  const [kpis, setKpis] = useState<{ totalVendas: number; totalItens: number; ticketMedio: number; topGarcom?: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = (items: VendaItem[], garcomName?: string) => {
    if (items.length === 0) {
      setError("Nenhum dado de venda encontrado no arquivo.");
      setLoading(false);
      return;
    }

    const totalVendas = items.reduce((acc, curr) => acc + curr.valorTotal, 0);
    const totalItens = items.reduce((acc, curr) => acc + curr.quantidade, 0);
    const ticketMedio = totalItens > 0 ? totalVendas / totalItens : 0;

    // Agrupar itens duplicados
    const groupedItems: Record<string, VendaItem> = {};
    items.forEach(item => {
      const key = item.nome.toUpperCase().trim();
      if (!groupedItems[key]) {
        groupedItems[key] = { ...item };
      } else {
        groupedItems[key].quantidade += item.quantidade;
        groupedItems[key].valorTotal += item.valorTotal;
      }
    });

    const sortedVendas = Object.values(groupedItems).sort((a, b) => b.quantidade - a.quantidade);

    setVendas(sortedVendas);
    setKpis({
      totalVendas,
      totalItens,
      ticketMedio,
      topGarcom: garcomName || "Não identificado"
    });
    setError(null);
    setLoading(false);
  };

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<any>(worksheet);

      const items: VendaItem[] = [];

      json.forEach(row => {
        // Tentativa de adivinhar colunas baseadas em relatórios comuns
        const nome = row["Nome"] || row["Produto"] || row["Descrição"] || row["Item"] || row["NOME"];
        const quantidade = parseFloat(row["Quantidade"] || row["Qtd"] || row["QTD"] || 0);
        
        let valorRaw = row["Valor Venda (R$)"] || row["Total"] || row["Valor"] || row["Valor Total"] || 0;
        if (typeof valorRaw === "string") {
          valorRaw = parseFloat(valorRaw.replace(/\./g, "").replace(",", "."));
        }

        if (nome && quantidade > 0) {
          items.push({
            nome: String(nome),
            quantidade: quantidade,
            valorTotal: valorRaw || 0
          });
        }
      });

      processData(items);
    } catch (err: any) {
      setError("Erro ao ler arquivo Excel: " + err.message);
      setLoading(false);
    }
  };

  const parsePDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      console.log("PDF TEXT:", fullText);

      // Best-effort PDF Parsing for the provided Softcom report
      // "Relatório Gerente Vendas - PRODUTO"
      
      let garcomMatch = fullText.match(/Vendedor\s+([A-Z\s]+?)\s+Indicador/i);
      if (!garcomMatch) garcomMatch = fullText.match(/Atendente\s+([A-Z\s]+?)\s+Empresa/i);
      const garcomName = garcomMatch ? garcomMatch[1].trim() : undefined;

      // Extract lines that look like a product row in Softcom report
      // Softcom layout has a table with numbers at the end: Quantidade, Valor Venda, Valor Lucro, Preço Médio
      // Usually separated by spaces.
      
      // Let's use a regex to capture sequences that end with multiple currency-like values
      const items: VendaItem[] = [];
      
      // Since PDF text extraction can be messy, we split by typical separators or try to find currency patterns
      const lines = fullText.split('\n');
      
      // For Softcom reports, the items are often listed line by line in text, but let's try a regex on the full text
      // Pattern: Some Name... then -XXX,XX (Estoque) XX,XX (Quantidade) X.XXX,XX (Valor Venda) X.XXX,XX (Valor Lucro) XXX,XX (Preço)
      const regex = /([A-Za-z0-9\s\-\/\.]+?)\s+\-?[\d\.]+\,\d{2}\s+([\d\.]+\,\d{2})\s+([\d\.]+\,\d{2})\s+[\d\.]+\,\d{2}\s+[\d\.]+\,\d{2}/gi;
      
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        let name = match[1].trim();
        // Remove known prefixes like a code "663 MENU" -> "MENU"
        name = name.replace(/^\d+\s+/, "");
        
        let qtdStr = match[2].replace(/\./g, "").replace(",", ".");
        let valStr = match[3].replace(/\./g, "").replace(",", ".");
        
        items.push({
          nome: name,
          quantidade: parseFloat(qtdStr),
          valorTotal: parseFloat(valStr)
        });
      }

      processData(items, garcomName);

    } catch (err: any) {
      setError("Erro ao ler arquivo PDF: " + (err.message || "Formato incompatível ou não reconhecido."));
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setVendas([]);
    setKpis(null);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".csv");
    const isPDF = file.name.endsWith(".pdf");

    if (isExcel) {
      parseExcel(file);
    } else if (isPDF) {
      parsePDF(file);
    } else {
      setError("Formato de arquivo não suportado. Por favor, envie .xlsx, .csv ou .pdf");
      setLoading(false);
    }
  };

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
            Faça upload do seu relatório de vendas para calcular KPIs e comissões automaticamente.
          </p>
        </div>
      </div>

      {/* UPLOAD AREA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center border-dashed relative">
        <input 
          type="file" 
          accept=".pdf, .xlsx, .csv" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileUpload}
          ref={fileInputRef}
          disabled={loading}
        />
        
        {loading ? (
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-300 font-medium">Analisando relatório...</p>
            <p className="text-slate-500 text-xs mt-1">Extraindo dados usando heurísticas avançadas</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-fuchsia-400">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Arraste seu relatório aqui</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md">
              Suporta relatórios PDF do Softcom, ou arquivos Excel (.xlsx) e CSV.
            </p>
            <button className="mt-6 px-6 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-medium transition shadow-lg flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Selecionar Arquivo
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Erro na leitura do relatório</p>
            <p className="opacity-80 mt-1">{error}</p>
            <p className="opacity-80 mt-2">Dica: Se o PDF não for lido corretamente, exporte o relatório do Softcom para Excel (.xlsx) e tente novamente. O leitor de Excel é 100% preciso.</p>
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      {kpis && !loading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          <h2 className="text-xl font-bold text-white tracking-tight">Resultados da Análise</h2>
          
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
                Garçom Identificado
              </p>
              <p className="text-xl font-bold text-white relative z-10 truncate">
                {kpis.topGarcom}
              </p>
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
                    <th className="p-4 font-semibold text-right">Qtd.</th>
                    <th className="p-4 font-semibold text-right text-emerald-400">Total Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {vendas.slice(0, 50).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-200">{item.nome}</p>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-300">
                        {item.quantidade}
                      </td>
                      <td className="p-4 text-right font-mono text-white font-bold">
                        R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {vendas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhum item válido identificado no relatório.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}
