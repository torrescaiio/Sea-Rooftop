export interface StaffMember {
  id: string;
  nome: string;
  cargo: string;
  pontuacao: number; // 1 to 10
  situacaoAtual: string;
  status: 'Ativo' | 'Suspenso' | 'Desligado';
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  tarefa: string;
  categoria: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  link?: string;
  responsavel?: string;
  dataLimite?: string;
  prioridade?: 'Baixa' | 'Média' | 'Alta';
  observacoes?: string;
  createdAt: string;
}

export interface ChecklistCategory {
  id: string;
  nome: string;
  createdAt: string;
}

export interface Occurrence {
  id: string;
  data: string; // YYYY-MM-DD
  categoria: 'Sistema' | 'Funcionários' | 'Logística' | 'Falta' | 'Atestados' | 'Cliente';
  descricaoDetalhada: string;
  responsavelResolucao: string;
  funcionarioEnvolvidoId?: string;
  status: 'Aberto' | 'Resolvido';
  createdAt: string;
}

export interface MaintenanceRepair {
  id: string;
  item: string;
  local: string;
  prioridade: 'Baixa' | 'Média' | 'Urgente';
  status: 'Pendente' | 'Em Andamento' | 'Resolvido';
  createdAt: string;
}

export interface MaintenancePurchase {
  id: string;
  item: string;
  fornecedor: string;
  valorEstimado: number;
  status: 'A Orçar' | 'Aprovado' | 'Comprado';
  createdAt: string;
}

export interface GeneralPurchase {
  id: string;
  item: string;
  categoria: string;
  quantidade: number;
  fornecedor?: string;
  link?: string;
  valorUnitario?: number;
  valorComprado?: number; // Total value
  status: 'A Orçar' | 'Solicitado' | 'Comprado';
  createdAt: string;
}

export interface AgendaEvent {
  id: string;
  data: string; // YYYY-MM-DD
  tipoEvento: 'Música ao Vivo' | 'DJ' | 'Transmissão Esportiva' | 'Evento Fechado' | 'Outros';
  artistaNome: string;
  horarioPassagemSom: string;
  horarioInicio: string;
  horarioTermino: string;
  cacheCusto: number;
  necessidadesTecnicas: string;
  status: 'A Confirmar' | 'Confirmado' | 'Cancelado';
  createdAt: string;
}

export interface Contact {
  id: string;
  nome: string;
  categoria: 'Músicos' | 'Extras' | 'Prestador de Serviços' | 'Hotel' | 'Outros';
  telefone: string;
  detalhes?: string;
  createdAt: string;
}
