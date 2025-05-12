import { Injectable } from '@angular/core';
import { BacktestService } from '@shared/services';
import { DaytradeRecommendation } from '@shared/stock-backtest.interface';
import * as moment from 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class LookBackStrategyService {

  constructor(private backtestService: BacktestService) { }

  async checkOrderHistory(symbol: string, orderHistory: any[]): Promise<DaytradeRecommendation> {
    if (!orderHistory.length) {
      return Promise.resolve(DaytradeRecommendation.Neutral);
    }
    const dateDiff = moment().diff(moment(orderHistory[orderHistory.length - 1].date), 'days');
    if (dateDiff > 9 && dateDiff < 20) {
          const currentDate = moment().format('YYYY-MM-DD');
          const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
          const backtest = await this.backtestService.getBacktestEvaluation(symbol, startDate, currentDate, 'daily-indicators').toPromise();
          const signals = backtest.signals;
          const lastSignal = signals[signals.length - 1];
          const pastSignal = signals[signals.length - dateDiff];
          if (orderHistory[orderHistory.length - 1].action === 'STRONGBUY' && lastSignal.mfiLeft > pastSignal.mfiLeft) {
            return DaytradeRecommendation.Bullish;
          } else if (orderHistory[orderHistory.length - 1].action === 'STRONGSELL' && lastSignal.mfiLeft < pastSignal.mfiLeft) {
            return DaytradeRecommendation.Bearish;
          }
    }
  }
}
