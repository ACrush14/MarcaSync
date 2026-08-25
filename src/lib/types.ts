export interface MarcaBase {
  name: string;
  cls: string;
}

export interface Similaridade {
  fa: string;
  fb: string;
  pct: number;
}

export type MarcaMatch = MarcaBase & Similaridade;

export interface InferenciaNCL {
  code: string;
  label: string;
  confidence: "alta" | "baixa";
}

export interface Analise {
  matches: MarcaMatch[];
  ncl: InferenciaNCL;
  top: MarcaMatch;
}

export type RiskTierKey = "alto" | "moderado" | "baixo";

export interface RiskTier {
  tier: RiskTierKey;
  cls: "risk" | "warm" | "safe";
  label: string;
}

export interface AppState {
  currentStep: number;
  unlockedStep: number;
  marca: string;
  descricao: string;
  analise: Analise | null;
  monitoramento: boolean;
  protocolo: string | null;
  opposed: boolean;
}
