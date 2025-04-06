import { Injectable } from '@angular/core';

export enum RiskTolerance {
  None = 0.003,
  Zero = 0.005,
  One = 0.01,
  Two = 0.025,
  Lower = 0.05,
  Low = 0.1,
  ExtremeFear = 0.15,
  Fear = 0.2,
  Neutral = 0.25,
  Greed = 0.5,
  ExtremeGreed = 0.6,
  XLGreed = 0.7,
  XXLGreed = 0.8,
  XXXLGreed = 0.9,
  XXXXLGreed = 1
}

export enum Strategy {
  Default = 'Default',
  DaytradeShort = 'DaytradeShort',
  Daytrade = 'Daytrade',
  Swingtrade = 'Swingtrade',
  InverseSwingtrade = 'InverseSwingtrade',
  Short = 'Short',
  TrimHoldings = 'TrimHoldings',
  DaytradeFullList = 'DaytradeFullList',
  StateMachine = 'StateMachine',
  SingleStockPick = 'SingleStockPick',
  MLSpy = 'MLSpy',
  OptionsStrangle = 'OptionsStrangle',
  TradingPairs = 'TradingPairs',
  BuyCalls = 'BuyCalls',
  BuyPuts = 'BuyPuts',
  BuySnP = 'Buy S&P500',
  BuyWinners = 'Buy Winners',
  BuyML = 'Buy by ML signal',
  MLPairs = 'ML trade pairs',
  VolatilityPairs = 'Implied Movement trade pairs',
  SellMfiTrade = 'Buy by mfi trade sell signal',
  BuyMfiTrade = 'Buy by mfi trade buy signal',
  SellMfiDiv = 'Buy by mfi divergence sell signal',
  BuyMfiDiv = 'Buy by mfi divergence buy signal',
  BuyMfiDiv2 = 'Buy by mfi divergence2 buy signal',
  BuyMfi = 'Buy by mfi buy signal',
  BuyMacd = 'Buy by macd buy signal',
  BuyFlag = 'Buy by flag pennant buy signal',
  SellMfi = 'Buy by mfi sell signal',
  BuyBband = 'Buy by bband buy signal',
  SellBband = 'Buy by bband sell signal',
  InverseDispersion = 'Inverse dispersion trade',
  PerfectPair = 'Perfect Pair',
  AnyPair = 'Any Pair',
  BuyDemark = 'Buy demark',
  AddToPositions = 'Add to current positions',
  Hedge = 'Hedge',
  None = 'None'
}

@Injectable({
  providedIn: 'root'
})
export class StrategyDeciderService {
  riskToleranceList = [
    RiskTolerance.One,
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral
  ];

  strategyList = [
    Strategy.Default,
    Strategy.InverseDispersion,
    Strategy.BuyMfiTrade,
    Strategy.BuyMfiDiv,
    Strategy.BuyMfi,
    Strategy.AddToPositions,
    Strategy.PerfectPair,
    Strategy.BuyCalls,
    Strategy.Hedge,
    Strategy.BuyMacd,
    Strategy.BuyBband,
    Strategy.Short,
    Strategy.SellMfi,
    Strategy.BuyFlag,
    Strategy.BuyML,
    Strategy.SellBband,
    Strategy.BuySnP,
    Strategy.MLPairs,
    Strategy.TradingPairs,
    Strategy.BuyDemark,
    Strategy.VolatilityPairs,
    Strategy.BuyWinners,
    Strategy.TrimHoldings
    //Strategy.None
  ];
  constructor() { }
}
