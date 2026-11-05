// ---------------------------------------------------------------------------
// Cotações & Fornecedores: lógica pura (sem React), testável isoladamente.
// ---------------------------------------------------------------------------

export type UnidadeBase = 'KG' | 'L' | 'UN';
export type OrigemCotacao = 'whatsapp' | 'pdf' | 'planilha' | 'site' | 'manual';

export interface Fornecedor {
  id?: string;
  nome: string;
  whatsapp?: string;
  pedidoMinimo?: number;
  diasEntrega?: string;
  obs?: string;
  createdAt?: string;
}

export interface ProdutoCompra {
  id?: string;
  nome: string;
  unidadeBase: UnidadeBase;
  categoria?: string;
  aliases?: string[]; // nomes normalizados que já foram ligados a este produto em cotações
  createdAt?: string;
}

export interface Cotacao {
  id?: string;
  produtoId: string;
  fornecedorId: string;
  preco: number;          // preço da embalagem cotada
  conteudo: number;       // quantas unidades-base vêm na embalagem (ex.: 0,66 L; 5 KG; 12 UN)
  descricaoOriginal?: string;
  origem: OrigemCotacao;
  data: string;           // ISO da cotação
  createdAt?: string;
}

export const DIAS_VALIDADE_COTACAO = 30;

export const normalizar = (s: string): string =>
  (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// "1.234,56" | "1234.56" | "25" -> número
export const parseNumeroBR = (v: string | number | undefined | null): number => {
  if (v === undefined || v === null) return NaN;
  if (typeof v === 'number') return v;
  let s = v.toString().trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
};

export const formatBRL = (n: number): string =>
  isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export const formatQtd = (n: number): string =>
  isFinite(n) ? Number(n.toFixed(3)).toLocaleString('pt-BR') : '—';

// ---------------------------------------------------------------------------
// Leitura de embalagem a partir da descrição
// ---------------------------------------------------------------------------
export interface DeteccaoEmbalagem {
  massaKg?: number;    // massa total da embalagem
  volumeL?: number;    // volume total da embalagem
  contagem?: number;   // quantas unidades (latas, garrafas, peças) na embalagem
  porUnidadeHint?: UnidadeBase; // preço explicitamente "por kg", "por litro" ou "por unidade"
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

export const detectarEmbalagem = (descricao: string): DeteccaoEmbalagem => {
  const s = ' ' + (descricao || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ';
  const d: DeteccaoEmbalagem = {};

  // "por kg", "/kg", "o kg", "kg:" (preço por quilo)
  if (/(\/|\bpor\b|\bo\b)\s*(kg|quilo)\b/.test(s)) d.porUnidadeHint = 'KG';
  else if (/(\/|\bpor\b|\bo\b)\s*(l|lt|litro)\b/.test(s)) d.porUnidadeHint = 'L';
  else if (/(\/|\bpor\b|\ba\b)\s*(un|und|unid|unidade)\b/.test(s)) d.porUnidadeHint = 'UN';

  // multipack: "12x350ml", "6 x 1,5l", "cx 24x200g"
  const multi = s.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|l|lt|g|gr|kg)\b/);
  let n: number | undefined;
  let unitVal: number | undefined;
  let unit: string | undefined;
  if (multi) {
    n = parseInt(multi[1], 10);
    unitVal = num(multi[2]);
    unit = multi[3];
  } else {
    const cont = s.match(/\b(?:c\/|com|cx|caixa|fd|fardo|pct|pacote|pack|kit)\s*(\d+)\s*(?:un|und|unid|unidades|latas?|garrafas?|pcs?|pecas?)?\b/)
      || s.match(/\b(\d+)\s*(?:un|und|unid|unidades|latas|garrafas)\b/);
    if (cont) n = parseInt(cont[1], 10);
    const vol = s.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|lts|litros?)\b/);
    const mas = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs)\b/);
    if (vol) { unitVal = num(vol[1]); unit = vol[2]; }
    else if (mas) { unitVal = num(mas[1]); unit = mas[2]; }
  }

  if (n && n > 0) d.contagem = n;
  if (unitVal && unit) {
    const mult = n && n > 0 ? n : 1;
    if (unit === 'ml') d.volumeL = (unitVal / 1000) * mult;
    else if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unit)) d.volumeL = unitVal * mult;
    else if (['g', 'gr', 'grs'].includes(unit)) d.massaKg = (unitVal / 1000) * mult;
    else if (['kg', 'kgs'].includes(unit)) d.massaKg = unitVal * mult;
  }
  return d;
};

