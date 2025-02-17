export interface Options {
    ask?: number,
    bid?: number
    putCallInd: 'C' | 'P' | string;
    range?: 'ITM' | 'OTM';
    strikePrice?: number;
    symbol: string;
    totalVolume?: number;
    quantity: number;
    targetQuantity?: number;
    assetType?: string;
    cusip?: string; // "0INTC.TG40030000"
    description?: string; //"INTEL CORP 08/16/2024 $30 Put"
    netChange?: number;
    putCall: 'PUT' | 'CALL' | string;
    type?: string;
    underlyingSymbol?: string;
    averagePrice?: number;
}

export interface Strangle {
    call: Options;
    put: Options;
}