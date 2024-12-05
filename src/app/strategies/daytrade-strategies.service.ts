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
      const recommendation = current[String(indicator)];
      if (recommendation && recommendation.toLowerCase) {
        if (recommendation.toLowerCase() === DaytradeRecommendation.Bullish.toLowerCase() || recommendation.toLowerCase() === DaytradeRecommendation.Bearish.toLowerCase()) {
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
    if (analysis.recommendation.toLowerCase() === 'buy') {
      return true;
    }
    return false;
  }

  isPotentialSell(analysis: Recommendation) {
    if (analysis.recommendation.toLowerCase() === 'sell') {
      return true;
    }
    return false;
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