
import * as _ from 'lodash';
import { Order } from './order.interface';
import backtestService from '../backtest/backtest.service';
import intradayPredicationService from '../machine-learning/intraday-prediction.service';

import { Indicators } from '../backtest/backtest.constants';
import * as moment from 'moment-timezone';

interface StockRecommendationResponse {
  recommendation: string;
  action: string;
}

class OrderingService {
  private hasReachedOrderLimit(order: Order) {
    const orderSide = order.side.toUpperCase();
    if (orderSide === 'DAYTRADE') {
      return (order.buyCount >= order.quantity) &&
        (order.sellCount >= order.quantity);
    } else if (orderSide === 'BUY') {
      return (order.buyCount >= order.quantity);
    } else if (orderSide === 'SELL') {
      return order.sellCount >= order.quantity;
    }
  }

  processStockRecommendation(order: Order) {
    if (this.hasReachedOrderLimit(order)) {
      return Promise.reject('Order limit reached');
    }
    const symbol = order.holding.symbol.toUpperCase();

    return backtestService.getCurrentDaytradeIndicators(symbol, 81, 'td')
      .then((technicalAnalysis: Indicators) => {
        const analysis = backtestService.getDaytradeRecommendation(symbol, null, null, { lossThreshold: -0.05, profitThreshold: 0.05}, technicalAnalysis);
        console.log('analysis', analysis);

        if (analysis.recommendation.toUpperCase() === 'SELL') {
          const orderSide = order.side.toLowerCase();
          if (orderSide === 'SELL') {

          }
          return Promise.resolve(analysis);
        } else if (analysis.recommendation.toUpperCase() === 'BUY') {
          const orderSide = order.side.toUpperCase();
          if (orderSide === 'BUY') {

          }
          return Promise.resolve(analysis);
        } else {
          return intradayPredicationService.train(symbol,
            moment().add({ days: 1 }).format('YYYY-MM-DD'),
            moment().subtract({ days: 4 }).format('YYYY-MM-DD'),
            0.5,
            null);
        }

      });
  }
}

export default new OrderingService();
