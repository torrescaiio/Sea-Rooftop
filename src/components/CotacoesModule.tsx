import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import {
  ShoppingCart, Truck, Upload, Tag, History, Plus, Trash2, Search, AlertTriangle,
  Check, X, Copy, Send, Trophy, Pencil, ChevronDown, ChevronUp, ClipboardList, FileSpreadsheet,
  MessageCircle, Database
} from "lucide-react";
import {
  Fornecedor, ProdutoCompra, Cotacao, UnidadeBase, OrigemCotacao, DIAS_VALIDADE_COTACAO,
  normalizar, parseNumeroBR, formatBRL, formatQtd, lerCotacaoTexto, linhasPlanilhaParaTexto,
  sugerirUnidadeBase, conteudoPara, casarProduto, precoPorBase, diasDesde, cotacoesVigentes,
  opcoesParaQuantidade, linkWhatsApp, DeteccaoEmbalagem, OpcaoCompra,
  lerBaseProdutos, lerBaseFornecedores, LinhaBase, FornecedorBase, estimativaReferencia, mensagemPedidoPreco,
  casarCatalogo
} from "../cotacoesUtils";

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------
interface ItemLista {
  key: string;
  produtoId?: string;
  nome: string;
  qtd: number;               // em unidade-base do produto
  fornecedorFixo?: string;   // escolha manual (senão vai no mais barato)
  requisicaoIds?: string[];
  aviso?: string;
}

interface PedidoCompra {
  id?: string;
  data: string;
  itens: { produtoId?: string; nome: string; fornecedorId: string; fornecedorNome: string; embalagens: number; precoEmbalagem: number; total: number }[];
  total: number;
  economia: number;
  requisicaoIds?: string[];
  createdAt?: string;
}

interface RequisicaoResumo {
  id?: string;
  setor: string;
  solicitante: string;
  status: string;
  dataCriacao?: string;
  itens: { id: string; nome: string; unidade: string; quantidadeSolicitada: number; quantidadeAprovada: number }[];
}

interface LinhaRevisao {
  incluir: boolean;
  descricao: string;
  preco: number;
  deteccao: DeteccaoEmbalagem;
  produtoId: string;         // id existente ou "__novo__"
  novoNome: string;
  novaUnidade: UnidadeBase;
  conteudo: string;
  conteudoOk: boolean;
  aproximado: boolean;
}

type Aba = "lista" | "precos" | "importar" | "fornecedores" | "pedidos";

const LISTA_KEY = "sea_lista_compras_v1";
const AVISO_UNIDADE = "Sem unidade cadastrada";
const ORIGENS: { id: OrigemCotacao; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "pdf", label: "PDF" },
  { id: "planilha", label: "Planilha" },
  { id: "site", label: "Site / App" },
  { id: "manual", label: "Manual" },
];
const UNIDADES: UnidadeBase[] = ["KG", "L", "UN"];

const hojeISO = () => new Date().toISOString().slice(0, 10);
const novaKey = () => Math.random().toString(36).slice(2, 10);

