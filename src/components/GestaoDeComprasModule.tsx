import React, { useState, useEffect, useMemo } from "react";
import { appDb } from "../firebase";
import { useAuth, UserRole } from "../context/AuthContext";
import { 
  ShoppingCart, Plus, Trash2, CheckCircle2, Clock, AlertCircle, 
  Send, ChefHat, Wine, ShieldCheck, Search, Check, 
  FileText, Copy, RefreshCw, ChevronDown, ChevronUp, 
  PackageCheck, DollarSign, Layers, Sparkles, MessageSquare, Shield
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Estrutura do item da requisição (Requisito 4)
export interface ItemRequisicao {
  id: string;
  nome: string;
  unidade: string;
  quantidadeSolicitada: number;
  quantidadeAprovada: number;
  ultimoPreco?: number;
  observacao?: string;
}

// Estrutura da coleção 'requisicoes' no Firestore (Requisito 4)
export interface RequisicaoCompra {
  id?: string;
  setor: "cozinha" | "bar" | "limpeza" | "geral";
  solicitante: string;
  solicitanteId: string;
  dataCriacao: string;
  status: "pendente" | "aprovado" | "comprado" | "finalizado" | "rejeitado";
  itens: ItemRequisicao[];
  observacoes?: string;
  aprovadoPor?: string;
  dataAprovacao?: string;
  valorTotalEstimado?: number;
  createdAt?: string;
  createdBy?: string;
}

// Item do catálogo pré-carregado das planilhas para autocomplete
interface ItemCatalogo {
  nome: string;
  unidade: string;
  ultimoPreco: number;
  categoria?: string;
}

const COMPRAS_API_URL = "https://script.google.com/macros/s/AKfycbzNyhNQFrmIZ7iB--EYhcdCcNhrquWatUveNQv85-Z4e61FKaB30gNyBuwUvf517sQVWQ/exec";
const VENDAS_API_URL = "https://script.google.com/macros/s/AKfycbzZjwaEDHoyuIuBZ3omHGDmPxD3HA82b8In6ocV3Yp0s-6lzqeXjTs5EDUJ4HQmhx6k/exec";

export default function GestaoDeComprasModule() {
  const { user, role, setRole, isAdmin, isChefCozinha, isChefBar, isSolicitante } = useAuth();

  // Dados das requisições em tempo real do Firestore
  const [requisicoes, setRequisicoes] = useState<RequisicaoCompra[]>([]);
  const [loadingRequisicoes, setLoadingRequisicoes] = useState(true);

  // Catálogo pré-carregado das planilhas para autocomplete
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  // Controle de abas para o Admin (se for solicitante, a visualização é direta em 'solicitar')
  const [adminTab, setAdminTab] = useState<"dashboard" | "nova_requisicao">("dashboard");

  // Filtros da Visão do Administrador
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [buscaTermo, setBuscaTermo] = useState<string>("");
  const [requisicaoAbertaId, setRequisicaoAbertaId] = useState<string | null>(null);

  // Estado do formulário de Nova Requisição (Solicitante: Bar / Cozinha)
  const setorPadrao = isChefCozinha ? "cozinha" : isChefBar ? "bar" : "cozinha";
  const [novoSetor, setNovoSetor] = useState<"cozinha" | "bar" | "limpeza" | "geral">(setorPadrao);
  const [itensRascunho, setItensRascunho] = useState<ItemRequisicao[]>([]);
  const [observacoesGerais, setObservacoesGerais] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [feedbackEnvio, setFeedbackEnvio] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);

  // Linha atual sendo digitada no formulário de itens
  const [itemNome, setItemNome] = useState("");
  const [itemQtd, setItemQtd] = useState("");
  const [itemUnidade, setItemUnidade] = useState("UN");
  const [itemObs, setItemObs] = useState("");
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);

  // Edição de quantidade aprovada pelo Admin (corte de excessos in-line)
  const [quantidadesEditadas, setQuantidadesEditadas] = useState<{ [itemId: string]: number }>({});

  // Atualiza o setor selecionado quando o cargo muda
  useEffect(() => {
    if (isChefCozinha) {
      setNovoSetor("cozinha");
    } else if (isChefBar) {
      setNovoSetor("bar");
    }
  }, [isChefCozinha, isChefBar]);

  // Carrega requisições do Firestore em tempo real
  useEffect(() => {
    setLoadingRequisicoes(true);
    const unsubscribe = appDb.subscribe(
      "requisicoes",
      (dados: any[]) => {
        setRequisicoes(dados as RequisicaoCompra[]);
        setLoadingRequisicoes(false);
      },
      (err: any) => {
        console.error("Erro ao sincronizar requisições do Firestore:", err);
        setLoadingRequisicoes(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Ingestão do catálogo da planilha para alimentar o autocomplete dos itens
  useEffect(() => {
    const fetchCatalogo = async () => {
      setLoadingCatalogo(true);
      try {
        const itensMapeados: ItemCatalogo[] = [];
        const nomesRegistrados = new Set<string>();

        // 1. Ingestão da Planilha de Compras & Histórico
        const respCompras = await fetch(COMPRAS_API_URL);
        if (respCompras.ok) {
          const jsonCompras = await respCompras.json();
          if (jsonCompras.sucesso && jsonCompras.geral && jsonCompras.geral.itensBusca) {
            Object.entries(jsonCompras.geral.itensBusca).forEach(([nomeItem, info]: [string, any]) => {
              const qtd = Number(info?.qtd) || 0;
              const total = Number(info?.total) || 0;
              const preco = qtd > 0 ? total / qtd : 0;
              const nomeUpper = nomeItem.toUpperCase();

              let unidade = "UN";
              if (nomeUpper.includes(" KG") || nomeUpper.includes("QUILO")) unidade = "KG";
              else if (nomeUpper.includes(" 1L") || nomeUpper.includes(" 5L") || nomeUpper.includes("LITRO")) unidade = "L";
              else if (nomeUpper.includes(" ML")) unidade = "UN";

              nomesRegistrados.add(nomeUpper);
              itensMapeados.push({
                nome: nomeItem,
                unidade,
                ultimoPreco: preco,
                categoria: "Compras"
              });
            });
          }
        }

        // 2. Ingestão da Planilha de Insumos & Vendas
        try {
          const respVendas = await fetch(VENDAS_API_URL);
          const jsonVendas = await respVendas.json();
          if (jsonVendas.sucesso && Array.isArray(jsonVendas.catalogoInsumos)) {
            jsonVendas.catalogoInsumos.forEach((item: any) => {
              const nomeItem = (item.um && item.um.length > 5 ? item.um : item.nome || "").toString();
              const nomeUpper = nomeItem.toUpperCase();
              if (nomeItem && !nomesRegistrados.has(nomeUpper)) {
                nomesRegistrados.add(nomeUpper);
                itensMapeados.push({
                  nome: nomeItem,
                  unidade: item.um || "UN",
                  ultimoPreco: Number(item.custo) || 0,
                  categoria: "Insumos"
                });
              }
            });
          }
        } catch (_) {}

        setCatalogo(itensMapeados);
      } catch (err) {
        console.warn("Aviso ao carregar catálogo para autocomplete:", err);
      } finally {
        setLoadingCatalogo(false);
      }
    };

    fetchCatalogo();
  }, []);

  // Sugestões filtradas no autocomplete
  const sugestoesFiltradas = useMemo(() => {
    if (!itemNome.trim()) return catalogo.slice(0, 25);
    const termo = itemNome.toLowerCase();
    return catalogo
      .filter(item => item.nome.toLowerCase().includes(termo))
      .slice(0, 25);
  }, [catalogo, itemNome]);

  // Adiciona item ao rascunho do pedido (Solicitante)
  const handleAdicionarItemRascunho = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemNome.trim()) return;

    const qtdNum = parseFloat(itemQtd.replace(",", "."));
    if (!qtdNum || qtdNum <= 0) {
      alert("Por favor, informe uma quantidade válida maior que zero.");
      return;
    }

    // Busca o último preço no catálogo
    const catItem = catalogo.find(
      c => c.nome.toLowerCase().trim() === itemNome.toLowerCase().trim()
    );

    const novoItem: ItemRequisicao = {
      id: "it_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      nome: itemNome.trim().toUpperCase(),
      unidade: itemUnidade.toUpperCase(),
      quantidadeSolicitada: qtdNum,
      quantidadeAprovada: qtdNum, // Inicialmente igual à solicitada
      ultimoPreco: catItem ? catItem.ultimoPreco : undefined,
      observacao: itemObs.trim() || undefined
    };

    setItensRascunho(prev => [...prev, novoItem]);
    setItemNome("");
    setItemQtd("");
    setItemObs("");
    setSugestoesAbertas(false);
  };

  const handleRemoverItemRascunho = (id: string) => {
    setItensRascunho(prev => prev.filter(i => i.id !== id));
  };

  // Enviar Pedido para Gerência (Salva documento no Firestore com status 'pendente')
  const handleEnviarRequisicao = async () => {
    if (itensRascunho.length === 0) {
      alert("Adicione pelo menos 1 item na lista antes de enviar a requisição.");
      return;
    }

    setEnviando(true);
    setFeedbackEnvio(null);

    try {
      const valorTotalEstimado = itensRascunho.reduce((acc, item) => {
        return acc + (item.quantidadeSolicitada * (item.ultimoPreco || 0));
      }, 0);

      const setorDestino = isChefCozinha ? "cozinha" : isChefBar ? "bar" : novoSetor;

      const novaRequisicao: Omit<RequisicaoCompra, "id"> = {
        setor: setorDestino,
        solicitante: user?.displayName || user?.email || (isChefCozinha ? "Chef de Cozinha" : isChefBar ? "Chef de Bar" : "Solicitante"),
        solicitanteId: user?.uid || "anon",
        dataCriacao: new Date().toISOString(),
        status: "pendente",
        itens: itensRascunho,
        observacoes: observacoesGerais.trim() || undefined,
        valorTotalEstimado: valorTotalEstimado > 0 ? Number(valorTotalEstimado.toFixed(2)) : undefined
      };

      await appDb.add("requisicoes", novaRequisicao);

      setItensRascunho([]);
      setObservacoesGerais("");
      setFeedbackEnvio({
        tipo: "sucesso",
        msg: `Pedido enviado com sucesso para a Gerência com status 'Pendente'! O administrador já pode visualizar e aprovar os itens.`
      });

      // Se for admin que enviou pela aba de nova requisição, volta pro dashboard
      if (isAdmin) {
        setTimeout(() => setAdminTab("dashboard"), 1500);
      }
    } catch (err: any) {
      console.error("Erro ao enviar requisição para o Firestore:", err);
      setFeedbackEnvio({
        tipo: "erro",
        msg: "Erro ao salvar requisição no banco de dados: " + (err.message || "Tente novamente.")
      });
    } finally {
      setEnviando(false);
    }
  };

  // Funções do Administrador: Atualizar Status e Salvar Cortes de Quantidade
  const handleAtualizarStatus = async (
    requisicaoId: string, 
    novoStatus: RequisicaoCompra["status"]
  ) => {
    try {
      const req = requisicoes.find(r => r.id === requisicaoId);
      if (!req) return;

      // Aplica as quantidades editadas pelo Admin
      const itensAtualizados = req.itens.map(item => {
        const novaQtd = quantidadesEditadas[item.id] !== undefined 
          ? quantidadesEditadas[item.id] 
          : item.quantidadeAprovada;
        return {
          ...item,
          quantidadeAprovada: novaQtd
        };
      });

      const updates: any = {
        status: novoStatus,
        itens: itensAtualizados,
        aprovadoPor: user?.displayName || user?.email || "Gerência Geral",
        dataAprovacao: new Date().toISOString()
      };

      await appDb.update("requisicoes", requisicaoId, updates);
      alert(`Requisição ${novoStatus === 'aprovado' ? 'aprovada' : novoStatus === 'comprado' ? 'marcada como comprada' : 'atualizada'} com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao atualizar requisição:", err);
      alert("Erro ao atualizar requisição: " + err.message);
    }
  };

  const handleExcluirRequisicao = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta requisição?")) {
      try {
        await appDb.delete("requisicoes", id);
      } catch (err: any) {
        alert("Erro ao excluir: " + err.message);
      }
    }
  };

  // Copia lista formatada para enviar via WhatsApp para o fornecedor
  const handleCopiarParaWhatsApp = (req: RequisicaoCompra) => {
    const dataFormatada = new Date(req.dataCriacao).toLocaleDateString("pt-BR");
    let texto = `*PEDIDO DE COMPRA - SEA ROOFTOP*\n`;
    texto += `*Setor:* ${req.setor.toUpperCase()} | *Data:* ${dataFormatada}\n`;
    texto += `*Solicitante:* ${req.solicitante}\n\n`;
    texto += `*ITENS APROVADOS:*\n`;

    req.itens.forEach((item, idx) => {
      const qtdFinal = item.quantidadeAprovada ?? item.quantidadeSolicitada;
      texto += `${idx + 1}. *${item.nome}* - ${qtdFinal} ${item.unidade}`;
      if (item.observacao) texto += ` _(${item.observacao})_`;
      texto += `\n`;
    });

    if (req.observacoes) {
      texto += `\n*Observação:* ${req.observacoes}\n`;
    }

    navigator.clipboard.writeText(texto);
    alert("Lista de compras aprovada copiada com sucesso! Cole no WhatsApp do fornecedor.");
  };

  // Gera PDF oficial da requisição de compra
  const handleGerarPDF = (req: RequisicaoCompra) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("Ordem de Requisição de Compras", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Sea Rooftop Command Center • ID: ${req.id || "-"}`, 14, 29);
    doc.text(`Data: ${new Date(req.dataCriacao).toLocaleString("pt-BR")}`, 14, 35);
    doc.text(`Setor: ${req.setor.toUpperCase()} • Solicitante: ${req.solicitante}`, 14, 41);
    doc.text(`Status: ${req.status.toUpperCase()}`, 14, 47);

    const tableData = req.itens.map((item, idx) => [
      (idx + 1).toString(),
      item.nome,
      `${item.quantidadeSolicitada} ${item.unidade}`,
      `${item.quantidadeAprovada} ${item.unidade}`,
      item.ultimoPreco ? `R$ ${item.ultimoPreco.toFixed(2)}` : "-",
      item.ultimoPreco ? `R$ ${(item.quantidadeAprovada * item.ultimoPreco).toFixed(2)}` : "-",
      item.observacao || "-"
    ]);

    autoTable(doc, {
      startY: 53,
      head: [["#", "Item", "Qtd Solicitada", "Qtd Aprovada", "Últ. Preço", "Subtotal", "Obs"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [14, 116, 144] },
      styles: { fontSize: 9 }
    });

    doc.save(`requisicao_${req.setor}_${req.dataCriacao.slice(0, 10)}.pdf`);
  };

  // Filtragem das requisições para a visualização do Admin (Requisito 3)
  const requisicoesFiltradasAdmin = useMemo(() => {
    return requisicoes.filter(req => {
      const matchSetor = filtroSetor === "todos" || req.setor === filtroSetor;
      const matchStatus = filtroStatus === "todos" || req.status === filtroStatus;
      const matchBusca = !buscaTermo.trim() || 
        req.solicitante.toLowerCase().includes(buscaTermo.toLowerCase()) ||
        req.itens.some(i => i.nome.toLowerCase().includes(buscaTermo.toLowerCase()));
      return matchSetor && matchStatus && matchBusca;
    });
  }, [requisicoes, filtroSetor, filtroStatus, buscaTermo]);

  // Contadores por setor para as abas do Administrador
  const contadoresSetores = useMemo(() => {
    const total = requisicoes.length;
    const cozinha = requisicoes.filter(r => r.setor === "cozinha").length;
    const bar = requisicoes.filter(r => r.setor === "bar").length;
    const limpeza = requisicoes.filter(r => r.setor === "limpeza").length;
    return { total, cozinha, bar, limpeza };
  }, [requisicoes]);

  // Requisições do Solicitante (para visualização no histórico recente do chef)
  const minhasRequisicoesSolicitante = useMemo(() => {
    return requisicoes.filter(req => {
      if (isChefCozinha) return req.setor === "cozinha";
      if (isChefBar) return req.setor === "bar";
      return req.solicitanteId === user?.uid;
    });
  }, [requisicoes, isChefCozinha, isChefBar, user]);

  // Métricas para os Cards de KPI do Administrador
  const metricasAdmin = useMemo(() => {
    const pendentes = requisicoes.filter(r => r.status === "pendente").length;
    const aprovadas = requisicoes.filter(r => r.status === "aprovado").length;
    const compradas = requisicoes.filter(r => r.status === "comprado" || r.status === "finalizado").length;
    const valorEstimadoPendente = requisicoes
      .filter(r => r.status === "pendente")
      .reduce((acc, r) => acc + (r.valorTotalEstimado || 0), 0);

    return { pendentes, aprovadas, compradas, valorEstimadoPendente };
  }, [requisicoes]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* ========================================================================= */}
      {/* BARRA SUPERIOR DE RBAC & ALTERNADOR RÁPIDO DE CARGOS */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white shrink-0">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {isAdmin ? "Gestão & Aprovação de Compras" : "Nova Requisição de Compras"}
              </h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                role === "admin" 
                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
                  : role === "chef_cozinha" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
              }`}>
                {role === "admin" && <Shield className="h-3 w-3" />}
                {role === "chef_cozinha" && <ChefHat className="h-3 w-3" />}
                {role === "chef_bar" && <Wine className="h-3 w-3" />}
                {role === "admin" ? "Gerência / Admin" : role === "chef_cozinha" ? "Chef de Cozinha" : "Chef de Bar"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAdmin 
                ? "Dashboard consolidado com todas as requisições recebidas por setor (Bar, Cozinha, Limpeza). Ajuste quantidades e aprove os pedidos."
                : `Tela de solicitação de compras para o setor do ${isChefCozinha ? "Cozinha" : "Bar"}. Selecione os insumos e envie para a gerência.`
              }
            </p>
          </div>
        </div>

        {/* ROLE SWITCHER INTERATIVO (Para testes rápidos de ambos os fluxos) */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 shrink-0">
            Simular Cargo:
          </span>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[36px] ${
              role === "admin"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            👑 Gerente (Admin)
          </button>
          <button
            type="button"
            onClick={() => setRole("chef_cozinha")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[36px] ${
              role === "chef_cozinha"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            🍳 Chef Cozinha
          </button>
          <button
            type="button"
            onClick={() => setRole("chef_bar")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[36px] ${
              role === "chef_bar"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            🍸 Chef Bar
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REQUISITO 2: VISÃO DO SOLICITANTE (Chef de Cozinha & Chef de Bar)         */}
      {/* Se o usuário for chef_cozinha ou chef_bar, ele vê apenas a tela de        */}
      {/* "Nova Requisição" com formulário simples e envio para a gerência.         */}
      {/* ========================================================================= */}
      {isSolicitante && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* CARD PRINCIPAL DO FORMULÁRIO DE NOVA REQUISIÇÃO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
            
            {/* Header do Formulário com setor travado de acordo com o perfil */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="h-5 w-5 text-cyan-400" />
                  Formulário de Nova Requisição
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adicione os itens necessários para o seu setor. O pedido será enviado diretamente com status <strong className="text-amber-400">Pendente</strong> para aprovação da gerência.
                </p>
              </div>

              {/* Setor Automático (Bloqueado para o cargo do solicitante) */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Setor do Solicitante:</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase flex items-center gap-1.5 ${
                  isChefCozinha 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                    : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                }`}>
                  {isChefCozinha ? <ChefHat className="h-3.5 w-3.5" /> : <Wine className="h-3.5 w-3.5" />}
                  {isChefCozinha ? "🍳 Cozinha" : "🍸 Bar"}
                </span>
              </div>
            </div>

            {/* FORMULÁRIO SIMPLES PARA ADICIONAR ITENS À LISTA */}
            <form onSubmit={handleAdicionarItemRascunho} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Adicionar Insumo à Lista (Catálogo Pré-Cadastrado)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Nome do Item com Autocomplete */}
                <div className="sm:col-span-6 relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar item no catálogo (ex: Cenoura, Filé, Gin, Detergente) ou digitar..."
                      value={itemNome}
                      onChange={(e) => {
                        setItemNome(e.target.value);
                        setSugestoesAbertas(true);
                      }}
                      onFocus={() => setSugestoesAbertas(true)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[44px]"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  </div>

                  {/* Dropdown de sugestões do catálogo */}
                  {sugestoesAbertas && sugestoesFiltradas.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                      <div className="p-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/90 border-b border-slate-800 sticky top-0 flex justify-between">
                        <span>Catálogo Sincronizado ({catalogo.length} itens)</span>
                        <span className="lowercase text-slate-500">clique para preencher</span>
                      </div>
                      {sugestoesFiltradas.map((item, idx) => (
                        <div
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setItemNome(item.nome);
                            setItemUnidade(item.unidade);
                            setSugestoesAbertas(false);
                          }}
                          className="px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800/40 last:border-0"
                        >
                          <span className="font-medium truncate">{item.nome}</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 shrink-0 ml-2">
                            {item.unidade} {item.ultimoPreco > 0 ? `• R$ ${item.ultimoPreco.toFixed(2)}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantidade Necessária */}
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="Qtd (ex: 5)"
                    value={itemQtd}
                    onChange={(e) => setItemQtd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[44px]"
                  />
                </div>

                {/* Unidade */}
                <div className="sm:col-span-2">
                  <select
                    value={itemUnidade}
                    onChange={(e) => setItemUnidade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 min-h-[44px]"
                  >
                    <option value="KG">KG (Quilo)</option>
                    <option value="L">L (Litro)</option>
                    <option value="UN">UN (Unidade)</option>
                    <option value="G">G (Grama)</option>
                    <option value="ML">ML (Mililitro)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="FD">FD (Fardo)</option>
                    <option value="PCT">PCT (Pacote)</option>
                  </select>
                </div>

                {/* Botão Adicionar Item */}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1 shadow-md shadow-cyan-600/20"
                  >
                    <Plus className="h-4 w-4" /> Adicionar
                  </button>
                </div>

                {/* Observação rápida do item */}
                <div className="sm:col-span-12">
                  <input
                    type="text"
                    placeholder="Observação específica deste item (opcional, ex: 'marca preferencial', 'acabou no almoço', 'para almoço de sábado')"
                    value={itemObs}
                    onChange={(e) => setItemObs(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </form>

            {/* LISTA DE ITENS ADICIONADOS AO PEDIDO */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Itens na Lista Atual ({itensRascunho.length})
                </span>
                {itensRascunho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItensRascunho([])}
                    className="text-xs text-rose-400 hover:underline min-h-[32px] px-2"
                  >
                    Limpar lista
                  </button>
                )}
              </div>

              {itensRascunho.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-sm">
                  <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-30 text-cyan-400" />
                  Nenhum item adicionado ainda. Busque um insumo acima e clique em &quot;Adicionar&quot;.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                  {itensRascunho.map((item, idx) => (
                    <div key={item.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-slate-500 font-bold">#{idx + 1}</span>
                        <div>
                          <span className="font-semibold text-white block truncate">{item.nome}</span>
                          {item.observacao && (
                            <span className="text-xs text-slate-400 italic block">
                              Obs: {item.observacao}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-bold text-cyan-400 text-sm block">
                            {item.quantidadeSolicitada} {item.unidade}
                          </span>
                          {item.ultimoPreco && item.ultimoPreco > 0 ? (
                            <span className="text-[10px] text-slate-500 block font-mono">
                              (est. R$ {(item.quantidadeSolicitada * item.ultimoPreco).toFixed(2)})
                            </span>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoverItemRascunho(item.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OBSERVAÇÕES GERAIS PARA A GERÊNCIA */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-slate-300">
                Observações Gerais do Pedido <span className="text-slate-500">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Pedido com prioridade para a produção do banquete de sexta-feira à noite..."
                value={observacoesGerais}
                onChange={(e) => setObservacoesGerais(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* MENSAGEM DE FEEDBACK APÓS O ENVIO */}
            {feedbackEnvio && (
              <div className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
                feedbackEnvio.tipo === "sucesso"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}>
                {feedbackEnvio.tipo === "sucesso" ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />}
                <p>{feedbackEnvio.msg}</p>
              </div>
            )}

            {/* BOTÃO DE ENVIAR PEDIDO PARA GERÊNCIA (Requisito 2) */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Total de <strong className="text-white">{itensRascunho.length}</strong> insumo(s) na requisição.
              </span>

              <button
                type="button"
                onClick={handleEnviarRequisicao}
                disabled={enviando || itensRascunho.length === 0}
                className="w-full sm:w-auto min-h-[44px] px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {enviando ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Enviando ao Firestore...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Enviar Pedido para Gerência
                  </>
                )}
              </button>
            </div>

          </div>

          {/* HISTÓRICO RECENTE DO SETOR (Para o Chef acompanhar se a Gerência aprovou ou cortou quantidades) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Acompanhamento de Pedidos Recentes do seu Setor ({minhasRequisicoesSolicitante.length})
            </h3>
            
            {minhasRequisicoesSolicitante.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum pedido enviado anteriormente por este setor.</p>
            ) : (
              <div className="space-y-3">
                {minhasRequisicoesSolicitante.slice(0, 5).map((req) => {
                  const dataFormatada = new Date(req.dataCriacao).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                  });

                  return (
                    <div key={req.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-slate-300 font-medium">
                          Enviado em {dataFormatada} • {req.itens.length} item(ns)
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          req.status === "pendente" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          req.status === "aprovado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          req.status === "comprado" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                          "bg-slate-800 text-slate-300 border-slate-700"
                        }`}>
                          {req.status === "pendente" ? "⏳ Aguardando Gerência" :
                           req.status === "aprovado" ? "✅ Aprovado pela Gerência" :
                           req.status === "comprado" ? "📦 Comprado" : req.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Lista resumida de itens do pedido */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {req.itens.map((it) => {
                          const corte = it.quantidadeAprovada !== undefined && it.quantidadeAprovada < it.quantidadeSolicitada;
                          return (
                            <span key={it.id} className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[11px] text-slate-300">
                              {it.nome}: <strong className="text-cyan-400">{it.quantidadeAprovada ?? it.quantidadeSolicitada} {it.unidade}</strong>
                              {corte && <span className="text-amber-400 text-[10px] ml-1">(corte: pediu {it.quantidadeSolicitada})</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* REQUISITO 3: VISÃO DO ADMINISTRADOR (GERÊNCIA)                            */}
      {/* Se o usuário for admin, ele vê um dashboard consolidado com todas as      */}
      {/* requisições recebidas, separadas por setor (Bar, Cozinha, Limpeza).        */}
      {/* O admin pode editar quantidades (cortar excessos), ver último preço       */}
      {/* pago e alterar status para 'Aprovado' ou 'Comprado'.                       */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* ABAS DO ADMINISTRADOR (Dashboard Consolidado ou Criar Nova Requisição) */}
          <div className="flex border-b border-slate-800 gap-2 overflow-x-auto hide-scrollbar">
            <button
              type="button"
              onClick={() => setAdminTab("dashboard")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 min-h-[44px] ${
                adminTab === "dashboard"
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="h-4 w-4" />
              Dashboard Consolidado da Gerência ({requisicoes.length})
              {metricasAdmin.pendentes > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setAdminTab("nova_requisicao")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 min-h-[44px] ${
                adminTab === "nova_requisicao"
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Plus className="h-4 w-4" />
              + Lançar Requisição Administrativa
            </button>
          </div>

          {/* ABA 1: DASHBOARD CONSOLIDADO DA GERÊNCIA */}
          {adminTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* CARDS DE KPI / RESUMO OPERACIONAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    Pendentes de Aprovação
                    <Clock className="h-4 w-4 text-amber-400" />
                  </span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
                      {metricasAdmin.pendentes}
                    </span>
                    <span className="text-xs text-slate-500">pedidos aguardando</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    Aprovados (A Comprar)
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
                      {metricasAdmin.aprovadas}
                    </span>
                    <span className="text-xs text-slate-500">liberados para compra</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    Comprados / Finalizados
                    <PackageCheck className="h-4 w-4 text-cyan-400" />
                  </span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
                      {metricasAdmin.compradas}
                    </span>
                    <span className="text-xs text-slate-500">concluídos</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    Estimativa Pendente
                    <DollarSign className="h-4 w-4 text-slate-400" />
                  </span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
                      R$ {metricasAdmin.valorEstimadoPendente.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500">base planilhas</span>
                  </div>
                </div>
              </div>

              {/* FILTROS CONSOLIDADOS POR SETOR (Bar, Cozinha, Limpeza) E STATUS */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                
                {/* Abas Rápidas de Setor (Bar, Cozinha, Limpeza, Geral) */}
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                  <button
                    type="button"
                    onClick={() => setFiltroSetor("todos")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[38px] ${
                      filtroSetor === "todos"
                        ? "bg-slate-700 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos ({contadoresSetores.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroSetor("cozinha")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[38px] flex items-center gap-1.5 ${
                      filtroSetor === "cozinha"
                        ? "bg-emerald-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    <ChefHat className="h-3.5 w-3.5" />
                    Cozinha ({contadoresSetores.cozinha})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroSetor("bar")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[38px] flex items-center gap-1.5 ${
                      filtroSetor === "bar"
                        ? "bg-cyan-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Wine className="h-3.5 w-3.5" />
                    Bar ({contadoresSetores.bar})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroSetor("limpeza")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[38px] flex items-center gap-1.5 ${
                      filtroSetor === "limpeza"
                        ? "bg-purple-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Limpeza ({contadoresSetores.limpeza})
                  </button>
                </div>

                {/* Busca e Filtro de Status */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar insumo ou solicitante..."
                      value={buscaTermo}
                      onChange={(e) => setBuscaTermo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[38px]"
                    />
                  </div>

                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 min-h-[38px]"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="pendente">⏳ Pendentes</option>
                    <option value="aprovado">✅ Aprovados</option>
                    <option value="comprado">📦 Comprados</option>
                    <option value="finalizado">🏁 Finalizados</option>
                    <option value="rejeitado">❌ Rejeitados</option>
                  </select>
                </div>

              </div>

              {/* LISTA CONSOLIDADA DE REQUISIÇÕES (Com corte de excessos e alteração de status) */}
              {loadingRequisicoes ? (
                <div className="text-center py-16 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-3" />
                  <p className="text-xs font-mono uppercase tracking-widest">Sincronizando requisições do Firestore...</p>
                </div>
              ) : requisicoesFiltradasAdmin.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500">
                  <PackageCheck className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyan-400" />
                  <p className="text-base text-slate-300 font-medium">Nenhuma requisição encontrada com os filtros selecionados.</p>
                  <p className="text-xs text-slate-500 mt-1">Os pedidos enviados pelos chefs do bar e da cozinha aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requisicoesFiltradasAdmin.map((req) => {
                    const isAberta = requisicaoAbertaId === req.id;
                    const totalItens = req.itens.length;
                    const dataFormatada = new Date(req.dataCriacao).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                    });

                    return (
                      <div
                        key={req.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-md hover:border-slate-700"
                      >
                        {/* Header do Card com Resumo */}
                        <div 
                          className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                          onClick={() => setRequisicaoAbertaId(isAberta ? null : req.id!)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl text-lg shrink-0 ${
                              req.setor === "cozinha" ? "bg-emerald-500/10 text-emerald-400" :
                              req.setor === "bar" ? "bg-cyan-500/10 text-cyan-400" :
                              "bg-purple-500/10 text-purple-400"
                            }`}>
                              {req.setor === "cozinha" ? <ChefHat className="h-5 w-5" /> : req.setor === "bar" ? <Wine className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-base">
                                  Setor: {req.setor.toUpperCase()}
                                </span>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                  req.status === "pendente" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                  req.status === "aprovado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                  req.status === "comprado" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                  req.status === "rejeitado" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" :
                                  "bg-slate-800 text-slate-300 border-slate-700"
                                }`}>
                                  {req.status === "pendente" ? "⏳ Pendente" :
                                   req.status === "aprovado" ? "✅ Aprovado" :
                                   req.status === "comprado" ? "📦 Comprado" :
                                   req.status === "rejeitado" ? "❌ Rejeitado" : "🏁 Finalizado"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Solicitante: <strong className="text-slate-200">{req.solicitante}</strong> • {dataFormatada} • {totalItens} item(ns)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                            {req.valorTotalEstimado && req.valorTotalEstimado > 0 ? (
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Estimativa Total</span>
                                <span className="text-emerald-400 font-mono font-bold text-sm">
                                  R$ {req.valorTotalEstimado.toFixed(2)}
                                </span>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRequisicaoAbertaId(isAberta ? null : req.id!); }}
                              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Expandir detalhes"
                            >
                              {isAberta ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Conteúdo Expandido da Requisição (Corte de excessos + Alterar Status) */}
                        {isAberta && (
                          <div className="border-t border-slate-800 bg-slate-950/60 p-4 sm:p-6 space-y-5 animate-in fade-in duration-150">
                            
                            {/* Observação do Solicitante (se houver) */}
                            {req.observacoes && (
                              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-white block font-semibold mb-0.5">Observação do Solicitante:</strong>
                                  <p className="text-slate-300">{req.observacoes}</p>
                                </div>
                              </div>
                            )}

                            {/* TABELA DE ITENS COM EDIÇÃO DE QUANTIDADE (Corte de excessos) E ÚLTIMO PREÇO PAGO */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                  Itens Solicitados & Ajuste de Quantidades (Corte de Excessos)
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Edite a &quot;Qtd Aprovada&quot; para cortar excessos antes de confirmar
                                </span>
                              </div>

                              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                                    <tr>
                                      <th className="p-3">Insumo / Descrição</th>
                                      <th className="p-3 text-center">Qtd Solicitada</th>
                                      <th className="p-3 text-center w-40">Qtd Aprovada (Gerência)</th>
                                      <th className="p-3 text-right">Último Preço Pago</th>
                                      <th className="p-3 text-right">Subtotal Estimado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                    {req.itens.map((item) => {
                                      const qtdAprovadaAtual = quantidadesEditadas[item.id] !== undefined
                                        ? quantidadesEditadas[item.id]
                                        : item.quantidadeAprovada;

                                      const subtotal = (qtdAprovadaAtual * (item.ultimoPreco || 0));
                                      const houveCorte = qtdAprovadaAtual < item.quantidadeSolicitada;

                                      return (
                                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                          <td className="p-3">
                                            <span className="font-semibold text-white block">{item.nome}</span>
                                            {item.observacao && (
                                              <span className="text-[11px] text-slate-400 italic block mt-0.5">
                                                Obs: {item.observacao}
                                              </span>
                                            )}
                                          </td>
                                          
                                          <td className="p-3 text-center font-mono font-medium text-slate-400">
                                            {item.quantidadeSolicitada} {item.unidade}
                                          </td>

                                          <td className="p-3 text-center">
                                            {req.status === "pendente" ? (
                                              <div className="flex items-center justify-center gap-1.5">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  min="0"
                                                  value={qtdAprovadaAtual}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setQuantidadesEditadas(prev => ({
                                                      ...prev,
                                                      [item.id]: val
                                                    }));
                                                  }}
                                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-white focus:border-cyan-500 focus:outline-none min-h-[32px]"
                                                />
                                                <span className="text-slate-400 font-mono text-[11px]">{item.unidade}</span>
                                                {houveCorte && (
                                                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1 rounded border border-amber-500/20">
                                                    Corte
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="font-mono font-bold text-emerald-400">
                                                {qtdAprovadaAtual} {item.unidade}
                                              </span>
                                            )}
                                          </td>

                                          {/* Último Preço Pago (Sincronizado da planilha) */}
                                          <td className="p-3 text-right font-mono text-slate-300">
                                            {item.ultimoPreco && item.ultimoPreco > 0 
                                              ? `R$ ${item.ultimoPreco.toFixed(2)}` 
                                              : <span className="text-slate-600">---</span>}
                                          </td>

                                          {/* Subtotal Estimado */}
                                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                            {subtotal > 0 ? `R$ ${subtotal.toFixed(2)}` : "---"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* BARRA DE AÇÕES DO ADMINISTRADOR (Aprovar, Comprar, WhatsApp, PDF) */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleCopiarParaWhatsApp(req)}
                                  className="min-h-[44px] px-3.5 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                  title="Copiar lista para o WhatsApp de fornecedores"
                                >
                                  <Copy className="h-4 w-4" /> Copiar para WhatsApp
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleGerarPDF(req)}
                                  className="min-h-[44px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <FileText className="h-4 w-4" /> Exportar PDF
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExcluirRequisicao(req.id!)}
                                  className="min-h-[44px] px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" /> Excluir
                                </button>
                              </div>

                              {/* Ações de Transição de Status (Requisito 3) */}
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {req.status === "pendente" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleAtualizarStatus(req.id!, "rejeitado")}
                                      className="min-h-[44px] px-4 py-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-medium transition-colors"
                                    >
                                      Rejeitar Pedido
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAtualizarStatus(req.id!, "aprovado")}
                                      className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <Check className="h-4 w-4" /> Aprovar com Quantidades Acima
                                    </button>
                                  </>
                                )}

                                {req.status === "aprovado" && (
                                  <button
                                    type="button"
                                    onClick={() => handleAtualizarStatus(req.id!, "comprado")}
                                    className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <PackageCheck className="h-4 w-4" /> Marcar como Comprado
                                  </button>
                                )}

                                {req.status === "comprado" && (
                                  <button
                                    type="button"
                                    onClick={() => handleAtualizarStatus(req.id!, "finalizado")}
                                    className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Finalizar Arquivo
                                  </button>
                                )}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ABA 2: CRIAR NOVA REQUISIÇÃO (Opção para o próprio Administrador lançar) */}
          {adminTab === "nova_requisicao" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Plus className="h-5 w-5 text-cyan-400" />
                    Lançar Nova Requisição de Compras
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Como Administrador, você pode criar uma ordem para qualquer setor da operação.
                  </p>
                </div>

                {/* Seleção do Setor pelo Admin */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">Setor:</span>
                  <select
                    value={novoSetor}
                    onChange={(e) => setNovoSetor(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-500 min-h-[44px]"
                  >
                    <option value="cozinha">🍳 Cozinha</option>
                    <option value="bar">🍸 Bar</option>
                    <option value="limpeza">🧹 Limpeza</option>
                    <option value="geral">📦 Geral / Manutenção</option>
                  </select>
                </div>
              </div>

              {/* Form de adicionar item */}
              <form onSubmit={handleAdicionarItemRascunho} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 relative">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar item no catálogo ou digitar..."
                        value={itemNome}
                        onChange={(e) => {
                          setItemNome(e.target.value);
                          setSugestoesAbertas(true);
                        }}
                        onFocus={() => setSugestoesAbertas(true)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[44px]"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    </div>

                    {sugestoesAbertas && sugestoesFiltradas.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                        {sugestoesFiltradas.map((item, idx) => (
                          <div
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setItemNome(item.nome);
                              setItemUnidade(item.unidade);
                              setSugestoesAbertas(false);
                            }}
                            className="px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800/40 last:border-0"
                          >
                            <span className="font-medium truncate">{item.nome}</span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 shrink-0 ml-2">
                              {item.unidade} {item.ultimoPreco > 0 ? `• R$ ${item.ultimoPreco.toFixed(2)}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="Qtd"
                      value={itemQtd}
                      onChange={(e) => setItemQtd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[44px]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <select
                      value={itemUnidade}
                      onChange={(e) => setItemUnidade(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 min-h-[44px]"
                    >
                      <option value="KG">KG</option>
                      <option value="L">L</option>
                      <option value="UN">UN</option>
                      <option value="G">G</option>
                      <option value="ML">ML</option>
                      <option value="CX">CX</option>
                      <option value="FD">FD</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full min-h-[44px] bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1 shadow-md shadow-cyan-600/20"
                    >
                      <Plus className="h-4 w-4" /> Adicionar
                    </button>
                  </div>
                </div>
              </form>

              {/* Lista dos itens do rascunho */}
              {itensRascunho.length > 0 && (
                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                  {itensRascunho.map((item, idx) => (
                    <div key={item.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">#{idx + 1} {item.nome}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-cyan-400 font-bold">{item.quantidadeSolicitada} {item.unidade}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoverItemRascunho(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão de envio */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleEnviarRequisicao}
                  disabled={enviando || itensRascunho.length === 0}
                  className="min-h-[44px] px-8 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Send className="h-4 w-4" /> Enviar Requisição
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
