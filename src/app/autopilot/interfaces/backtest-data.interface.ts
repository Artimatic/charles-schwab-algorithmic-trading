export interface BacktestData {
  stock: string;
  ml: number;
  sellMl: number;
  recommendation: string;
  impliedMovement: number;
  averageMove: number;
  invested: number;
  net: number;
  total: number;
  buySignals?: string[];
  sellSignals?: string[];
}