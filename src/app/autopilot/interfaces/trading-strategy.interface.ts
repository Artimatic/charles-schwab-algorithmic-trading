export interface TradingStrategy {
  name: string;
  strategy: {
    buy: string[];
    sell: string[];
  };
  reason?: string;
  key?: string;
  date?: string;
}