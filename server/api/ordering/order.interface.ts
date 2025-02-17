export interface Options {
    ask?: number,
    bid?: number
    putCallInd: 'C' | 'P' | string;
    range?: 'ITM' | 'OTM';
    strikePrice?: number;
    symbol: string;
    totalVolume?: number;
    quantity: number;
    assetType?: string;
    cusip?: string; // "0INTC.TG40030000"
    description?: string; //"INTEL CORP 08/16/2024 $30 Put"
    netChange?: number;
    putCall: 'PUT' | 'CALL' | string;
    type?: string;
    underlyingSymbol?: string;
    averagePrice?: number;
}

export interface Holding {
    symbol: string;
}

export interface Order {
    holding: Holding;
    quantity: number;
    price: number;
    submitted: boolean;
    pending: boolean;
    side: string;
    amount?: number;
    id?: string;
    splits?: number;
    positionCount?: number;
    buyCount?: number;
    sellCount?: number;
    timeSubmitted?: string;
    signalTime?: number;
    lossThreshold?: number;
    profitTarget?: number;
    trailingStop?: number;
    useStopLoss?: boolean;
    useTrailingStopLoss?: boolean;
    useTakeProfit?: boolean;
    sellAtClose?: boolean;
    yahooData?: boolean;
    orderSize?: number;
    init?: boolean;
    stopped?: boolean;
    lastUpdated?: string;
    allocation?: number;
    primaryLegs?: Options[];
    secondaryLegs?: Options[];
    createdTime?: string;
    forImmediateExecution?: boolean;
    reason?: string;
}