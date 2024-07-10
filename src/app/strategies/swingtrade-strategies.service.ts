import { Injectable } from '@angular/core';
import { DaytradeRecommendation, Recommendation, StockBacktest } from '@shared/stock-backtest.interface';
import { BaseStrategiesService } from './base-strategies.service';

@Injectable({
  providedIn: 'root'
})
export class SwingtradeStrategiesService extends BaseStrategiesService{
  buyStates: Recommendation[][] = [
    [
      { bband: DaytradeRecommendation.Bullish, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Neutral, mfi: DaytradeRecommendation.Neutral, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish },
      { bband: DaytradeRecommendation.Neutral, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Neutral, mfi: DaytradeRecommendation.Bullish, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish },
      { bband: DaytradeRecommendation.Neutral, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Bullish, mfi: DaytradeRecommendation.Neutral, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish }
    ]
  ];

  sellStates: Recommendation[][] = [
    [
      { bband: DaytradeRecommendation.Bearish, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Neutral, mfi: DaytradeRecommendation.Neutral, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish },
      { bband: DaytradeRecommendation.Neutral, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Neutral, mfi: DaytradeRecommendation.Bearish, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish },
      { bband: DaytradeRecommendation.Neutral, bbandBreakout: DaytradeRecommendation.Neutral, demark9: DaytradeRecommendation.Neutral, macd: DaytradeRecommendation.Bearish, mfi: DaytradeRecommendation.Neutral, mfiTrade: DaytradeRecommendation.Neutral, roc: DaytradeRecommendation.Neutral, vwma: DaytradeRecommendation.Bullish }
    ]
  ];

  constructor() {
    super();
   }

  processSignals(backtest: StockBacktest): StockBacktest {
    const lastSignal = backtest.signals[backtest.signals.length - 1];
    //const lowsFrequency = {};
    let highToLowSum = 0;
    backtest.signals.forEach((sig) => {
      highToLowSum += sig.high - sig.low;
    });
    backtest.averageMove = Number((highToLowSum / backtest.signals.length).toFixed(2)) || lastSignal.high - lastSignal.low;
    return backtest;
  }

  getName(analysis: StockBacktest) {
    return analysis.stock;
  }
}
