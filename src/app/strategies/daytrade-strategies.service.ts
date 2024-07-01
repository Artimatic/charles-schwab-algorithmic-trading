import { Injectable } from '@angular/core';
import { DaytradeIndicator } from '@shared/stock-backtest.interface';

@Injectable({
  providedIn: 'root'
})
export class DaytradeStrategiesService {
  skipNextCheck = {};
  states: { [key: string]: DaytradeIndicator[] } = {};
  buyStates: DaytradeIndicator[][] = [
    [
      { bband: 'Neutral', bbandBreakout: 'Neutral', demark9: 'Neutral', macd: 'Neutral', mfi: 'Bearish', mfiTrade: 'Neutral', roc: 'Neutral', vwma: 'Bullish' },
      { bband: 'Neutral', bbandBreakout: 'Neutral', demark9: 'Neutral', macd: 'Neutral', mfi: 'Bearish', mfiTrade: 'Neutral', roc: 'Neutral', vwma: 'Bullish' }
    ]
  ];

  sellStates = [

  ];
  constructor() { }

  hasRecommendations(current: DaytradeIndicator): boolean {
    let recommendationsCount = 0;
    for (const indicator in current) {
      if (current.recommendation.hasOwnProperty(indicator)) {
        const indicatorName = String(indicator);
        const recommendation = current.recommendation[indicatorName];
        if (recommendation.toLowerCase() === 'bullish' || recommendation.toLowerCase() === 'bearish') {
          recommendationsCount++;
        }
      }
      if (recommendationsCount > 1) {
        break;
      }
    }

    return recommendationsCount > 1;
  }

  potentialBuy(analysis: DaytradeIndicator) {
    return (this.hasRecommendations(analysis) || analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft < 30) ||
      analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
        analysis.data.indicator.close < (1.1 * analysis.data.indicator.bband80[0][0]));
  }

  potentialSell(analysis) {
    return (analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft > 65) ||
      analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
        analysis.data.indicator.close > (0.9 * analysis.data.indicator.bband80[2][0]));
  }

  analyse(analysis: DaytradeIndicator) {
    if (this.potentialBuy(analysis) || this.potentialSell(analysis)) {
      this.skipNextCheck[analysis.name] = false;
    } else {
      this.skipNextCheck[analysis.name] = true;
    }
    if (this.states[analysis.name].length > 18) {
      this.states[analysis.name].shift();
    }
    this.states[analysis.name].push(analysis);

    return this.modifyRecommendations(analysis);
  }

  modifyRecommendations(analysis: DaytradeIndicator) {
    if (this.isBuy(analysis)) {
      analysis.recommendation = 'Sell';
    } else if (this.isSell(analysis)) {
      analysis.recommendation = 'Buy';
    }
    return analysis;
  }

  private recommendationMatch(stateOne: DaytradeIndicator, stateTwo: DaytradeIndicator) {
    let isMatch = false;
    for (const rec in stateOne) {
      if (stateOne.hasOwnProperty(rec)) {
        if (stateOne[rec].toLowerCase && stateOne[rec].toLowerCase() !== 'neutral') {
          if (stateOne[rec] === stateTwo[rec]) {
            isMatch = true;
          } else {
            isMatch = false;
          }
        }
      }
    }
    return isMatch; 
  }

  isBuy(analysis: DaytradeIndicator) {
    let buy = false;

    for (let i = 0; i < this.buyStates.length; i++) {
      let counter = 0;
      let buyStateCounter = 0;
      while (counter < this.states[analysis.name].length) {
        if (buyStateCounter >= this.buyStates[i].length) {
          buy = true;
          break;
        } else if (this.recommendationMatch(this.states[analysis.name][counter], this.buyStates[i][buyStateCounter])) {
          buyStateCounter++;
        }
        counter++;
      }
    }

    return buy;
  }

  isSell(analysis: DaytradeIndicator) {
    let sell = false;
    for (let i = 0; i < this.sellStates.length; i++) {
      let counter = 0;
      let sellStateCounter = 0;
      while (counter < this.states[analysis.name].length) {
        if (sellStateCounter >= this.sellStates[i].length) {
          sell = true;
          break;
        } else if (this.recommendationMatch(this.states[analysis.name][counter], this.sellStates[i][sellStateCounter])) {
          sellStateCounter++;
        }
        counter++;
      }
    }

    return sell;
  }

  shouldSkip(name: string) {
    const skip = Boolean(this.skipNextCheck[name]);
    this.skipNextCheck[name] = false;
    return skip;
  }

  buildStates() {

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
