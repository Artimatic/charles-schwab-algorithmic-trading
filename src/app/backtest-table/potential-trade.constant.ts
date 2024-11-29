export interface PotentialTrade {
    date: string;
    strategy: Strategy;
    name: string;
    type: string;
    key: string;
    reason: string;
}

export interface Strategy {
    buy: string[];
    sell: string[];
}