// Unidade-base sugerida para um produto novo a partir da descrição
export const sugerirUnidadeBase = (d: DeteccaoEmbalagem): UnidadeBase => {
  if (d.porUnidadeHint) return d.porUnidadeHint;
  if (d.massaKg && !d.contagem) return 'KG';
  if (d.volumeL && !d.contagem) return 'L';
  return 'UN';
};

// Quantas unidades-base do produto vêm nessa embalagem. ok=false quando não dá para saber.
export const conteudoPara = (base: UnidadeBase, d: DeteccaoEmbalagem): { conteudo: number; ok: boolean } => {
  if (d.porUnidadeHint === base) return { conteudo: 1, ok: true };
  if (base === 'KG') return d.massaKg ? { conteudo: d.massaKg, ok: true } : { conteudo: 1, ok: !d.contagem && !d.volumeL };
  if (base === 'L') return d.volumeL ? { conteudo: d.volumeL, ok: true } : { conteudo: 1, ok: !d.contagem && !d.massaKg };
  // UN
  if (d.contagem) return { conteudo: d.contagem, ok: true };
  return { conteudo: 1, ok: true };
};

// ---------------------------------------------------------------------------
// Leitor de cotação colada (WhatsApp, texto copiado de PDF, linhas de planilha)
// ---------------------------------------------------------------------------
export interface LinhaCotacao {
  raw: string;
  nome: string;
  preco: number;
  deteccao: DeteccaoEmbalagem;
}

// Preço = número com 2 casas decimais (25,90 | 1.234,56 | 25.90) ou "R$ 25"
const RE_PRECO = /(?:r\$\s*)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?![\d.,]*\s*(?:x\b|ml\b|l\b|lt\b|kg\b|g\b|gr\b|un\b|und\b|%))/gi;

export const lerCotacaoTexto = (texto: string): LinhaCotacao[] => {
  const linhas = (texto || '').split(/\r?\n/);
  const out: LinhaCotacao[] = [];
  for (const rawLine of linhas) {
    const raw = rawLine.trim();
    if (!raw) continue;
    // ignora cabeçalhos típicos de WhatsApp "[05/11 10:22] Fulano:"
    const semCabecalho = raw.replace(/^\[[^\]]*\]\s*[^:]{1,40}:\s*/, '');

    // Caso especial: preço no fim da linha seguido da unidade ("89,90 kg", "12,50/un")
    const fim = semCabecalho.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*\/?\s*(kg|quilo|l|lt|litro|un|und|unid|unidade)\.?\s*$/i);
    let preco: number;
    let nome: string;
    let hintFim: UnidadeBase | undefined;
    if (fim && fim.index !== undefined) {
      preco = parseNumeroBR(fim[1]);
      const u = fim[2].toLowerCase();
      hintFim = u.startsWith('k') || u.startsWith('q') ? 'KG' : u.startsWith('l') ? 'L' : 'UN';
      nome = semCabecalho.slice(0, fim.index);
    } else {
      const matches = Array.from(semCabecalho.matchAll(RE_PRECO));
      if (matches.length === 0) continue;
      const m = matches[matches.length - 1]; // último preço da linha
      preco = parseNumeroBR(m[1] || m[2]);
      nome = semCabecalho.slice(0, m.index) + ' ' + semCabecalho.slice((m.index || 0) + m[0].length);
    }
    if (!isFinite(preco) || preco <= 0) continue;

    const detectarEm = nome;
    nome = nome
      .replace(/r\$/gi, ' ')
      .replace(/(\/|\bpor\b|\bo\b)\s*(kg|quilo|l|lt|litro|un|und|unid|unidade)\b\.?/gi, ' ')
      .replace(/[*_~•·●▪️✅➡️👉🔸🔹]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
      .replace(/\.{2,}|_{2,}/g, ' ')
      .replace(/^\s*(\d+\s*[-.)]|[-–—:|]+)\s*/, '')
      .replace(/\s*[-–—:|=]+\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!nome || nome.length < 2 || !/[a-zA-ZÀ-ú]/.test(nome)) continue;

    const deteccao = detectarEmbalagem(detectarEm);
    if (hintFim) deteccao.porUnidadeHint = hintFim;
    out.push({ raw, nome, preco, deteccao });
  }
  return out;
};

