import { Injectable } from '@angular/core';
import { Recommendation, DaytradeRecommendation } from '@shared/stock-backtest.interface';
import { BaseStrategiesService } from './base-strategies.service';

@Injectable({
  providedIn: 'root'
})
export class DaytradeStrategiesService extends BaseStrategiesService {
  skipNextCheck = {};
  states: { [key: string]: Recommendation[] } = {};
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

  hasRecommendations(current: Recommendation): boolean {
    let recommendationsCount = 0;
    for (const indicator in current) {
      if (current.recommendation.hasOwnProperty(indicator)) {
        const indicatorName = String(indicator);
        const recommendation = current.recommendation[indicatorName];
        if (recommendation.toLowerCase() === DaytradeRecommendation.Bullish || recommendation.toLowerCase() === DaytradeRecommendation.Bearish) {
          recommendationsCount++;
        }
      }
      if (recommendationsCount > 1) {
        break;
      }
    }

    return recommendationsCount > 1;
  }

  isPotentialBuy(analysis: Recommendation) {
    return (this.hasRecommendations(analysis) || analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft < 30) ||
      analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
        analysis.data.indicator.close < (1.1 * analysis.data.indicator.bband80[0][0]));
  }

  isPotentialSell(analysis: Recommendation) {
    return (analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft > 65) ||
      analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
        analysis.data.indicator.close > (0.9 * analysis.data.indicator.bband80[2][0]));
  }

  getName(analysis: Recommendation) {
    return analysis.name;
  }

  analyse(analysis: Recommendation) {
    if (this.isPotentialBuy(analysis) || this.isPotentialSell(analysis)) {
      this.skipNextCheck[analysis.name] = false;
    } else {
      this.skipNextCheck[analysis.name] = true;
    }
    if (this.states[analysis.name] && this.states[analysis.name].length > 18) {
      this.states[analysis.name].shift();
    } else {
      this.states[analysis.name] = [];
    }
    this.states[analysis.name].push(analysis);

    return this.modifyRecommendations(this.states[analysis.name], analysis);
  }

  shouldSkip(name: string) {
    const skip = Boolean(this.skipNextCheck[name]);
    this.skipNextCheck[name] = false;
    return skip;
  }

  saveStates(symbol: string, states) {
    const storage = JSON.parse(localStorage.getItem('daytradeStates'));
    if (storage) {
      if (!Array.isArray(storage[symbol])) {
        storage[symbol] = [];
      } else {
        storage[symbol].push(states)
      }
    } else {
      const newStorageObj = {};
      newStorageObj[symbol] = [states];
      localStorage.setItem('daytradeStates', JSON.stringify(newStorageObj));
    }
  }
}