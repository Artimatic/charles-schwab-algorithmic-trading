import { Options } from './options';
import { Order } from './order';

export enum OrderTypes {
    equity,
    options,
    protectivePut,
    strangle,
    put,
    call
}

export interface SmartOrder extends Order {
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
    type?: OrderTypes;
    primaryLeg?: Options;
    secondaryLeg?: Options;
    primaryLegs?: Options[];
    secondaryLegs?: Options[];
    createdTime?: string;
    forImmediateExecution?: boolean;
    reason?: string;
    id?: string;
    targetQuantity?: number
    previousOrders?: {timestamp: string, price: number, quantity: number, side: string} [];
    warnings?: string[];
    errors?: string[];
    trailingHighPrice?: number;
    priceLowerBound?: number;
}