const carregarLista = (): ItemLista[] => {
  try {
    const raw = localStorage.getItem(LISTA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const inputCls = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none";
const btnPrim = "inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50";
const btnSec = "inline-flex items-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg disabled:opacity-50";
const card = "bg-slate-900/60 border border-slate-800 rounded-xl";

export default function CotacoesModule() {
  const [aba, setAba] = useState<Aba>("lista");

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCompra[]>([]);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onErr = (e: any) => setErro("Falha ao sincronizar com o banco: " + (e?.message || e));
    const subs = [
      appDb.subscribe("fornecedores", d => setFornecedores(d as Fornecedor[]), onErr),
      appDb.subscribe("produtos_compra", d => setProdutos(d as ProdutoCompra[]), onErr),
      appDb.subscribe("cotacoes", d => setCotacoes(d as Cotacao[]), onErr),
      appDb.subscribe("pedidos_compra", d => setPedidos(d as PedidoCompra[]), onErr),
      appDb.subscribe("requisicoes", d => setRequisicoes(d as RequisicaoResumo[]), onErr),
    ];
    return () => subs.forEach(u => u && u());
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const fornecedorPorId = useMemo(() => new Map(fornecedores.map(f => [f.id!, f])), [fornecedores]);
  const produtoPorId = useMemo(() => new Map(produtos.map(p => [p.id!, p])), [produtos]);
  const vigentes = useMemo(() => cotacoesVigentes(cotacoes), [cotacoes]);
  const nomeForn = (id: string) => fornecedorPorId.get(id)?.nome || "Fornecedor removido";

  // Pendências calculadas na hora a partir do estado do produto: somem sozinhas quando resolvidas
  const partesConferir = (p: ProdutoCompra) => (p.conferir || "").split("|").map(x => x.trim()).filter(Boolean);
  const pendencias = (p: ProdutoCompra): { tipo: "unidade" | "fornecedor" | "preco" | "referencia"; texto: string }[] => {
    const out: { tipo: "unidade" | "fornecedor" | "preco" | "referencia"; texto: string }[] = [];
    const partes = partesConferir(p);
    const temCotacao = (vigentes.get(p.id!) || []).length > 0;
    if (partes.includes(AVISO_UNIDADE)) out.push({ tipo: "unidade", texto: "O inventário não dizia a unidade. Como comparar o preço deste produto?" });
    if (!(p.fornecedorIds || []).some(id => fornecedorPorId.has(id))) out.push({ tipo: "fornecedor", texto: "Nenhum fornecedor ligado a este produto." });
    if (!temCotacao && !p.precoReferencia) out.push({ tipo: "preco", texto: "Sem preço: nenhuma cotação e nenhuma referência." });
    // avisos sobre o preço do inventário só importam enquanto não há cotação
    if (!temCotacao && p.precoReferencia) {
      partes.filter(x => x !== AVISO_UNIDADE && x !== "Sem preço" && x !== "Sem fornecedor").forEach(x => out.push({ tipo: "referencia", texto: x }));
    }
    return out;
  };

  // =========================================================================
  // LISTA DE COMPRAS
  // =========================================================================
  const [lista, setLista] = useState<ItemLista[]>(carregarLista);
  useEffect(() => {
    try { localStorage.setItem(LISTA_KEY, JSON.stringify(lista)); } catch { /* sem storage: segue só em memória */ }
  }, [lista]);

  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemQtd, setNovoItemQtd] = useState("");
  const [marcarRequisicoes, setMarcarRequisicoes] = useState(true);
  const [salvandoPedido, setSalvandoPedido] = useState(false);

  const adicionarItem = () => {
    const qtd = parseNumeroBR(novoItemQtd);
    if (!novoItemNome.trim() || !isFinite(qtd) || qtd <= 0) return;
    const { produto } = casarProduto(novoItemNome, produtos);
    const exato = produto && normalizar(produto.nome) === normalizar(novoItemNome);
    setLista(l => {
      const idx = produto ? l.findIndex(i => i.produtoId === produto.id) : -1;
      if (idx >= 0 && exato) {
        const c = [...l];
        c[idx] = { ...c[idx], qtd: c[idx].qtd + qtd };
        return c;
      }
      return [...l, {
        key: novaKey(),
        produtoId: exato ? produto!.id : undefined,
        nome: exato ? produto!.nome : novoItemNome.trim(),
        qtd,
      }];
    });
    setNovoItemNome("");
    setNovoItemQtd("");
  };

  const requisicoesAprovadas = useMemo(
    () => requisicoes.filter(r => r.status === "aprovado" && !lista.some(i => i.requisicaoIds?.includes(r.id!))),
    [requisicoes, lista]
  );

  const importarRequisicoes = () => {
    const novos = [...lista];
    requisicoesAprovadas.forEach(req => {
      (req.itens || []).forEach(it => {
        const qtd = Number(it.quantidadeAprovada) || Number(it.quantidadeSolicitada) || 0;
        if (qtd <= 0) return;
        const { produto, score } = casarProduto(it.nome, produtos);
        const confiavel = produto && score >= 0.7;
        const unidadeReq = (it.unidade || "").toUpperCase();
        const aviso = confiavel && unidadeReq && unidadeReq !== produto!.unidadeBase
          ? `Requisição em ${unidadeReq}, preço em ${produto!.unidadeBase}: confira a quantidade`
          : undefined;
        const idx = confiavel ? novos.findIndex(i => i.produtoId === produto!.id) : -1;
        if (idx >= 0) {
          novos[idx] = {
            ...novos[idx],
            qtd: novos[idx].qtd + qtd,
            requisicaoIds: Array.from(new Set([...(novos[idx].requisicaoIds || []), req.id!])),
            aviso: novos[idx].aviso || aviso,
          };
        } else {
          novos.push({
            key: novaKey(),
            produtoId: confiavel ? produto!.id : undefined,
            nome: confiavel ? produto!.nome : it.nome,
            qtd,
            requisicaoIds: [req.id!],
            aviso,
          });
        }
      });
    });
    setLista(novos);
    setMsg(`${requisicoesAprovadas.length} requisição(ões) aprovada(s) adicionada(s) à lista.`);
  };

  interface LinhaCalc {
    item: ItemLista;
    produto?: ProdutoCompra;
    opcoes: OpcaoCompra[];
    escolhida?: OpcaoCompra;
    economia: number;
    velha: boolean;
    estimativa: { total: number; embalagens?: number } | null;
  }

  const calc: LinhaCalc[] = useMemo(() => lista.map(item => {
    const produto = item.produtoId ? produtoPorId.get(item.produtoId) : undefined;
    const opcoes = produto ? opcoesParaQuantidade(item.qtd, vigentes.get(produto.id!) || []) : [];
    const escolhida = (item.fornecedorFixo && opcoes.find(o => o.cotacao.fornecedorId === item.fornecedorFixo)) || opcoes[0];
    const melhor = opcoes[0];
    const segunda = opcoes.find(o => o !== melhor);
    const economia = escolhida && escolhida === melhor && segunda ? segunda.total - melhor.total : 0;
    const velha = !!escolhida && diasDesde(escolhida.cotacao.data) > DIAS_VALIDADE_COTACAO;
    const estimativa = !escolhida && produto ? estimativaReferencia(item.qtd, produto) : null;
    return { item, produto, opcoes, escolhida, economia, velha, estimativa };
  }), [lista, produtoPorId, vigentes]);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, LinhaCalc[]>();
    calc.filter(c => c.escolhida).forEach(c => {
      const f = c.escolhida!.cotacao.fornecedorId;
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(c);
    });
    return Array.from(m.entries())
      .map(([fid, linhas]) => ({ fid, linhas, subtotal: linhas.reduce((s, l) => s + l.escolhida!.total, 0) }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [calc]);

  const semPreco = calc.filter(c => !c.escolhida);
  const totalEstimado = semPreco.reduce((s, c) => s + (c.estimativa?.total || 0), 0);
  const totalPedido = porFornecedor.reduce((s, g) => s + g.subtotal, 0);
  const nomesCatalogo = (p?: ProdutoCompra) => (p?.fornecedorIds || []).filter(id => fornecedorPorId.has(id)).map(nomeForn);

  // Pedido de preço: fornecedores do catálogo que ainda não têm cotação válida para os itens da lista
  const pedidosPreco = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number; unidade: string }[]>();
    calc.forEach(c => {
      if (!c.produto) return;
      const vig = vigentes.get(c.produto.id!) || [];
      (c.produto.fornecedorIds || []).forEach(fid => {
        if (!fornecedorPorId.has(fid)) return;
        const cot = vig.find(v => v.fornecedorId === fid);
        if (cot && diasDesde(cot.data) <= DIAS_VALIDADE_COTACAO) return;
        if (!m.has(fid)) m.set(fid, []);
        m.get(fid)!.push({ nome: c.produto!.nome, qtd: c.item.qtd, unidade: c.produto!.unidadeBase.toLowerCase() });
      });
    });
    return Array.from(m.entries()).map(([fid, itens]) => ({ fid, itens })).sort((a, b) => b.itens.length - a.itens.length);
  }, [calc, vigentes, fornecedorPorId]);
  const [mostrarPedirPreco, setMostrarPedirPreco] = useState(true);
  const economiaTotal = calc.reduce((s, c) => s + c.economia, 0);

  const mensagemFornecedor = (fid: string, linhas: LinhaCalc[], subtotal: number) => {
    const data = new Date().toLocaleDateString("pt-BR");
    const corpo = linhas.map(l => {
      const o = l.escolhida!;
      const desc = o.cotacao.descricaoOriginal || l.produto?.nome || l.item.nome;
      return `• ${o.embalagens} x ${desc} (${formatBRL(o.cotacao.preco)})`;
    }).join("\n");
    return `Olá, ${nomeForn(fid)}! Pedido do Sea Rooftop (${data}):\n\n${corpo}\n\nTotal estimado: ${formatBRL(subtotal)}\nPor favor, confirme disponibilidade e horário de entrega. Obrigado!`;
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setMsg("Mensagem copiada.");
    } catch {
      setMsg("Não consegui copiar automaticamente. Selecione o texto e copie.");
    }
  };

  const registrarPedido = async () => {
    if (porFornecedor.length === 0) return;
    setSalvandoPedido(true);
    try {
      const reqIds = Array.from(new Set(lista.flatMap(i => i.requisicaoIds || [])));
      const pedido: PedidoCompra = {
        data: new Date().toISOString(),
        itens: porFornecedor.flatMap(g => g.linhas.map(l => ({
          produtoId: l.produto?.id,
          nome: l.produto?.nome || l.item.nome,
          fornecedorId: g.fid,
          fornecedorNome: nomeForn(g.fid),
          embalagens: l.escolhida!.embalagens,
          precoEmbalagem: l.escolhida!.cotacao.preco,
          total: l.escolhida!.total,
        }))),
        total: totalPedido,
        economia: economiaTotal,
        requisicaoIds: reqIds,
      };
      await appDb.add("pedidos_compra", pedido);
      if (marcarRequisicoes) {
        for (const id of reqIds) await appDb.update("requisicoes", id, { status: "comprado" });
      }
      // mantém na lista só o que ficou sem preço
      setLista(l => l.filter(i => semPreco.some(s => s.item.key === i.key)));
      setMsg("Pedido registrado.");
    } catch (e: any) {
      setErro("Não foi possível registrar o pedido: " + (e?.message || e));
    } finally {
      setSalvandoPedido(false);
    }
  };

  // =========================================================================
  // PRODUTOS & PREÇOS
  // =========================================================================
  const [buscaPreco, setBuscaPreco] = useState("");
  const [filtroPreco, setFiltroPreco] = useState<"todos" | "conferir" | "semcot">("todos");
  const [ficha, setFicha] = useState<{ nome: string; categoria: string; refPreco: string; refConteudo: string }>({ nome: "", categoria: "", refPreco: "", refConteudo: "1" });
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null);
  const [novoProduto, setNovoProduto] = useState<{ nome: string; unidadeBase: UnidadeBase; categoria: string } | null>(null);
  const [cotManual, setCotManual] = useState({ fornecedorId: "", preco: "", conteudo: "1", descricao: "", data: hojeISO() });

  const produtosFiltrados = useMemo(() => {
    const q = normalizar(buscaPreco);
    return [...produtos]
      .filter(p => !q || normalizar(p.nome).includes(q) || normalizar(p.categoria || "").includes(q))
      .filter(p => filtroPreco === "todos" || (filtroPreco === "conferir" ? pendencias(p).length > 0 : !(vigentes.get(p.id!) || []).length))
      .sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nome.localeCompare(b.nome));
  }, [produtos, buscaPreco, filtroPreco, vigentes, fornecedorPorId]);
  const totalConferir = useMemo(() => produtos.filter(p => pendencias(p).length > 0).length, [produtos, vigentes, fornecedorPorId]);

  const atualizarCatalogo = async (p: ProdutoCompra, ids: string[]) => {
    await appDb.update("produtos_compra", p.id!, { fornecedorIds: Array.from(new Set(ids)) });
  };

  const salvarNovoProduto = async () => {
    if (!novoProduto?.nome.trim()) return;
    if (produtos.some(p => normalizar(p.nome) === normalizar(novoProduto.nome))) {
      setErro("Já existe um produto com esse nome.");
      return;
    }
    await appDb.add("produtos_compra", { nome: novoProduto.nome.trim(), unidadeBase: novoProduto.unidadeBase, categoria: novoProduto.categoria.trim(), aliases: [] });
    setNovoProduto(null);
    setMsg("Produto cadastrado.");
  };

  const abrirProduto = (p: ProdutoCompra | null) => {
    setProdutoAberto(p ? p.id! : null);
    if (!p) return;
    setFicha({
      nome: p.nome,
      categoria: p.categoria || "",
      refPreco: p.referenciaEmbalagem ? String(p.referenciaEmbalagem.preco).replace(".", ",") : "",
      refConteudo: p.referenciaEmbalagem ? String(p.referenciaEmbalagem.conteudo).replace(".", ",") : "1",
    });
    setCotManual(c => ({ ...c, preco: "", conteudo: p.referenciaEmbalagem ? String(p.referenciaEmbalagem.conteudo).replace(".", ",") : "1", descricao: "" }));
  };

  const definirUnidade = async (p: ProdutoCompra, u: UnidadeBase) => {
    if (u !== p.unidadeBase && (vigentes.get(p.id!) || []).length &&
      !confirm("Este produto já tem cotações nessa unidade. Mudar não converte as cotações antigas. Continuar?")) return;
    await appDb.update("produtos_compra", p.id!, { unidadeBase: u, conferir: partesConferir(p).filter(x => x !== AVISO_UNIDADE).join(" | ") });
  };

  const salvarReferencia = async (p: ProdutoCompra) => {
    const txt = ficha.refPreco.trim();
    const preco = parseNumeroBR(txt);
    const conteudo = parseNumeroBR(ficha.refConteudo || "1");
    let patch: any;
    if (!txt) {
      if (!p.referenciaEmbalagem) return;
      patch = { precoReferencia: null, referenciaEmbalagem: null };
    } else if (isFinite(preco) && preco > 0 && isFinite(conteudo) && conteudo > 0) {
      if (p.referenciaEmbalagem && p.referenciaEmbalagem.preco === preco && p.referenciaEmbalagem.conteudo === conteudo) return;
      patch = { precoReferencia: preco / conteudo, referenciaEmbalagem: { preco, conteudo }, referenciaFonte: "ajuste manual" };
    } else return;
    // corrigiu a referência: os avisos antigos sobre o preço deixam de valer
    patch.conferir = partesConferir(p).filter(x => x === AVISO_UNIDADE).join(" | ");
    await appDb.update("produtos_compra", p.id!, patch);
  };

  const dispensarAviso = (p: ProdutoCompra, texto: string) =>
    appDb.update("produtos_compra", p.id!, { conferir: partesConferir(p).filter(x => x !== texto).join(" | ") });

  const excluirProduto = async (p: ProdutoCompra) => {
    const n = cotacoes.filter(c => c.produtoId === p.id).length;
    if (!confirm(`Excluir "${p.nome}" e ${n} cotação(ões) dele?`)) return;
    for (const c of cotacoes.filter(c => c.produtoId === p.id)) await appDb.delete("cotacoes", c.id!);
    await appDb.delete("produtos_compra", p.id!);
  };

  const salvarCotacaoManual = async (produtoId: string) => {
    const preco = parseNumeroBR(cotManual.preco);
    const conteudo = parseNumeroBR(cotManual.conteudo);
    if (!cotManual.fornecedorId || !isFinite(preco) || preco <= 0 || !isFinite(conteudo) || conteudo <= 0) {
      setErro("Preencha fornecedor, preço e conteúdo da embalagem.");
      return;
    }
    await appDb.add("cotacoes", {
      produtoId, fornecedorId: cotManual.fornecedorId, preco, conteudo,
      descricaoOriginal: cotManual.descricao.trim() || produtoPorId.get(produtoId)?.nome,
      origem: "manual", data: new Date(cotManual.data + "T12:00:00").toISOString(),
    });
    setCotManual({ fornecedorId: cotManual.fornecedorId, preco: "", conteudo: "1", descricao: "", data: hojeISO() });
    setMsg("Cotação salva.");
  };

  // =========================================================================
  // IMPORTAR COTAÇÃO
  // =========================================================================
  const [impFornecedor, setImpFornecedor] = useState("");
  const [impOrigem, setImpOrigem] = useState<OrigemCotacao>("whatsapp");
  const [impData, setImpData] = useState(hojeISO());
  const [impTexto, setImpTexto] = useState("");
  const [revisao, setRevisao] = useState<LinhaRevisao[] | null>(null);
  const [salvandoImp, setSalvandoImp] = useState(false);
  const [impModo, setImpModo] = useState<"cotacao" | "catalogo" | "base">("cotacao");

  // Catálogo sem preço
  const [catTexto, setCatTexto] = useState("");
  const [catRevisao, setCatRevisao] = useState<{ produto: ProdutoCompra; termos: string[]; marcado: boolean; jaTem: boolean }[] | null>(null);
  const [salvandoCat, setSalvandoCat] = useState(false);

  const lerCatalogo = () => {
    if (!impFornecedor) { setErro("Escolha o fornecedor do catálogo."); return; }
    const achados = casarCatalogo(catTexto, produtos);
    if (achados.length === 0) { setErro("Nenhum produto da base bateu com esse catálogo. Confira se a base já foi importada."); return; }
    // qualquer fornecedor pode atender qualquer setor: tudo que bateu vem marcado
    setCatRevisao(achados.map(a => ({ ...a, jaTem: (a.produto.fornecedorIds || []).includes(impFornecedor), marcado: true })));
  };

  const salvarCatalogo = async () => {
    if (!catRevisao) return;
    setSalvandoCat(true);
    try {
      let add = 0, rem = 0;
      for (const r of catRevisao) {
        const ids = r.produto.fornecedorIds || [];
        if (r.marcado && !r.jaTem) { await appDb.update("produtos_compra", r.produto.id!, { fornecedorIds: [...ids, impFornecedor] }); add++; }
        if (!r.marcado && r.jaTem) { await appDb.update("produtos_compra", r.produto.id!, { fornecedorIds: ids.filter(x => x !== impFornecedor) }); rem++; }
      }
      setCatRevisao(null);
      setCatTexto("");
      setMsg(`Catálogo de ${nomeForn(impFornecedor)}: ${add} produto(s) adicionado(s)${rem ? `, ${rem} removido(s)` : ""}.`);
    } catch (e: any) {
      setErro("Erro ao salvar o catálogo: " + (e?.message || e));
    } finally {
      setSalvandoCat(false);
    }
  };

  // Base de produtos (planilha do inventário)
  const [baseLida, setBaseLida] = useState<{ arquivo: string; produtos: LinhaBase[]; fornecedores: FornecedorBase[] } | null>(null);
  const [baseAtualizar, setBaseAtualizar] = useState(true);
  const [baseProgresso, setBaseProgresso] = useState<string | null>(null);
  const [importandoBase, setImportandoBase] = useState(false);

  const lerArquivoBase = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const aba = (nome: string) => wb.SheetNames.find((n: string) => normalizar(n) === normalizar(nome));
      const abaProd = aba("Produtos") || wb.SheetNames[0];
      const rowsProd: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[abaProd], { header: 1, raw: true });
      const abaForn = aba("Fornecedores");
      const rowsForn: any[][] = abaForn ? XLSX.utils.sheet_to_json(wb.Sheets[abaForn], { header: 1, raw: true }) : [];
      const prods = lerBaseProdutos(rowsProd);
      if (prods.length === 0) {
        setErro('Não encontrei a aba "Produtos" com as colunas "Produto" e "Comparar por". Use a planilha Base de Compras.');
        return;
      }
      setBaseLida({ arquivo: file.name, produtos: prods, fornecedores: lerBaseFornecedores(rowsForn) });
    } catch (e: any) {
      setErro("Não consegui ler o arquivo: " + (e?.message || e));
    }
  };

  const resumoBase = useMemo(() => {
    if (!baseLida) return null;
    const existentes = new Set(produtos.map(p => normalizar(p.nome)));
    const fornExist = new Set(fornecedores.map(f => normalizar(f.nome)));
    const nomesForn = new Set<string>();
    baseLida.fornecedores.forEach(f => nomesForn.add(normalizar(f.nome)));
    baseLida.produtos.forEach(p => p.fornecedores.forEach(n => nomesForn.add(normalizar(n))));
    return {
      novos: baseLida.produtos.filter(p => !existentes.has(normalizar(p.nome))).length,
      existentes: baseLida.produtos.filter(p => existentes.has(normalizar(p.nome))).length,
      conferir: baseLida.produtos.filter(p => p.conferir || !p.preco).length,
      fornNovos: Array.from(nomesForn).filter(n => !fornExist.has(n)).length,
    };
  }, [baseLida, produtos, fornecedores]);

  const importarBase = async () => {
    if (!baseLida) return;
    setImportandoBase(true);
    try {
      // 1. Fornecedores
      const fornPorNome = new Map(fornecedores.map(f => [normalizar(f.nome), f]));
      const alvo = new Map<string, FornecedorBase>();
      baseLida.fornecedores.forEach(f => alvo.set(normalizar(f.nome), f));
      baseLida.produtos.forEach(p => p.fornecedores.forEach(n => { if (!alvo.has(normalizar(n))) alvo.set(normalizar(n), { nome: n }); }));
      const idForn = new Map<string, string>();
      let fornNovos = 0;
      for (const [k, fb] of Array.from(alvo.entries())) {
        const ex = fornPorNome.get(k);
        if (ex) {
          idForn.set(k, ex.id!);
          const patch: any = {};
          if (fb.whatsapp && !ex.whatsapp) patch.whatsapp = fb.whatsapp;
          if (fb.pedidoMinimo && !ex.pedidoMinimo) patch.pedidoMinimo = fb.pedidoMinimo;
          if (fb.diasEntrega && !ex.diasEntrega) patch.diasEntrega = fb.diasEntrega;
          if (Object.keys(patch).length) await appDb.update("fornecedores", ex.id!, patch);
        } else {
          const novo = await appDb.add("fornecedores", { nome: fb.nome, whatsapp: fb.whatsapp || "", pedidoMinimo: fb.pedidoMinimo || 0, diasEntrega: fb.diasEntrega || "", obs: "" });
          idForn.set(k, novo.id);
          fornNovos++;
        }
        setBaseProgresso(`Fornecedores: ${idForn.size} de ${alvo.size}`);
      }

      // 2. Produtos (em lotes)
      const prodPorNome = new Map(produtos.map(p => [normalizar(p.nome), p]));
      const comCotacao = new Set(cotacoes.map(c => c.produtoId));
      const fonte = baseLida.arquivo.replace(/\.[^.]+$/, "");
      let novos = 0, atualizados = 0, feitos = 0;
      const tarefas = baseLida.produtos.map(lb => async () => {
        const fIds = Array.from(new Set(lb.fornecedores.map(n => idForn.get(normalizar(n))).filter(Boolean) as string[]));
        const ref = lb.preco
          ? { precoReferencia: lb.preco / lb.conteudo, referenciaEmbalagem: { preco: lb.preco, conteudo: lb.conteudo } }
          : { precoReferencia: null, referenciaEmbalagem: null };
        const conferir = lb.conferir || (lb.preco ? "" : "Sem preço");
        const ex = prodPorNome.get(normalizar(lb.nome));
        if (!ex) {
          await appDb.add("produtos_compra", { nome: lb.nome, unidadeBase: lb.unidadeBase, categoria: lb.categoria, aliases: [], fornecedorIds: fIds, ...ref, referenciaFonte: fonte, conferir });
          novos++;
        } else if (baseAtualizar) {
          const patch: any = {
            categoria: ex.categoria || lb.categoria,
            fornecedorIds: Array.from(new Set([...(ex.fornecedorIds || []), ...fIds])),
            ...ref, referenciaFonte: fonte, conferir,
          };
          // não muda a unidade de quem já tem cotação (as cotações foram lançadas naquela unidade)
          if (!comCotacao.has(ex.id!)) patch.unidadeBase = lb.unidadeBase;
          else if (ex.unidadeBase !== lb.unidadeBase) {
            patch.precoReferencia = null;
            patch.referenciaEmbalagem = null;
            patch.conferir = [conferir, `Base em ${lb.unidadeBase}, produto já cotado em ${ex.unidadeBase}: referência não importada`].filter(Boolean).join(" | ");
          }
          await appDb.update("produtos_compra", ex.id!, patch);
          atualizados++;
        }
        feitos++;
      });
      for (let i = 0; i < tarefas.length; i += 15) {
        await Promise.all(tarefas.slice(i, i + 15).map(t => t()));
        setBaseProgresso(`Produtos: ${feitos} de ${tarefas.length}`);
      }
      setBaseLida(null);
      setBaseProgresso(null);
      setMsg(`Base importada: ${novos} produto(s) novo(s), ${atualizados} atualizado(s), ${fornNovos} fornecedor(es) novo(s).`);
      setAba("precos");
    } catch (e: any) {
      setErro("Erro ao importar a base: " + (e?.message || e) + ". O que já foi salvo fica salvo; pode importar de novo que ele atualiza sem duplicar.");
    } finally {
      setImportandoBase(false);
    }
  };

  const lerArquivo = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
      setImpTexto(linhasPlanilhaParaTexto(rows));
      setImpOrigem("planilha");
    } catch (e: any) {
      setErro("Não consegui ler o arquivo. Use .xlsx ou .csv, ou copie e cole o conteúdo. " + (e?.message || ""));
    }
  };

  const montarRevisao = () => {
    const linhas = lerCotacaoTexto(impTexto);
    if (linhas.length === 0) {
      setErro("Não encontrei nenhuma linha com produto e preço. Confira o texto colado.");
      return;
    }
    setRevisao(linhas.map(l => {
      const { produto, exato } = casarProduto(l.nome, produtos);
      const unidade = produto ? produto.unidadeBase : sugerirUnidadeBase(l.deteccao);
      const cont = conteudoPara(unidade, l.deteccao);
      return {
        incluir: true,
        descricao: l.nome,
        preco: l.preco,
        deteccao: l.deteccao,
        produtoId: produto ? produto.id! : "__novo__",
        novoNome: l.nome,
        novaUnidade: unidade,
        conteudo: formatQtd(cont.conteudo),
        conteudoOk: cont.ok,
        aproximado: !!produto && !exato,
      };
    }));
  };

  const atualizarRevisao = (i: number, patch: Partial<LinhaRevisao>) => {
    setRevisao(r => {
      if (!r) return r;
      const c = [...r];
      const atual = { ...c[i], ...patch };
      // trocou o produto ou a unidade: recalcula o conteúdo sugerido
      if (patch.produtoId !== undefined || patch.novaUnidade !== undefined) {
        const base = atual.produtoId === "__novo__" ? atual.novaUnidade : (produtoPorId.get(atual.produtoId)?.unidadeBase || "UN");
        const cont = conteudoPara(base, atual.deteccao);
        atual.conteudo = formatQtd(cont.conteudo);
        atual.conteudoOk = cont.ok;
        if (patch.produtoId !== undefined) atual.aproximado = false;
      }
      if (patch.conteudo !== undefined) atual.conteudoOk = true;
      c[i] = atual;
      return c;
    });
  };

  const salvarImportacao = async () => {
    if (!revisao || !impFornecedor) {
      setErro("Escolha o fornecedor da cotação.");
      return;
    }
    setSalvandoImp(true);
    let novosProdutos = 0;
    let salvas = 0;
    try {
      const criados = new Map<string, string>(); // nome normalizado -> id
      for (const l of revisao) {
        if (!l.incluir) continue;
        const conteudo = parseNumeroBR(l.conteudo);
        if (!isFinite(conteudo) || conteudo <= 0) continue;
        let produtoId = l.produtoId;
        if (produtoId === "__novo__") {
          const n = normalizar(l.novoNome);
          if (criados.has(n)) produtoId = criados.get(n)!;
          else {
            const existente = produtos.find(p => normalizar(p.nome) === n);
            if (existente) produtoId = existente.id!;
            else {
              const novo = await appDb.add("produtos_compra", { nome: l.novoNome.trim(), unidadeBase: l.novaUnidade, categoria: "", aliases: [normalizar(l.descricao)] });
              produtoId = novo.id;
              novosProdutos++;
            }
            criados.set(n, produtoId);
          }
        } else {
          // aprende o nome usado por esse fornecedor para casar automaticamente da próxima vez
          const p = produtoPorId.get(produtoId);
          const alias = normalizar(l.descricao);
          if (p && alias !== normalizar(p.nome) && !(p.aliases || []).includes(alias)) {
            await appDb.update("produtos_compra", produtoId, { aliases: [...(p.aliases || []), alias] });
            p.aliases = [...(p.aliases || []), alias];
          }
        }
        await appDb.add("cotacoes", {
          produtoId, fornecedorId: impFornecedor, preco: l.preco, conteudo,
          descricaoOriginal: l.descricao, origem: impOrigem,
          data: new Date(impData + "T12:00:00").toISOString(),
        });
        salvas++;
      }
      setRevisao(null);
      setImpTexto("");
      setMsg(`${salvas} preço(s) salvo(s)${novosProdutos ? `, ${novosProdutos} produto(s) novo(s)` : ""}.`);
    } catch (e: any) {
      setErro("Erro ao salvar a cotação: " + (e?.message || e));
    } finally {
      setSalvandoImp(false);
    }
  };

  // =========================================================================
  // FORNECEDORES
  // =========================================================================
  const vazioForn = { nome: "", whatsapp: "", pedidoMinimo: "", diasEntrega: "", obs: "" };
  const [formForn, setFormForn] = useState<typeof vazioForn & { id?: string }>(vazioForn);
  const [abrirFormForn, setAbrirFormForn] = useState(false);

  const salvarFornecedor = async () => {
    if (!formForn.nome.trim()) return;
    const dados = {
      nome: formForn.nome.trim(),
      whatsapp: formForn.whatsapp.trim(),
      pedidoMinimo: parseNumeroBR(formForn.pedidoMinimo) || 0,
      diasEntrega: formForn.diasEntrega.trim(),
      obs: formForn.obs.trim(),
    };
    if (formForn.id) await appDb.update("fornecedores", formForn.id, dados);
    else {
      const novo = await appDb.add("fornecedores", dados);
      if (!impFornecedor) setImpFornecedor(novo.id);
    }
    setFormForn(vazioForn);
    setAbrirFormForn(false);
    setMsg("Fornecedor salvo.");
  };

  const excluirFornecedor = async (f: Fornecedor) => {
    const n = cotacoes.filter(c => c.fornecedorId === f.id).length;
    if (!confirm(`Excluir ${f.nome} e ${n} cotação(ões) dele?`)) return;
    for (const c of cotacoes.filter(c => c.fornecedorId === f.id)) await appDb.delete("cotacoes", c.id!);
    for (const p of produtos.filter(p => (p.fornecedorIds || []).includes(f.id!))) {
      await appDb.update("produtos_compra", p.id!, { fornecedorIds: (p.fornecedorIds || []).filter(x => x !== f.id) });
    }
    await appDb.delete("fornecedores", f.id!);
  };

  const catalogoPorFornecedor = useMemo(() => {
    const m = new Map<string, ProdutoCompra[]>();
    produtos.forEach(p => (p.fornecedorIds || []).forEach(id => {
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(p);
    }));
    m.forEach(l => l.sort((a, b) => a.nome.localeCompare(b.nome)));
    return m;
  }, [produtos]);

  const rankingFornecedor = useMemo(() => {
    const ganha = new Map<string, number>();
    const cotados = new Map<string, number>();
    vigentes.forEach(list => {
      list.forEach(c => cotados.set(c.fornecedorId, (cotados.get(c.fornecedorId) || 0) + 1));
      if (list[0]) ganha.set(list[0].fornecedorId, (ganha.get(list[0].fornecedorId) || 0) + 1);
    });
    return { ganha, cotados };
  }, [vigentes]);

  // =========================================================================
  // PEDIDOS
  // =========================================================================
  const [pedidoAberto, setPedidoAberto] = useState<string | null>(null);

  // =========================================================================
  // RENDER
  // =========================================================================
  const abas: { id: Aba; label: string; icon: any; badge?: number }[] = [
    { id: "lista", label: "Lista de compras", icon: ShoppingCart, badge: lista.length },
    { id: "precos", label: "Preços", icon: Tag, badge: produtos.length },
    { id: "importar", label: "Importar cotação", icon: Upload },
    { id: "fornecedores", label: "Fornecedores", icon: Truck, badge: fornecedores.length },
    { id: "pedidos", label: "Pedidos", icon: History, badge: pedidos.length },
  ];

  const seletorFornecedor = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">Escolha o fornecedor</option>
      {[...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
    </select>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Trophy className="h-7 w-7 text-cyan-400" /> COTAÇÕES & FORNECEDORES
        </h1>
        <p className="text-xs tracking-widest text-slate-500 uppercase mt-1">Cada item no fornecedor mais barato · preço comparado por kg, litro ou unidade</p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-lg p-3">
          <Check className="h-4 w-4" /> {msg}
        </div>
      )}

      <div className="flex overflow-x-auto border-b border-slate-800">
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${aba === a.id ? "border-cyan-500 text-cyan-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <a.icon className="h-4 w-4" /> {a.label}
            {!!a.badge && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full">{a.badge}</span>}
          </button>
        ))}
      </div>

      {/* ============================== LISTA ============================== */}
      {aba === "lista" && (
        <div className="space-y-5">
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-slate-400">Produto</label>
                <input list="produtos-compra" value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && adicionarItem()} placeholder="Comece a digitar..." className={`${inputCls} w-full`} />
                <datalist id="produtos-compra">
                  {produtos.map(p => <option key={p.id} value={p.nome}>{p.unidadeBase}</option>)}
                </datalist>
              </div>
              <div className="w-32">
                <label className="text-[11px] text-slate-400">
                  Quantidade {(() => { const p = produtos.find(p => normalizar(p.nome) === normalizar(novoItemNome)); return p ? `(${p.unidadeBase})` : ""; })()}
                </label>
                <input value={novoItemQtd} onChange={e => setNovoItemQtd(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionarItem()}
                  placeholder="Ex: 5" className={`${inputCls} w-full`} />
              </div>
              <button onClick={adicionarItem} className={btnPrim}><Plus className="h-4 w-4" /> Adicionar</button>
              {requisicoesAprovadas.length > 0 && (
                <button onClick={importarRequisicoes} className={btnSec}>
                  <ClipboardList className="h-4 w-4" /> Puxar {requisicoesAprovadas.length} requisição(ões) aprovada(s)
                </button>
              )}
              {lista.length > 0 && (
                <button onClick={() => confirm("Limpar a lista inteira?") && setLista([])} className={btnSec}><Trash2 className="h-4 w-4" /> Limpar</button>
              )}
            </div>
          </div>

          {lista.length === 0 ? (
            <div className={`${card} p-8 text-center text-sm text-slate-500`}>
              Lista vazia. Adicione itens ou puxe as requisições aprovadas do Ricardo e do Saulo.
              {produtos.length === 0 && <p className="mt-2">Comece importando a Base de Compras em Importar cotação → Base de produtos.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`${card} p-4`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Total do pedido</div>
                  <div className="text-2xl font-bold text-white">{formatBRL(totalPedido)}</div>
                  {totalEstimado > 0 && <div className="text-[11px] text-amber-300">+ {formatBRL(totalEstimado)} estimado (inventário) nos itens sem cotação</div>}
                </div>
                <div className={`${card} p-4`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Economia vs. 2ª melhor opção</div>
                  <div className="text-2xl font-bold text-emerald-400">{formatBRL(economiaTotal)}</div>
                </div>
                <div className={`${card} p-4`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Fornecedores no pedido</div>
                  <div className="text-2xl font-bold text-white">{porFornecedor.length}</div>
                </div>
              </div>

              {semPreco.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Sem preço cotado ({semPreco.length})</p>
                  {semPreco.map(({ item, produto }) => (
                    <div key={item.key} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-white">{item.nome}</span>
                      <span className="text-slate-400 font-mono">{formatQtd(item.qtd)}{produto ? ` ${produto.unidadeBase}` : ""}</span>
                      <span className="text-xs text-slate-500">{produto ? "nenhuma cotação para este produto" : "produto não cadastrado"}</span>
                      {produto && calc.find(c => c.item.key === item.key)?.estimativa && (
                        <span className="text-xs text-amber-300">
                          estimativa {formatBRL(calc.find(c => c.item.key === item.key)!.estimativa!.total)} (inventário{pendencias(produto).some(x => x.tipo === "referencia") ? ", referência suspeita" : ""})
                        </span>
                      )}
                      {produto && nomesCatalogo(produto).length > 0 && (
                        <span className="text-xs text-slate-400">trabalham com isso: {nomesCatalogo(produto).join(", ")}</span>
                      )}
                      {!produto && (
                        <select className={`${inputCls} py-1 text-xs`} value=""
                          onChange={e => {
                            const v = e.target.value;
                            if (v === "__novo__") { setNovoProduto({ nome: item.nome, unidadeBase: "UN", categoria: "" }); setAba("precos"); }
                            else if (v) setLista(l => l.map(i => i.key === item.key ? { ...i, produtoId: v, nome: produtoPorId.get(v)!.nome } : i));
                          }}>
                          <option value="">Ligar a um produto...</option>
                          <option value="__novo__">+ Cadastrar "{item.nome}"</option>
                          {[...produtos].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      )}
                      <button onClick={() => setLista(l => l.filter(i => i.key !== item.key))} className="text-slate-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {pedidosPreco.length > 0 && (
                <div className="bg-sky-500/5 border border-sky-500/30 rounded-xl">
                  <button onClick={() => setMostrarPedirPreco(v => !v)} className="w-full flex justify-between items-center px-4 py-3 text-left">
                    <span className="text-sm font-semibold text-sky-300 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" /> Pedir preço a {pedidosPreco.length} fornecedor(es) sem cotação atual
                    </span>
                    {mostrarPedirPreco ? <ChevronUp className="h-4 w-4 text-sky-300" /> : <ChevronDown className="h-4 w-4 text-sky-300" />}
                  </button>
                  {mostrarPedirPreco && (
                    <div className="px-4 pb-4 space-y-2">
                      <p className="text-[11px] text-slate-400">Fornecedores do catálogo que trabalham com itens desta lista e ainda não mandaram preço (ou o preço tem mais de {DIAS_VALIDADE_COTACAO} dias). Quando responderem, cole a resposta em Importar cotação.</p>
                      {pedidosPreco.map(pp => {
                        const f = fornecedorPorId.get(pp.fid);
                        const texto = mensagemPedidoPreco(nomeForn(pp.fid), pp.itens);
                        return (
                          <div key={pp.fid} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                            <div className="min-w-0">
                              <div className="text-sm text-white">{nomeForn(pp.fid)} <span className="text-slate-500 text-xs">· {pp.itens.length} item(ns)</span></div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[520px]">{pp.itens.map(i => i.nome).join(", ")}</div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => copiar(texto)} className={`${btnSec} text-xs py-1`}><Copy className="h-3.5 w-3.5" /> Copiar</button>
                              {f?.whatsapp && <a href={linkWhatsApp(f.whatsapp, texto)} target="_blank" rel="noreferrer" className={`${btnSec} text-xs py-1`}><Send className="h-3.5 w-3.5" /> WhatsApp</a>}
                              <button onClick={() => { setImpFornecedor(pp.fid); setImpModo("cotacao"); setAba("importar"); }} className={`${btnSec} text-xs py-1`}><Upload className="h-3.5 w-3.5" /> Colar resposta</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {porFornecedor.map(g => {
                const f = fornecedorPorId.get(g.fid);
                const abaixoMinimo = !!f?.pedidoMinimo && g.subtotal < f.pedidoMinimo;
                const texto = mensagemFornecedor(g.fid, g.linhas, g.subtotal);
                return (
                  <div key={g.fid} className={`${card} overflow-hidden`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/40">
                      <div>
                        <div className="text-white font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-cyan-400" /> {nomeForn(g.fid)}</div>
                        <div className="text-xs text-slate-500">
                          {g.linhas.length} item(ns){f?.diasEntrega ? ` · entrega: ${f.diasEntrega}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-white font-mono">{formatBRL(g.subtotal)}</span>
                        <button onClick={() => copiar(texto)} className={btnSec}><Copy className="h-4 w-4" /> Copiar pedido</button>
                        {f?.whatsapp && (
                          <a href={linkWhatsApp(f.whatsapp, texto)} target="_blank" rel="noreferrer" className={btnPrim}><Send className="h-4 w-4" /> WhatsApp</a>
                        )}
                      </div>
                    </div>
                    {abaixoMinimo && (
                      <div className="px-4 py-2 text-xs bg-amber-500/10 text-amber-300 border-b border-amber-500/20">
                        Abaixo do pedido mínimo de {formatBRL(f!.pedidoMinimo!)}. Faltam {formatBRL(f!.pedidoMinimo! - g.subtotal)}: complete o pedido ou mova estes itens para outro fornecedor.
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="text-left px-4 py-2">Item</th>
                            <th className="text-right px-2 py-2">Preciso</th>
                            <th className="text-right px-2 py-2">Comprar</th>
                            <th className="text-right px-2 py-2">R$ / un. base</th>
                            <th className="text-right px-2 py-2">Total</th>
                            <th className="text-left px-2 py-2">Fornecedor</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.linhas.map(({ item, produto, opcoes, escolhida, economia, velha }) => {
                            const o = escolhida!;
                            const base = produto?.unidadeBase || "UN";
                            const naoEhMelhor = o !== opcoes[0];
                            return (
                              <tr key={item.key} className="border-t border-slate-800/60 align-top">
                                <td className="px-4 py-2">
                                  <div className="text-white">{produto?.nome || item.nome}</div>
                                  <div className="text-[11px] text-slate-500">{o.cotacao.descricaoOriginal}</div>
                                  {item.aviso && <div className="text-[11px] text-amber-300">{item.aviso}</div>}
                                  {velha && <div className="text-[11px] text-amber-300">Cotação de {diasDesde(o.cotacao.data)} dias: peça preço novo</div>}
                                  {naoEhMelhor && <div className="text-[11px] text-rose-300">Escolha manual: {formatBRL(o.total - opcoes[0].total)} mais caro que {nomeForn(opcoes[0].cotacao.fornecedorId)}</div>}
                                  {!naoEhMelhor && economia > 0 && <div className="text-[11px] text-emerald-400">Economiza {formatBRL(economia)} vs. 2ª opção</div>}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input defaultValue={formatQtd(item.qtd)} key={item.qtd}
                                    onBlur={e => {
                                      const v = parseNumeroBR(e.target.value);
                                      if (isFinite(v) && v > 0) setLista(l => l.map(i => i.key === item.key ? { ...i, qtd: v } : i));
                                    }}
                                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white text-xs" />
                                  <span className="text-[11px] text-slate-500 ml-1">{base}</span>
                                </td>
                                <td className="px-2 py-2 text-right font-mono text-slate-300 whitespace-nowrap">
                                  {o.embalagens} emb.
                                  {o.sobra > 0.0005 && <div className="text-[10px] text-slate-500">sobra {formatQtd(o.sobra)} {base}</div>}
                                </td>
                                <td className="px-2 py-2 text-right font-mono text-slate-300">{formatBRL(precoPorBase(o.cotacao))}</td>
                                <td className="px-2 py-2 text-right font-mono text-white">{formatBRL(o.total)}</td>
                                <td className="px-2 py-2">
                                  <select value={o.cotacao.fornecedorId}
                                    onChange={e => setLista(l => l.map(i => i.key === item.key ? { ...i, fornecedorFixo: e.target.value === opcoes[0].cotacao.fornecedorId ? undefined : e.target.value } : i))}
                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white max-w-[220px]">
                                    {opcoes.map((op, oi) => (
                                      <option key={op.cotacao.fornecedorId} value={op.cotacao.fornecedorId}>
                                        {oi === 0 ? "★ " : ""}{nomeForn(op.cotacao.fornecedorId)} · {formatBRL(op.total)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-2">
                                  <button onClick={() => setLista(l => l.filter(i => i.key !== item.key))} className="text-slate-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {porFornecedor.length > 0 && (
                <div className={`${card} p-4 flex flex-wrap items-center justify-between gap-3`}>
                  <label className="text-sm text-slate-300 flex items-center gap-2">
                    <input type="checkbox" checked={marcarRequisicoes} onChange={e => setMarcarRequisicoes(e.target.checked)} />
                    Marcar requisições puxadas como "comprado"
                  </label>
                  <button onClick={registrarPedido} disabled={salvandoPedido} className={btnPrim}>
                    <Check className="h-4 w-4" /> {salvandoPedido ? "Registrando..." : "Registrar pedido"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================== PREÇOS ============================== */}
      {aba === "precos" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={buscaPreco} onChange={e => setBuscaPreco(e.target.value)} placeholder="Buscar produto" className={`${inputCls} w-full pl-9`} />
            </div>
            <button onClick={() => setNovoProduto({ nome: "", unidadeBase: "KG", categoria: "" })} className={btnPrim}><Plus className="h-4 w-4" /> Novo produto</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {([["todos", `Todos (${produtos.length})`], ["conferir", `Pendências (${totalConferir})`], ["semcot", "Sem cotação"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFiltroPreco(id)}
                className={`text-xs px-3 py-1.5 rounded-full border ${filtroPreco === id ? "border-cyan-500 text-cyan-300 bg-cyan-500/10" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>{label}</button>
            ))}
          </div>

          {novoProduto && (
            <div className={`${card} p-4 flex flex-wrap gap-2 items-end`}>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-slate-400">Nome</label>
                <input value={novoProduto.nome} onChange={e => setNovoProduto({ ...novoProduto, nome: e.target.value })} className={`${inputCls} w-full`} autoFocus />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Comparar preço por</label>
                <select value={novoProduto.unidadeBase} onChange={e => setNovoProduto({ ...novoProduto, unidadeBase: e.target.value as UnidadeBase })} className={inputCls}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Categoria</label>
                <input value={novoProduto.categoria} onChange={e => setNovoProduto({ ...novoProduto, categoria: e.target.value })} placeholder="Bar, Cozinha..." className={inputCls} />
              </div>
              <button onClick={salvarNovoProduto} className={btnPrim}><Check className="h-4 w-4" /> Salvar</button>
              <button onClick={() => setNovoProduto(null)} className={btnSec}>Cancelar</button>
            </div>
          )}

          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left px-4 py-2">Produto</th>
                  <th className="text-left px-2 py-2">Mais barato</th>
                  <th className="text-right px-2 py-2">Preço</th>
                  <th className="text-left px-2 py-2">2ª opção</th>
                  <th className="text-right px-2 py-2">Referência</th>
                  <th className="text-right px-2 py-2">Cotações</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Nenhum produto. Importe uma cotação ou cadastre manualmente.</td></tr>
                )}
                {produtosFiltrados.map(p => {
                  const v = vigentes.get(p.id!) || [];
                  const melhor = v[0];
                  const seg = v[1];
                  const aberto = produtoAberto === p.id;
                  const pend = pendencias(p);
                  const historico = cotacoes.filter(c => c.produtoId === p.id).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
                  const ligados = (p.fornecedorIds || []).filter(id => fornecedorPorId.has(id));
                  const naoLigados = [...fornecedores].filter(f => !ligados.includes(f.id!)).sort((a, b) => a.nome.localeCompare(b.nome));
                  const selectFornecedor = (cls = "") => (
                    <select value="" onChange={e => e.target.value && atualizarCatalogo(p, [...ligados, e.target.value])}
                      className={`bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 ${cls}`}>
                      <option value="">+ ligar fornecedor</option>
                      {naoLigados.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  );
                  const botoesUnidade = (
                    <div className="inline-flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                      {UNIDADES.map(u => (
                        <button key={u} onClick={() => definirUnidade(p, u)}
                          className={`px-3 py-1 text-xs rounded-md ${p.unidadeBase === u && !pend.some(x => x.tipo === "unidade") ? "bg-cyan-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}>
                          {u === "KG" ? "por KG" : u === "L" ? "por litro" : "por unidade"}
                        </button>
                      ))}
                    </div>
                  );
                  return (
                    <React.Fragment key={p.id}>
                      <tr className={`border-t border-slate-800/60 hover:bg-slate-800/30 cursor-pointer ${aberto ? "bg-slate-800/40" : ""}`} onClick={() => abrirProduto(aberto ? null : p)}>
                        <td className="px-4 py-2">
                          <div className="text-white">{p.nome}</div>
                          <div className="text-[11px] text-slate-500">por {p.unidadeBase}{p.categoria ? ` · ${p.categoria}` : ""}</div>
                          {pend.length > 0 && <div className="text-[10px] text-amber-300 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {pend.length} pendência{pend.length > 1 ? "s" : ""}</div>}
                        </td>
                        <td className="px-2 py-2 text-slate-200">
                          {melhor ? <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-400" />{nomeForn(melhor.fornecedorId)}</span> : <span className="text-slate-500">—</span>}
                          {melhor && diasDesde(melhor.data) > DIAS_VALIDADE_COTACAO && <div className="text-[10px] text-amber-300">{diasDesde(melhor.data)} dias</div>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-400">{melhor ? `${formatBRL(precoPorBase(melhor))}/${p.unidadeBase}` : "—"}</td>
                        <td className="px-2 py-2 text-slate-400 text-xs">
                          {seg ? `${nomeForn(seg.fornecedorId)} · ${formatBRL(precoPorBase(seg))} (+${(((precoPorBase(seg) / precoPorBase(melhor)) - 1) * 100).toFixed(0)}%)` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-500 text-xs">{p.precoReferencia ? `${formatBRL(p.precoReferencia)}/${p.unidadeBase}` : "—"}</td>
                        <td className="px-2 py-2 text-right text-slate-400">{v.length}</td>
                        <td className="px-2 py-2 text-slate-500">{aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                      </tr>
                      {aberto && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={7} className="px-4 py-4 space-y-4" onClick={e => e.stopPropagation()}>

                            {/* ---------- PENDÊNCIAS: cada uma com a correção do lado; somem sozinhas quando resolvidas ---------- */}
                            {pend.length > 0 ? (
                              <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg divide-y divide-amber-500/20">
                                {pend.map((x, i) => (
                                  <div key={i} className="flex flex-wrap items-center gap-3 px-3 py-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                    <span className="text-xs text-amber-100 flex-1 min-w-[200px]">{x.tipo === "referencia" ? "Preço do inventário: " : ""}{x.texto}</span>
                                    {x.tipo === "unidade" && botoesUnidade}
                                    {x.tipo === "fornecedor" && selectFornecedor()}
                                    {x.tipo === "preco" && <span className="text-[11px] text-slate-400">Informe a referência em "Produto" ou lance uma cotação em "Cotações".</span>}
                                    {x.tipo === "referencia" && (
                                      <span className="text-[11px] text-slate-400">Corrija a referência abaixo ou</span>
                                        <button onClick={() => dispensarAviso(p, x.texto)} className={`${btnSec} text-xs py-1`}><Check className="h-3.5 w-3.5" /> Está certo</button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-emerald-400 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Nenhuma pendência</div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* ---------- PRODUTO ---------- */}
                              <div className="space-y-3">
                                <h4 className="text-[11px] uppercase tracking-wide text-slate-500">Produto</h4>
                                <div className="flex flex-wrap gap-2">
                                  <input value={ficha.nome} onChange={e => setFicha({ ...ficha, nome: e.target.value })}
                                    onBlur={() => ficha.nome.trim() && ficha.nome.trim() !== p.nome && appDb.update("produtos_compra", p.id!, { nome: ficha.nome.trim() })}
                                    className={`${inputCls} flex-1 min-w-[200px]`} />
                                  <input value={ficha.categoria} onChange={e => setFicha({ ...ficha, categoria: e.target.value })}
                                    onBlur={() => ficha.categoria !== (p.categoria || "") && appDb.update("produtos_compra", p.id!, { categoria: ficha.categoria.trim() })}
                                    placeholder="Categoria" className={`${inputCls} w-56`} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-slate-400 w-28">Comparar preço</span>
                                  {botoesUnidade}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-slate-400 w-28">Referência</span>
                                  <input value={ficha.refPreco} onChange={e => setFicha({ ...ficha, refPreco: e.target.value })} onBlur={() => salvarReferencia(p)}
                                    placeholder="R$ embalagem" className={`${inputCls} w-28 py-1`} />
                                  <span className="text-xs text-slate-500">por embalagem de</span>
                                  <input value={ficha.refConteudo} onChange={e => setFicha({ ...ficha, refConteudo: e.target.value })} onBlur={() => salvarReferencia(p)}
                                    className={`${inputCls} w-20 py-1`} />
                                  <span className="text-xs text-slate-500">{p.unidadeBase}</span>
                                  {p.precoReferencia ? <span className="text-xs font-mono text-slate-300">= {formatBRL(p.precoReferencia)}/{p.unidadeBase}</span> : null}
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  Referência = preço antigo/estimado ({p.referenciaFonte || "manual"}). Só serve de estimativa; quem decide a compra são as cotações.
                                  {melhor && p.precoReferencia ? (
                                    <span className={precoPorBase(melhor) <= p.precoReferencia ? " text-emerald-400" : " text-amber-300"}>
                                      {" "}Melhor cotação está {Math.abs(((precoPorBase(melhor) / p.precoReferencia) - 1) * 100).toFixed(0)}% {precoPorBase(melhor) <= p.precoReferencia ? "abaixo" : "acima"} da referência.
                                    </span>
                                  ) : null}
                                </p>
                                <button onClick={() => excluirProduto(p)} className="text-xs text-slate-500 hover:text-rose-400 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir produto</button>
                              </div>

                              {/* ---------- FORNECEDORES ---------- */}
                              <div className="space-y-2">
                                <h4 className="text-[11px] uppercase tracking-wide text-slate-500">Fornecedores que trabalham com o produto</h4>
                                {ligados.length === 0 && <p className="text-xs text-slate-500">Nenhum ainda.</p>}
                                {ligados.map(id => {
                                  const c = v.find(x => x.fornecedorId === id);
                                  return (
                                    <div key={id} className="flex items-center gap-2 text-xs border-b border-slate-800/60 pb-1.5">
                                      <span className="text-slate-200 flex-1">{nomeForn(id)}{c && c === melhor ? " ★" : ""}</span>
                                      {c ? (
                                        <span className={`font-mono ${diasDesde(c.data) > DIAS_VALIDADE_COTACAO ? "text-amber-300" : "text-emerald-400"}`}>
                                          {formatBRL(precoPorBase(c))}/{p.unidadeBase} · {new Date(c.data).toLocaleDateString("pt-BR")}
                                        </span>
                                      ) : <span className="text-slate-500">sem preço</span>}
                                      <button onClick={() => atualizarCatalogo(p, ligados.filter(x => x !== id))} className="text-slate-600 hover:text-rose-400" title="Desligar"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                  );
                                })}
                                {selectFornecedor()}
                              </div>
                            </div>

                            {/* ---------- COTAÇÕES ---------- */}
                            <div className="space-y-2 border-t border-slate-800 pt-3">
                              <h4 className="text-[11px] uppercase tracking-wide text-slate-500">Cotações</h4>
                              <div className="flex flex-wrap gap-2 items-end">
                                <div>
                                  <label className="text-[11px] text-slate-400 block">Fornecedor</label>
                                  {seletorFornecedor(cotManual.fornecedorId, v2 => setCotManual({ ...cotManual, fornecedorId: v2 }))}
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-400 block">Preço da embalagem</label>
                                  <input value={cotManual.preco} onChange={e => setCotManual({ ...cotManual, preco: e.target.value })} placeholder="0,00" className={`${inputCls} w-28`} />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-400 block">{p.unidadeBase} na embalagem</label>
                                  <input value={cotManual.conteudo} onChange={e => setCotManual({ ...cotManual, conteudo: e.target.value })} className={`${inputCls} w-24`} />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-400 block">Data</label>
                                  <input type="date" value={cotManual.data} onChange={e => setCotManual({ ...cotManual, data: e.target.value })} className={inputCls} />
                                </div>
                                <button onClick={() => salvarCotacaoManual(p.id!)} className={btnPrim}><Plus className="h-4 w-4" /> Adicionar preço</button>
                              </div>
                              {historico.length === 0 ? (
                                <p className="text-xs text-slate-500">Nenhuma cotação ainda.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="text-slate-500">
                                    <tr>
                                      <th className="text-left py-1">Data</th>
                                      <th className="text-left py-1">Fornecedor</th>
                                      <th className="text-left py-1">Descrição</th>
                                      <th className="text-right py-1">Embalagem</th>
                                      <th className="text-right py-1">Preço</th>
                                      <th className="text-right py-1">R$/{p.unidadeBase}</th>
                                      <th className="text-left py-1 pl-2">Origem</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historico.map(c => {
                                      const vigente = v.includes(c);
                                      return (
                                        <tr key={c.id} className={`border-t border-slate-800/60 ${vigente ? "" : "text-slate-500"}`}>
                                          <td className="py-1">{new Date(c.data).toLocaleDateString("pt-BR")}</td>
                                          <td className="py-1">{nomeForn(c.fornecedorId)}{vigente && c === melhor ? " ★" : ""}</td>
                                          <td className="py-1">{c.descricaoOriginal}</td>
                                          <td className="py-1 text-right font-mono">{formatQtd(c.conteudo)} {p.unidadeBase}</td>
                                          <td className="py-1 text-right font-mono">{formatBRL(c.preco)}</td>
                                          <td className="py-1 text-right font-mono">{formatBRL(precoPorBase(c))}</td>
                                          <td className="py-1 pl-2">{ORIGENS.find(o => o.id === c.origem)?.label || c.origem}{vigente ? "" : " (antiga)"}</td>
                                          <td className="py-1 text-right">
                                            <button onClick={() => appDb.delete("cotacoes", c.id!)} className="text-slate-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================== IMPORTAR ============================== */}
      {aba === "importar" && (
        <div className="space-y-4">
          <div className="inline-flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button onClick={() => setImpModo("cotacao")} className={`px-3 py-1.5 text-sm rounded-md ${impModo === "cotacao" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Cotação de fornecedor</button>
            <button onClick={() => setImpModo("catalogo")} className={`px-3 py-1.5 text-sm rounded-md ${impModo === "catalogo" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Catálogo sem preço</button>
            <button onClick={() => setImpModo("base")} className={`px-3 py-1.5 text-sm rounded-md ${impModo === "base" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Base de produtos (inventário)</button>
          </div>

          {impModo === "catalogo" && (
            <div className={`${card} p-4 space-y-3`}>
              <div>
                <h3 className="text-white font-semibold">Catálogo sem preço</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cole o texto do catálogo (no PDF: selecionar tudo e copiar). O sistema encontra os produtos da sua base que o fornecedor trabalha.
                  Depois é só usar "Pedir preço" na lista de compras ou "Pedir tabela de preços" no cartão do fornecedor.
                </p>
              </div>
              {!catRevisao ? (
                <>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div>
                      <label className="text-[11px] text-slate-400 block">Fornecedor</label>
                      {seletorFornecedor(impFornecedor, setImpFornecedor)}
                    </div>
                  </div>
                  <textarea value={catTexto} onChange={e => setCatTexto(e.target.value)} rows={10}
                    placeholder={"Ex.:\nAzeitonas verde e Preta\nEm Conservas: Palmito, Cogumelos, Pepininho, Cebolinha\nTirolez: requeijão cremoso, cheddar, parmesão, mussarela"}
                    className={`${inputCls} w-full font-mono text-xs`} />
                  <div className="flex justify-end">
                    <button onClick={lerCatalogo} disabled={!catTexto.trim()} className={btnPrim}><Search className="h-4 w-4" /> Encontrar produtos</button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <p className="text-sm text-slate-300">
                      {catRevisao.filter(r => r.marcado).length} de {catRevisao.length} produto(s) marcados para <strong className="text-white">{nomeForn(impFornecedor)}</strong>.
                      <span className="text-xs text-slate-500"> Desmarque o que ele não vende.</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setCatRevisao(null)} className={btnSec}>Voltar</button>
                      <button onClick={salvarCatalogo} disabled={salvandoCat} className={btnPrim}><Check className="h-4 w-4" /> {salvandoCat ? "Salvando..." : "Salvar catálogo"}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500 border-b border-slate-800">
                        <tr><th className="py-2"></th><th className="text-left py-2 pr-2">Produto</th><th className="text-left py-2 pr-2">Categoria</th><th className="text-left py-2 pr-2">Encontrado por</th><th className="text-left py-2">Outros fornecedores</th></tr>
                      </thead>
                      <tbody>
                        {catRevisao.map((r, i) => (
                          <tr key={r.produto.id} className={`border-t border-slate-800/60 ${r.marcado ? "" : "opacity-50"}`}>
                            <td className="py-1.5 pr-2">
                              <input type="checkbox" checked={r.marcado} onChange={e => { const v = e.target.checked; setCatRevisao(c => c && c.map((x, k) => k === i ? { ...x, marcado: v } : x)); }} />
                            </td>
                            <td className="py-1.5 pr-2 text-slate-200">{r.produto.nome}{r.jaTem && <span className="text-emerald-400"> · já estava</span>}</td>
                            <td className="py-1.5 pr-2 text-slate-500">{r.produto.categoria}</td>
                            <td className="py-1.5 pr-2 text-slate-400">{r.termos.join(", ")}</td>
                            <td className="py-1.5 text-slate-500">{nomesCatalogo(r.produto).filter(n => n !== nomeForn(impFornecedor)).join(", ") || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {impModo === "base" && (
            <div className={`${card} p-4 space-y-4`}>
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-cyan-400" /> Importar base de produtos</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cria os produtos, os fornecedores e quem trabalha com cada item. O preço do inventário entra como <strong>referência</strong>:
                  serve de estimativa e comparação, mas não é cotação. Importar de novo atualiza sem duplicar.
                </p>
              </div>
              {!baseLida ? (
                <label className={`${btnPrim} cursor-pointer w-fit`}>
                  <FileSpreadsheet className="h-4 w-4" /> Escolher planilha Base de Compras (.xlsx)
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivoBase(f); e.target.value = ""; }} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-slate-300">{baseLida.arquivo}</div>
                  {resumoBase && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[["Produtos novos", resumoBase.novos, "text-white"], ["Já cadastrados", resumoBase.existentes, "text-white"], ["Para conferir", resumoBase.conferir, "text-amber-300"], ["Fornecedores novos", resumoBase.fornNovos, "text-white"]].map(([l, n, c]) => (
                        <div key={l as string} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                          <div className={`text-2xl font-bold ${c}`}>{n as number}</div>
                          <div className="text-[11px] uppercase text-slate-500">{l as string}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!resumoBase?.existentes && (
                    <label className="text-sm text-slate-300 flex items-center gap-2">
                      <input type="checkbox" checked={baseAtualizar} onChange={e => setBaseAtualizar(e.target.checked)} />
                      Atualizar referência, categoria e catálogo dos produtos que já existem
                    </label>
                  )}
                  <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={() => setBaseLida(null)} disabled={importandoBase} className={btnSec}>Cancelar</button>
                    <button onClick={importarBase} disabled={importandoBase} className={btnPrim}><Check className="h-4 w-4" /> {importandoBase ? "Importando..." : "Importar"}</button>
                    {baseProgresso && <span className="text-xs text-slate-400">{baseProgresso}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {impModo === "cotacao" && (!revisao ? (
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 block">Fornecedor</label>
                  <div className="flex gap-2">
                    {seletorFornecedor(impFornecedor, setImpFornecedor)}
                    <button onClick={() => { setAba("fornecedores"); setAbrirFormForn(true); }} className={btnSec} title="Cadastrar fornecedor"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block">Veio por</label>
                  <select value={impOrigem} onChange={e => setImpOrigem(e.target.value as OrigemCotacao)} className={inputCls}>
                    {ORIGENS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block">Data da cotação</label>
                  <input type="date" value={impData} onChange={e => setImpData(e.target.value)} className={inputCls} />
                </div>
                <label className={`${btnSec} cursor-pointer`}>
                  <FileSpreadsheet className="h-4 w-4" /> Abrir planilha (.xlsx / .csv)
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); e.target.value = ""; }} />
                </label>
              </div>
              <textarea value={impTexto} onChange={e => setImpTexto(e.target.value)} rows={12}
                placeholder={"Cole aqui a mensagem do WhatsApp, o texto copiado do PDF ou do site.\n\nExemplo:\nCamarão cinza 36/40 R$ 64,90 o kg\nCoca-Cola lata 350ml cx c/12 R$ 38,00\nEspumante Brut 660ml 25,00"}
                className={`${inputCls} w-full font-mono text-xs`} />
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <p className="text-[11px] text-slate-500">Cada linha com produto e preço vira uma cotação. Você revisa tudo antes de salvar.</p>
                <button onClick={montarRevisao} disabled={!impTexto.trim()} className={btnPrim}><Search className="h-4 w-4" /> Ler cotação</button>
              </div>
            </div>
          ) : (
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-white font-semibold">Revisar {revisao.filter(r => r.incluir).length} de {revisao.length} linha(s)</h3>
                  <p className="text-xs text-slate-400">
                    Confira o produto e quantas unidades vêm na embalagem. Linha em amarelo = conferir. O sistema aprende o nome usado pelo fornecedor.
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {seletorFornecedor(impFornecedor, setImpFornecedor)}
                  <button onClick={() => setRevisao(null)} className={btnSec}>Voltar</button>
                  <button onClick={salvarImportacao} disabled={salvandoImp || !impFornecedor} className={btnPrim}>
                    <Check className="h-4 w-4" /> {salvandoImp ? "Salvando..." : "Salvar preços"}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2"></th>
                      <th className="text-left py-2 pr-2">Como veio</th>
                      <th className="text-right py-2 pr-2">Preço</th>
                      <th className="text-left py-2 pr-2">Produto</th>
                      <th className="text-right py-2 pr-2">Qtd na embalagem</th>
                      <th className="text-right py-2 pr-2">R$ / un. base</th>
                      <th className="text-left py-2">Comparação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisao.map((r, i) => {
                      const base: UnidadeBase = r.produtoId === "__novo__" ? r.novaUnidade : (produtoPorId.get(r.produtoId)?.unidadeBase || "UN");
                      const cont = parseNumeroBR(r.conteudo);
                      const unit = isFinite(cont) && cont > 0 ? r.preco / cont : NaN;
                      const atual = r.produtoId !== "__novo__" ? (vigentes.get(r.produtoId) || []).filter(c => c.fornecedorId !== impFornecedor)[0] : undefined;
                      const atualUnit = atual ? precoPorBase(atual) : NaN;
                      const conferir = !r.conteudoOk || r.aproximado;
                      return (
                        <tr key={i} className={`border-t border-slate-800/60 align-top ${!r.incluir ? "opacity-40" : conferir ? "bg-amber-500/5" : ""}`}>
                          <td className="py-2 pr-2"><input type="checkbox" checked={r.incluir} onChange={e => atualizarRevisao(i, { incluir: e.target.checked })} /></td>
                          <td className="py-2 pr-2 text-slate-200 max-w-[220px]">{r.descricao}</td>
                          <td className="py-2 pr-2 text-right font-mono text-white">{formatBRL(r.preco)}</td>
                          <td className="py-2 pr-2 space-y-1 min-w-[220px]">
                            <select value={r.produtoId} onChange={e => atualizarRevisao(i, { produtoId: e.target.value })}
                              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-full">
                              <option value="__novo__">+ Novo produto</option>
                              {[...produtos].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidadeBase})</option>)}
                            </select>
                            {r.produtoId === "__novo__" && (
                              <div className="flex gap-1">
                                <input value={r.novoNome} onChange={e => atualizarRevisao(i, { novoNome: e.target.value })}
                                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                                <select value={r.novaUnidade} onChange={e => atualizarRevisao(i, { novaUnidade: e.target.value as UnidadeBase })}
                                  className="bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white">
                                  {UNIDADES.map(u => <option key={u} value={u}>por {u}</option>)}
                                </select>
                              </div>
                            )}
                            {r.aproximado && <div className="text-amber-300">Nome parecido: confirme se é o mesmo produto</div>}
                          </td>
                          <td className="py-2 pr-2 text-right whitespace-nowrap">
                            <input value={r.conteudo} onChange={e => atualizarRevisao(i, { conteudo: e.target.value })}
                              className={`w-20 bg-slate-800 border rounded px-2 py-1 text-right font-mono text-white ${r.conteudoOk ? "border-slate-700" : "border-amber-500"}`} />
                            <span className="text-slate-500 ml-1">{base}</span>
                            {!r.conteudoOk && <div className="text-amber-300">conferir</div>}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-emerald-400">{isFinite(unit) ? formatBRL(unit) : "—"}</td>
                          <td className="py-2 whitespace-nowrap">
                            {atual && isFinite(unit) ? (
                              unit < atualUnit
                                ? <span className="text-emerald-400">Mais barato que {nomeForn(atual.fornecedorId)} ({(((atualUnit / unit) - 1) * 100).toFixed(0)}%)</span>
                                : <span className="text-slate-400">{(((unit / atualUnit) - 1) * 100).toFixed(0)}% mais caro que {nomeForn(atual.fornecedorId)} ({formatBRL(atualUnit)})</span>
                            ) : <span className="text-slate-600">sem outra cotação</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================== FORNECEDORES ============================== */}
      {aba === "fornecedores" && (
        <div className="space-y-4">
          {!abrirFormForn && (
            <button onClick={() => { setFormForn(vazioForn); setAbrirFormForn(true); }} className={btnPrim}><Plus className="h-4 w-4" /> Novo fornecedor</button>
          )}
          {abrirFormForn && (
            <div className={`${card} p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end`}>
              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400 block">Nome</label>
                <input value={formForn.nome} onChange={e => setFormForn({ ...formForn, nome: e.target.value })} className={`${inputCls} w-full`} autoFocus />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">WhatsApp</label>
                <input value={formForn.whatsapp} onChange={e => setFormForn({ ...formForn, whatsapp: e.target.value })} placeholder="(83) 99999-0000" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Pedido mínimo (R$)</label>
                <input value={formForn.pedidoMinimo} onChange={e => setFormForn({ ...formForn, pedidoMinimo: e.target.value })} placeholder="0" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Entrega</label>
                <input value={formForn.diasEntrega} onChange={e => setFormForn({ ...formForn, diasEntrega: e.target.value })} placeholder="ter e sex" className={`${inputCls} w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="text-[11px] text-slate-400 block">Observações</label>
                <input value={formForn.obs} onChange={e => setFormForn({ ...formForn, obs: e.target.value })} placeholder="Prazo de pagamento, contato, etc." className={`${inputCls} w-full`} />
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end">
                <button onClick={() => setAbrirFormForn(false)} className={btnSec}>Cancelar</button>
                <button onClick={salvarFornecedor} className={btnPrim}><Check className="h-4 w-4" /> Salvar</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...fornecedores].sort((a, b) => (rankingFornecedor.ganha.get(b.id!) || 0) - (rankingFornecedor.ganha.get(a.id!) || 0) || (catalogoPorFornecedor.get(b.id!)?.length || 0) - (catalogoPorFornecedor.get(a.id!)?.length || 0)).map(f => (
              <div key={f.id} className={`${card} p-4 space-y-2`}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-white font-semibold">{f.nome}</div>
                    <div className="text-xs text-slate-500">{f.whatsapp || "sem WhatsApp"}{f.diasEntrega ? ` · ${f.diasEntrega}` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setFormForn({ id: f.id, nome: f.nome, whatsapp: f.whatsapp || "", pedidoMinimo: f.pedidoMinimo ? String(f.pedidoMinimo).replace(".", ",") : "", diasEntrega: f.diasEntrega || "", obs: f.obs || "" }); setAbrirFormForn(true); }}
                      className="text-slate-500 hover:text-white p-1"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => excluirFornecedor(f)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs flex-wrap">
                  <span><strong className="text-emerald-400 text-base">{rankingFornecedor.ganha.get(f.id!) || 0}</strong> mais barato</span>
                  <span><strong className="text-white text-base">{rankingFornecedor.cotados.get(f.id!) || 0}</strong> cotados</span>
                  <span><strong className="text-white text-base">{catalogoPorFornecedor.get(f.id!)?.length || 0}</strong> no catálogo</span>
                  {!!f.pedidoMinimo && <span>mín. {formatBRL(f.pedidoMinimo)}</span>}
                </div>
                {f.obs && <p className="text-xs text-slate-400">{f.obs}</p>}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { setImpFornecedor(f.id!); setImpModo("cotacao"); setAba("importar"); }} className={`${btnSec} text-xs py-1`}><Upload className="h-3.5 w-3.5" /> Importar cotação</button>
                  {!!catalogoPorFornecedor.get(f.id!)?.length && (() => {
                    const texto = mensagemPedidoPreco(f.nome, catalogoPorFornecedor.get(f.id!)!.map(p => ({ nome: p.nome })));
                    return (
                      <>
                        <button onClick={() => copiar(texto)} className={`${btnSec} text-xs py-1`} title="Mensagem pedindo o preço de todos os produtos do catálogo"><Copy className="h-3.5 w-3.5" /> Pedir tabela de preços</button>
                        {f.whatsapp && <a href={linkWhatsApp(f.whatsapp, texto)} target="_blank" rel="noreferrer" className={`${btnSec} text-xs py-1`}><Send className="h-3.5 w-3.5" /></a>}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
            {fornecedores.length === 0 && <div className="text-sm text-slate-500">Nenhum fornecedor cadastrado.</div>}
          </div>
        </div>
      )}

      {/* ============================== PEDIDOS ============================== */}
      {aba === "pedidos" && (
        <div className="space-y-3">
          {pedidos.length === 0 && <div className={`${card} p-8 text-center text-sm text-slate-500`}>Nenhum pedido registrado ainda.</div>}
          {pedidos.map(p => {
            const aberto = pedidoAberto === p.id;
            const forns = Array.from(new Set(p.itens.map(i => i.fornecedorNome)));
            return (
              <div key={p.id} className={card}>
                <button onClick={() => setPedidoAberto(aberto ? null : p.id!)} className="w-full flex flex-wrap justify-between items-center gap-2 px-4 py-3 text-left">
                  <div>
                    <div className="text-white font-semibold">{new Date(p.data).toLocaleDateString("pt-BR")} · {formatBRL(p.total)}</div>
                    <div className="text-xs text-slate-500">{p.itens.length} itens · {forns.join(", ")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.economia > 0 && <span className="text-xs text-emerald-400">economizou {formatBRL(p.economia)}</span>}
                    {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {aberto && (
                  <div className="px-4 pb-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500"><tr><th className="text-left py-1">Item</th><th className="text-left py-1">Fornecedor</th><th className="text-right py-1">Emb.</th><th className="text-right py-1">Preço</th><th className="text-right py-1">Total</th></tr></thead>
                      <tbody>
                        {p.itens.map((i, k) => (
                          <tr key={k} className="border-t border-slate-800/60">
                            <td className="py-1 text-slate-200">{i.nome}</td>
                            <td className="py-1">{i.fornecedorNome}</td>
                            <td className="py-1 text-right font-mono">{i.embalagens}</td>
                            <td className="py-1 text-right font-mono">{formatBRL(i.precoEmbalagem)}</td>
                            <td className="py-1 text-right font-mono text-white">{formatBRL(i.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => confirm("Excluir este pedido do histórico?") && appDb.delete("pedidos_compra", p.id!)} className="text-xs text-slate-500 hover:text-rose-400 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
