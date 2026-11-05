import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import {
  ShoppingCart, Truck, Upload, Tag, History, Plus, Trash2, Search, AlertTriangle,
  Check, X, Copy, Send, Trophy, Pencil, ChevronDown, ChevronUp, ClipboardList, FileSpreadsheet
} from "lucide-react";
import {
  Fornecedor, ProdutoCompra, Cotacao, UnidadeBase, OrigemCotacao, DIAS_VALIDADE_COTACAO,
  normalizar, parseNumeroBR, formatBRL, formatQtd, lerCotacaoTexto, linhasPlanilhaParaTexto,
  sugerirUnidadeBase, conteudoPara, casarProduto, precoPorBase, diasDesde, cotacoesVigentes,
  opcoesParaQuantidade, linkWhatsApp, DeteccaoEmbalagem, OpcaoCompra
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
  }

  const calc: LinhaCalc[] = useMemo(() => lista.map(item => {
    const produto = item.produtoId ? produtoPorId.get(item.produtoId) : undefined;
    const opcoes = produto ? opcoesParaQuantidade(item.qtd, vigentes.get(produto.id!) || []) : [];
    const escolhida = (item.fornecedorFixo && opcoes.find(o => o.cotacao.fornecedorId === item.fornecedorFixo)) || opcoes[0];
    const melhor = opcoes[0];
    const segunda = opcoes.find(o => o !== melhor);
    const economia = escolhida && escolhida === melhor && segunda ? segunda.total - melhor.total : 0;
    const velha = !!escolhida && diasDesde(escolhida.cotacao.data) > DIAS_VALIDADE_COTACAO;
    return { item, produto, opcoes, escolhida, economia, velha };
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
  const totalPedido = porFornecedor.reduce((s, g) => s + g.subtotal, 0);
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
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null);
  const [novoProduto, setNovoProduto] = useState<{ nome: string; unidadeBase: UnidadeBase; categoria: string } | null>(null);
  const [editProduto, setEditProduto] = useState<ProdutoCompra | null>(null);
  const [cotManual, setCotManual] = useState({ fornecedorId: "", preco: "", conteudo: "1", descricao: "", data: hojeISO() });

  const produtosFiltrados = useMemo(() => {
    const q = normalizar(buscaPreco);
    return [...produtos]
      .filter(p => !q || normalizar(p.nome).includes(q) || normalizar(p.categoria || "").includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos, buscaPreco]);

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

  const salvarEdicaoProduto = async () => {
    if (!editProduto?.id) return;
    await appDb.update("produtos_compra", editProduto.id, { nome: editProduto.nome.trim(), unidadeBase: editProduto.unidadeBase, categoria: editProduto.categoria || "" });
    setEditProduto(null);
  };

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
    await appDb.delete("fornecedores", f.id!);
  };

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
              {cotacoes.length === 0 && <p className="mt-2">Antes, cadastre fornecedores e importe as primeiras cotações.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`${card} p-4`}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Total do pedido</div>
                  <div className="text-2xl font-bold text-white">{formatBRL(totalPedido)}</div>
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
                  <th className="text-right px-2 py-2">Cotações</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum produto. Importe uma cotação ou cadastre manualmente.</td></tr>
                )}
                {produtosFiltrados.map(p => {
                  const v = vigentes.get(p.id!) || [];
                  const melhor = v[0];
                  const seg = v[1];
                  const aberto = produtoAberto === p.id;
                  const historico = cotacoes.filter(c => c.produtoId === p.id).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-t border-slate-800/60 hover:bg-slate-800/30 cursor-pointer" onClick={() => setProdutoAberto(aberto ? null : p.id!)}>
                        <td className="px-4 py-2">
                          <div className="text-white">{p.nome}</div>
                          <div className="text-[11px] text-slate-500">por {p.unidadeBase}{p.categoria ? ` · ${p.categoria}` : ""}</div>
                        </td>
                        <td className="px-2 py-2 text-slate-200">
                          {melhor ? <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-400" />{nomeForn(melhor.fornecedorId)}</span> : <span className="text-slate-500">—</span>}
                          {melhor && diasDesde(melhor.data) > DIAS_VALIDADE_COTACAO && <div className="text-[10px] text-amber-300">{diasDesde(melhor.data)} dias</div>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-400">{melhor ? `${formatBRL(precoPorBase(melhor))}/${p.unidadeBase}` : "—"}</td>
                        <td className="px-2 py-2 text-slate-400 text-xs">
                          {seg ? `${nomeForn(seg.fornecedorId)} · ${formatBRL(precoPorBase(seg))} (+${(((precoPorBase(seg) / precoPorBase(melhor)) - 1) * 100).toFixed(0)}%)` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-400">{v.length}</td>
                        <td className="px-2 py-2 text-slate-500">{aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                      </tr>
                      {aberto && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={6} className="px-4 py-4 space-y-4">
                            {editProduto?.id === p.id ? (
                              <div className="flex flex-wrap gap-2 items-end">
                                <input value={editProduto?.nome || ""} onChange={e => { const v = e.target.value; setEditProduto(ep => ep && { ...ep, nome: v }); }} className={`${inputCls} flex-1 min-w-[200px]`} />
                                <select value={editProduto?.unidadeBase || "UN"} onChange={e => { const v = e.target.value as UnidadeBase; setEditProduto(ep => ep && { ...ep, unidadeBase: v }); }} className={inputCls}>
                                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <input value={editProduto?.categoria || ""} onChange={e => { const v = e.target.value; setEditProduto(ep => ep && { ...ep, categoria: v }); }} placeholder="Categoria" className={inputCls} />
                                <button onClick={salvarEdicaoProduto} className={btnPrim}><Check className="h-4 w-4" /> Salvar</button>
                                <button onClick={() => setEditProduto(null)} className={btnSec}>Cancelar</button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => setEditProduto({ ...p })} className={btnSec}><Pencil className="h-4 w-4" /> Editar produto</button>
                                <button onClick={() => excluirProduto(p)} className={`${btnSec} hover:text-rose-400`}><Trash2 className="h-4 w-4" /> Excluir</button>
                              </div>
                            )}
                            {editProduto?.id === p.id && editProduto?.unidadeBase !== p.unidadeBase && (
                              <p className="text-xs text-amber-300">Mudar a unidade não converte as cotações antigas: confira o conteúdo de cada uma no histórico.</p>
                            )}

                            <div className="flex flex-wrap gap-2 items-end">
                              <div>
                                <label className="text-[11px] text-slate-400 block">Fornecedor</label>
                                {seletorFornecedor(cotManual.fornecedorId, v2 => setCotManual({ ...cotManual, fornecedorId: v2 }))}
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block">Preço da embalagem</label>
                                <input value={cotManual.preco} onChange={e => setCotManual({ ...cotManual, preco: e.target.value })} placeholder="25,00" className={`${inputCls} w-28`} />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block">{p.unidadeBase} na embalagem</label>
                                <input value={cotManual.conteudo} onChange={e => setCotManual({ ...cotManual, conteudo: e.target.value })} placeholder={p.unidadeBase === "L" ? "0,66" : "1"} className={`${inputCls} w-24`} />
                              </div>
                              <div className="flex-1 min-w-[160px]">
                                <label className="text-[11px] text-slate-400 block">Descrição (como o fornecedor chama)</label>
                                <input value={cotManual.descricao} onChange={e => setCotManual({ ...cotManual, descricao: e.target.value })} className={`${inputCls} w-full`} />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block">Data</label>
                                <input type="date" value={cotManual.data} onChange={e => setCotManual({ ...cotManual, data: e.target.value })} className={inputCls} />
                              </div>
                              <button onClick={() => salvarCotacaoManual(p.id!)} className={btnPrim}><Plus className="h-4 w-4" /> Adicionar preço</button>
                            </div>

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
          {!revisao ? (
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
          )}
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
            {[...fornecedores].sort((a, b) => (rankingFornecedor.ganha.get(b.id!) || 0) - (rankingFornecedor.ganha.get(a.id!) || 0)).map(f => (
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
                <div className="flex gap-4 text-xs">
                  <span><strong className="text-emerald-400 text-base">{rankingFornecedor.ganha.get(f.id!) || 0}</strong> mais barato</span>
                  <span><strong className="text-white text-base">{rankingFornecedor.cotados.get(f.id!) || 0}</strong> cotados</span>
                  {!!f.pedidoMinimo && <span>mín. {formatBRL(f.pedidoMinimo)}</span>}
                </div>
                {f.obs && <p className="text-xs text-slate-400">{f.obs}</p>}
                <button onClick={() => { setImpFornecedor(f.id!); setAba("importar"); }} className={`${btnSec} text-xs py-1`}><Upload className="h-3.5 w-3.5" /> Importar cotação</button>
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
