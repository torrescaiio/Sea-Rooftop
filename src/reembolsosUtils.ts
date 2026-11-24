// ---------------------------------------------------------------------------
// Reembolsos: montagem do relatório (texto e PDF) a partir das diárias e despesas.
// ---------------------------------------------------------------------------
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseDataLocal } from "./rotinaUtils";

export const CATEGORIAS_DESPESA = ["Compras", "Transporte", "Serviços", "Manutenção", "Eventos", "Outros"];

export interface Despesa {
  id?: string;
  data: string;          // YYYY-MM-DD
  descricao: string;
  categoria: string;
  valor: number;
  pagoPor: string;
  observacao?: string;
  temComprovante?: boolean;
  enviadoFinanceiroEm?: string | null;
  createdAt?: string;
}

export interface Diaria {
  id?: string;
  data: string;
  nome: string;
  funcao: string;
  motivo?: string;
  valor: number;
  enviadoFinanceiroEm?: string | null;
}

export interface ItemRelatorio {
  n: number;
  tipo: "diaria" | "despesa";
  id: string;
  data: string;
  titulo: string;     // nome do extra ou descrição da despesa
  detalhe: string;    // função ou categoria
  motivo?: string;
  valor: number;
  enviado: boolean;
  pagoPor: string;
  comprovante?: boolean;
  observacao?: string;
}

export const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (s: string) => s.split("-").reverse().join("/");
export const diaSemana = (s: string) => parseDataLocal(s).toLocaleDateString("pt-BR", { weekday: "long" });

// Ordem do relatório: diárias pendentes por dia, despesas pendentes e, por último, o que já foi enviado.
export const montarItens = (diarias: Diaria[], despesas: Despesa[], reembolsarA: string): ItemRelatorio[] => {
  const d: Omit<ItemRelatorio, "n">[] = diarias.map(x => ({
    tipo: "diaria", id: x.id!, data: x.data, titulo: x.nome, detalhe: x.funcao,
    motivo: x.motivo, valor: Number(x.valor) || 0, enviado: !!x.enviadoFinanceiroEm, pagoPor: reembolsarA,
  }));
  const e: Omit<ItemRelatorio, "n">[] = despesas.map(x => ({
    tipo: "despesa", id: x.id!, data: x.data, titulo: x.descricao, detalhe: x.categoria,
    valor: Number(x.valor) || 0, enviado: !!x.enviadoFinanceiroEm, pagoPor: x.pagoPor || reembolsarA,
    comprovante: !!x.temComprovante, observacao: x.observacao,
  }));
  const porData = (a: { data: string }, b: { data: string }) => a.data.localeCompare(b.data);
  const ordenados = [
    ...d.filter(x => !x.enviado).sort(porData),
    ...e.filter(x => !x.enviado).sort(porData),
    ...[...d, ...e].filter(x => x.enviado).sort(porData),
  ];
  return ordenados.map((x, i) => ({ ...x, n: i + 1 }));
};

const somar = (itens: ItemRelatorio[]) => itens.reduce((s, x) => s + x.valor, 0);

export const totais = (itens: ItemRelatorio[]) => {
  const enviados = itens.filter(x => x.enviado);
  const pendentes = itens.filter(x => !x.enviado);
  return {
    enviado: somar(enviados),
    pendente: somar(pendentes),
    total: somar(itens),
    diariasPendentes: pendentes.filter(x => x.tipo === "diaria"),
    despesasPendentes: pendentes.filter(x => x.tipo === "despesa"),
    enviados,
  };
};

const agruparPorDia = (itens: ItemRelatorio[]) => {
  const grupos = new Map<string, ItemRelatorio[]>();
  for (const it of itens) grupos.set(it.data, [...(grupos.get(it.data) || []), it]);
  return [...grupos.entries()];
};

