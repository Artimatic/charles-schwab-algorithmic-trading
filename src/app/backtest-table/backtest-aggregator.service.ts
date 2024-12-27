import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class BacktestAggregatorService {

  backtestSignalsTimeline = {};
  constructor() { }

  analyseBacktest(backtest) {
    if (backtest && backtest.orderHistory) {
      backtest.orderHistory.forEach(history => {
        const date = moment(history.date).format('YYYY-MM-DD');
        if (!this.backtestSignalsTimeline[date]) {
          this.backtestSignalsTimeline[date] = { buy: 0, sell: 0, total: 0};
        }

        this.backtestSignalsTimeline[date].total++;

        if (history.action.toLowerCase() === 'buy' || history.action.toLowerCase() === 'strongbuy') {
          this.backtestSignalsTimeline[date].buy++;
        } else if (history.action.toLowerCase() === 'sell' || history.action.toLowerCase() === 'strongsell') {
          this.backtestSignalsTimeline[date].sell++;
        }
      });
    }
  }

  getTimeLine() {
    return this.backtestSignalsTimeline;
  }

  clearTimeLine() {
    this.backtestSignalsTimeline = {};
  }
}