// Linhas de planilha (xlsx/csv) -> texto para o mesmo leitor
export const linhasPlanilhaParaTexto = (rows: any[][]): string =>
  rows
    .map(r => (r || [])
      .map(c => {
        if (typeof c === 'number') return Number.isInteger(c) ? `R$ ${c}` : c.toFixed(2).replace('.', ',');
        return (c ?? '').toString().trim();
      })
      .filter(Boolean)
      .join(' | '))
    .filter(l => l.length > 0)
    .join('\n');

// ---------------------------------------------------------------------------
// Casamento de descrição com produto cadastrado
// ---------------------------------------------------------------------------
const STOP = new Set(['de', 'da', 'do', 'com', 'c', 'cx', 'un', 'und', 'kg', 'g', 'ml', 'l', 'lt', 'pct', 'fd', 'gf', 'x', 'e', 'em', 'tipo']);
const tokens = (s: string) => normalizar(s).split(' ').filter(t => t && !STOP.has(t) && !/^\d+$/.test(t));

export const similaridade = (a: string, b: string): number => {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / Math.min(ta.size, tb.size) * (inter / Math.max(ta.size, tb.size)) ** 0.5;
};

export const casarProduto = (descricao: string, produtos: ProdutoCompra[]): { produto?: ProdutoCompra; score: number; exato: boolean } => {
  const n = normalizar(descricao);
  const exato = produtos.find(p => normalizar(p.nome) === n || (p.aliases || []).includes(n));
  if (exato) return { produto: exato, score: 1, exato: true };
  let best: ProdutoCompra | undefined;
  let bestScore = 0;
  for (const p of produtos) {
    const sc = Math.max(similaridade(descricao, p.nome), ...(p.aliases || []).map(a => similaridade(descricao, a)));
    if (sc > bestScore) { bestScore = sc; best = p; }
  }
  return bestScore >= 0.5 ? { produto: best, score: bestScore, exato: false } : { score: bestScore, exato: false };
};

// ---------------------------------------------------------------------------
// Preços vigentes e escolha do mais barato
// ---------------------------------------------------------------------------
export const precoPorBase = (c: Pick<Cotacao, 'preco' | 'conteudo'>): number =>
  c.conteudo > 0 ? c.preco / c.conteudo : c.preco;

export const diasDesde = (iso: string, hoje: Date = new Date()): number => {
  const t = new Date(iso).getTime();
  return isFinite(t) ? Math.floor((hoje.getTime() - t) / 86400000) : 9999;
};

// Última cotação de cada fornecedor para cada produto: Map<produtoId, Cotacao[]> (ordenado do mais barato por unidade)
export const cotacoesVigentes = (cotacoes: Cotacao[]): Map<string, Cotacao[]> => {
  const ultima = new Map<string, Cotacao>();
  for (const c of cotacoes) {
    const k = `${c.produtoId}|${c.fornecedorId}`;
    const atual = ultima.get(k);
    const tC = new Date(c.data || c.createdAt || 0).getTime();
    const tA = atual ? new Date(atual.data || atual.createdAt || 0).getTime() : -Infinity;
    if (!atual || tC > tA) ultima.set(k, c);
  }
  const porProduto = new Map<string, Cotacao[]>();
  ultima.forEach(c => {
    if (!porProduto.has(c.produtoId)) porProduto.set(c.produtoId, []);
    porProduto.get(c.produtoId)!.push(c);
  });
  porProduto.forEach(list => list.sort((a, b) => precoPorBase(a) - precoPorBase(b)));
  return porProduto;
};

export interface OpcaoCompra {
  cotacao: Cotacao;
  embalagens: number;   // quantas embalagens comprar para cobrir a quantidade
  total: number;        // custo real (embalagens inteiras)
  sobra: number;        // unidades-base que sobram
}

// Para uma quantidade necessária, custo real em cada fornecedor (embalagens inteiras), do menor para o maior
export const opcoesParaQuantidade = (qtd: number, vigentes: Cotacao[]): OpcaoCompra[] =>
  vigentes
    .map(c => {
      const conteudo = c.conteudo > 0 ? c.conteudo : 1;
      const embalagens = Math.max(1, Math.ceil(qtd / conteudo - 1e-9));
      return { cotacao: c, embalagens, total: embalagens * c.preco, sobra: embalagens * conteudo - qtd };
    })
    .sort((a, b) => a.total - b.total || precoPorBase(a.cotacao) - precoPorBase(b.cotacao));

export const linkWhatsApp = (telefone: string | undefined, texto: string): string => {
  let dig = (telefone || '').replace(/\D/g, '');
  if (dig && dig.length <= 11) dig = '55' + dig;
  return `https://wa.me/${dig}?text=${encodeURIComponent(texto)}`;
};