// ---------------------------------------------------------------------------
// Texto para WhatsApp
// ---------------------------------------------------------------------------
export const montarTexto = (itens: ItemRelatorio[], inicio: string, fim: string, reembolsarA: string): string => {
  const t = totais(itens);
  const L: string[] = [`*REEMBOLSO ${reembolsarA.toUpperCase()} · ${dataBR(inicio).slice(0, 5)} a ${dataBR(fim).slice(0, 5)}*`, ""];
  let secao = 1;

  if (t.diariasPendentes.length) {
    L.push(`*${secao++}. Diárias de extras (a enviar)*`, "");
    for (const [dia, lista] of agruparPorDia(t.diariasPendentes)) {
      const motivos = [...new Set(lista.map(x => x.motivo).filter(Boolean))].join(" / ");
      L.push(`*${dataBR(dia).slice(0, 5)} (${diaSemana(dia)})${motivos ? ` · ${motivos}` : ""}*`);
      lista.forEach(x => L.push(`${x.n}. ${x.titulo} · ${x.detalhe} · ${brl(x.valor)}`));
      L.push(`Subtotal: ${brl(somar(lista))}`, "");
    }
    L.push(`Total de diárias: ${t.diariasPendentes.length} diária${t.diariasPendentes.length > 1 ? "s" : ""} · ${brl(somar(t.diariasPendentes))}`, "");
  }

  if (t.despesasPendentes.length) {
    L.push(`*${secao++}. Outras despesas (a enviar)*`);
    t.despesasPendentes.forEach(x => L.push(`${x.n}. ${dataBR(x.data).slice(0, 5)} · ${x.titulo} · ${brl(x.valor)}${x.observacao ? `\n   Obs.: ${x.observacao}` : ""}`));
    L.push(`Subtotal: ${brl(somar(t.despesasPendentes))}`, "");
  }

  if (t.enviados.length) {
    L.push(`*${secao++}. Já enviado ao financeiro*`);
    t.enviados.forEach(x => L.push(`${x.n}. ${dataBR(x.data).slice(0, 5)} · ${x.titulo}${x.tipo === "diaria" ? ` (${x.detalhe})` : ""} · ${brl(x.valor)}`));
    L.push(`Subtotal: ${brl(t.enviado)}`, "");
  }

  L.push(`*${secao}. Resumo*`);
  if (t.enviados.length) L.push(`Já enviado: ${brl(t.enviado)}`);
  L.push(`A enviar: ${brl(t.pendente)}`);
  L.push(`*Total a reembolsar a ${reembolsarA} no período: ${brl(t.total)}*`);
  return L.join("\n");
};

