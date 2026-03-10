export interface MarketHours {
  equity?: {
    EQ?: {
      isOpen: boolean;
      sessionHours?: {
        regularMarket: Array<{
          start: string;
          end: string;
        }>;
      };
    };
  };
}