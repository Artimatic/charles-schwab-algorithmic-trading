export interface TradingStrategy {
  name: string;
  key?: string;
  date?: string;
  type?: string;
  strategy: {
    buy: string[];
    sell: string[];
  };
  reason?: string;
}