// ---------------------------------------------------------------------------
// PDF (tabela + anexos de comprovantes, 6 por folha)
// ---------------------------------------------------------------------------
export const construirPDF = async (
  itens: ItemRelatorio[], inicio: string, fim: string, reembolsarA: string, emitidoPor: string,
  carregarComprovante: (id: string) => Promise<string | null>
) => {
  const t = totais(itens);
  const doc = new jsPDF();
  const larg = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold").setFontSize(16).text("Relatório de Reembolso · Sea Rooftop", 14, 18);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`Período: ${dataBR(inicio)} a ${dataBR(fim)}`, 14, 25);
  doc.text(`Reembolso a: ${reembolsarA}  ·  Emitido em ${new Date().toLocaleString("pt-BR")} por ${emitidoPor}`, 14, 30);
  doc.setTextColor(0);

  let y = 35;
  const cabecalho = { fillColor: [40, 40, 40] as [number, number, number], textColor: 255, fontStyle: "bold" as const };
  const linhaSubtotal = { fillColor: [235, 235, 235] as [number, number, number], fontStyle: "bold" as const };
  const fimTabela = () => ((doc as any).lastAutoTable?.finalY || y) + 8;

  // Resumo no topo: quem confere vê o valor primeiro e depois os itens
  const qtdPend = t.diariasPendentes.length + t.despesasPendentes.length;
  const destaque = { fontStyle: "bold" as const, fontSize: 13, halign: "center" as const };
  const rotulo = { fontSize: 8, textColor: 90, halign: "center" as const };
  autoTable(doc, {
    startY: y, theme: "grid",
    body: [
      [
        { content: `A ENVIAR (${qtdPend} ite${qtdPend === 1 ? "m" : "ns"})`, styles: rotulo },
        { content: "JÁ ENVIADO", styles: rotulo },
        { content: "TOTAL DO PERÍODO", styles: rotulo },
      ],
      [
        { content: brl(t.pendente), styles: { ...destaque, fillColor: [255, 244, 214] as [number, number, number] } },
        { content: brl(t.enviado), styles: { ...destaque, textColor: 90 } },
        { content: brl(t.total), styles: destaque },
      ],
    ],
    styles: { cellPadding: 2.5, lineColor: [200, 200, 200] },
  });
  y = fimTabela();

  const titulo = (txt: string) => {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold").setFontSize(11).text(txt, 14, y);
    y += 3;
  };

  if (t.diariasPendentes.length) {
    titulo("Diárias de extras (a enviar)");
    const body: any[] = [];
    for (const [dia, lista] of agruparPorDia(t.diariasPendentes)) {
      lista.forEach(x => body.push([x.n, `${dataBR(x.data)} (${diaSemana(x.data).slice(0, 3)})`, x.titulo, x.detalhe, x.motivo || "-", brl(x.valor)]));
      body.push([{ content: `Subtotal ${dataBR(dia)} · ${lista.length} diária${lista.length > 1 ? "s" : ""}`, colSpan: 5, styles: linhaSubtotal }, { content: brl(somar(lista)), styles: linhaSubtotal }]);
    }
    autoTable(doc, {
      startY: y, theme: "grid", head: [["#", "Data", "Nome", "Função", "Motivo", "Valor"]], body,
      styles: { fontSize: 8.5 }, headStyles: cabecalho,
      columnStyles: { 0: { cellWidth: 9, halign: "center" }, 5: { halign: "right", cellWidth: 26 } },
    });
    y = fimTabela();
  }

  if (t.despesasPendentes.length) {
    titulo("Outras despesas (a enviar)");
    autoTable(doc, {
      startY: y, theme: "grid", head: [["#", "Data", "Descrição", "Categoria", "Comprovante", "Valor"]],
      body: [
        ...t.despesasPendentes.map(x => [x.n, dataBR(x.data), x.titulo + (x.observacao ? `\nObs.: ${x.observacao}` : ""), x.detalhe, x.comprovante ? `Anexo #${x.n}` : "-", brl(x.valor)]),
        [{ content: "Subtotal", colSpan: 5, styles: linhaSubtotal }, { content: brl(somar(t.despesasPendentes)), styles: linhaSubtotal }],
      ],
      styles: { fontSize: 8.5 }, headStyles: cabecalho,
      columnStyles: { 0: { cellWidth: 9, halign: "center" }, 5: { halign: "right", cellWidth: 26 } },
    });
    y = fimTabela();
  }

  if (t.enviados.length) {
    titulo("Já enviado ao financeiro neste período");
    autoTable(doc, {
      startY: y, theme: "grid", head: [["#", "Data", "Descrição", "Tipo", "Valor"]],
      body: [
        ...t.enviados.map(x => [x.n, dataBR(x.data), x.tipo === "diaria" ? `${x.titulo} (${x.detalhe})` : x.titulo, x.tipo === "diaria" ? "Diária" : x.detalhe, brl(x.valor)]),
        [{ content: "Subtotal", colSpan: 4, styles: linhaSubtotal }, { content: brl(t.enviado), styles: linhaSubtotal }],
      ],
      styles: { fontSize: 8.5, textColor: 90 }, headStyles: { ...cabecalho, fillColor: [120, 120, 120] },
      columnStyles: { 0: { cellWidth: 9, halign: "center" }, 4: { halign: "right", cellWidth: 26 } },
    });
    y = fimTabela();
  }

  // Anexos: comprovantes, 6 por folha (3 colunas x 2 linhas)
  const comComprovante = itens.filter(x => x.comprovante);
  if (comComprovante.length) {
    const margem = 10, colunas = 3, linhas = 2;
    const altPag = doc.internal.pageSize.getHeight();
    const celW = (larg - margem * 2) / colunas;
    const celH = (altPag - margem * 2 - 10) / linhas;
    let i = 0;
    for (const it of comComprovante) {
      const img = await carregarComprovante(it.id);
      if (!img) continue;
      if (i % (colunas * linhas) === 0) {
        doc.addPage();
        doc.setFont("helvetica", "bold").setFontSize(11).text("Anexos: comprovantes", margem, margem + 4);
      }
      const pos = i % (colunas * linhas);
      const x0 = margem + (pos % colunas) * celW;
      const y0 = margem + 10 + Math.floor(pos / colunas) * celH;
      doc.setFont("helvetica", "bold").setFontSize(8).text(`#${it.n} · ${dataBR(it.data).slice(0, 5)} · ${brl(it.valor)}`, x0 + 2, y0 + 4);
      doc.setFont("helvetica", "normal").setFontSize(7).text(doc.splitTextToSize(it.titulo, celW - 4)[0], x0 + 2, y0 + 8);
      const props = doc.getImageProperties(img);
      const maxW = celW - 4, maxH = celH - 14;
      const escala = Math.min(maxW / props.width, maxH / props.height);
      doc.addImage(img, "JPEG", x0 + 2, y0 + 11, props.width * escala, props.height * escala);
      doc.setDrawColor(200).rect(x0, y0, celW - 1, celH - 2);
      i++;
    }
  }

  // Rodapé com paginação
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Página ${p} de ${paginas}`, larg - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }

  return doc;
};

export const gerarPDF = async (
  itens: ItemRelatorio[], inicio: string, fim: string, reembolsarA: string, emitidoPor: string,
  carregarComprovante: (id: string) => Promise<string | null>
) => {
  const doc = await construirPDF(itens, inicio, fim, reembolsarA, emitidoPor, carregarComprovante);
  doc.save(`reembolso_${reembolsarA.toLowerCase().replace(/\s+/g, "_")}_${inicio}_a_${fim}.pdf`);
};

// ---------------------------------------------------------------------------
// Foto do comprovante: reduz para caber no banco (JPEG ~150-400 KB)
// ---------------------------------------------------------------------------
export const comprimirImagem = (arquivo: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não suportado."));
      img.onload = () => {
        const max = 1400;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = 0.7;
        let url = canvas.toDataURL("image/jpeg", q);
        while (url.length > 700_000 && q > 0.3) { q -= 0.1; url = canvas.toDataURL("image/jpeg", q); }
        resolve(url);
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });

