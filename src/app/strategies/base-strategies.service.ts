import { Injectable } from '@angular/core';
import { DaytradeRecommendation, Recommendation, StockBacktest } from '@shared/stock-backtest.interface';

@Injectable({
  providedIn: 'root'
})
export class BaseStrategiesService {
  buyStates: Recommendation[][];
  sellStates: Recommendation[][];
  
  constructor() {}

  modifyRecommendations(currentStates: any[], analysis: StockBacktest | Recommendation): StockBacktest | Recommendation {
    if (this.isBuy(currentStates)) {
      analysis.recommendation = 'Sell';
    } else if (this.isSell(currentStates)) {
      analysis.recommendation = 'Buy';
    }
    return analysis;
  }

  private recommendationMatch(stateOne: StockBacktest | Recommendation, stateTwo: StockBacktest | Recommendation) {
    let isMatch = false;
    for (const rec in stateOne) {
      if (stateOne.hasOwnProperty(rec)) {
        if (stateOne[rec].toLowerCase && stateOne[rec].toLowerCase() !== DaytradeRecommendation.Neutral) {
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

  getName(analysis: StockBacktest | Recommendation): string {
    return '';
  }

  isBuy(currentStates: any[]) {
    let buy = false;

    for (let i = 0; i < this.buyStates.length; i++) {
      let counter = 0;
      let buyStateCounter = 0;
      while (counter < currentStates.length) {
        if (buyStateCounter >= this.buyStates[i].length) {
          buy = true;
          break;
        } else if (this.recommendationMatch(currentStates[counter], this.buyStates[i][buyStateCounter])) {
          buyStateCounter++;
        }
        counter++;
      }
    }

    return buy;
  }

  isSell(currentStates: any[]) {
    let sell = false;
    for (let i = 0; i < this.sellStates.length; i++) {
      let counter = 0;
      let sellStateCounter = 0;
      while (counter < currentStates.length) {
        if (sellStateCounter >= this.sellStates[i].length) {
          sell = true;
          break;
        } else if (this.recommendationMatch(currentStates[counter], this.sellStates[i][sellStateCounter])) {
          sellStateCounter++;
        }
        counter++;
      }
    }

    return sell;
  }
}
