
import * as _ from 'lodash';
import { Order } from './order.interface';
import backtestService from '../backtest/backtest.service';
import intradayPredicationService from '../machine-learning/intraday-prediction.service';

import { Indicators } from '../backtest/backtest.constants';
import * as moment from 'moment-timezone';
import portfolioService from '../portfolio/portfolio.service';
import quoteService from '../quote/quote.service';

interface StockRecommendationResponse {
  recommendation: string;
  action: string;
}

class OrderingService {
  private isOptionOrder(order: Order) {
    return order.primaryLegs;
  }

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

  private incrementSell(order: Order) {
    console.log('Sent sell order', order);
    order.sellCount += order.quantity;
    order.positionCount -= order.quantity;

    return order
  }

  processStockRecommendation(order: Order) {
    if (this.hasReachedOrderLimit(order)) {
      return Promise.reject('Order limit reached');
    }
    const symbol = order.holding.symbol.toUpperCase();
    return backtestService.getCurrentDaytradeIndicators(symbol, 81, 'td')
      .then((technicalAnalysis: Indicators) => {
        const analysis = backtestService.getDaytradeRecommendation(symbol, null, null, { lossThreshold: -0.05, profitThreshold: 0.05 }, technicalAnalysis);
        console.log('analysis', analysis);

        if (analysis.recommendation.toUpperCase() === 'SELL') {
          const orderSide = order.side.toLowerCase();
          if (orderSide === 'SELL') {
            if (!this.isOptionOrder(order)) {
              return portfolioService.getPositions(null)
                .then((positions) => {
                  console.log('positions', positions);

                  const foundPosition = positions.find((pos) => {
                    return pos.instrument.symbol === symbol;
                  });

                  if (foundPosition) {
                    const positionCount = Number(foundPosition.longQuantity);
                    if (positionCount === 0) {
                      return Promise.reject({ message: `${order.holding.symbol} not found` });
                    } else {
                      this.incrementSell(order);
                      const quantity = order.orderSize < positionCount ? order.orderSize : positionCount;
                      portfolioService.sendSellOrder(symbol,
                        quantity,
                        order.price,
                        'MARKET',
                        true,
                        null,
                        null)
                    }
                  }
                  return Promise.resolve({ action: 'SELL', analysis, order });
                });
            }
          }
          return Promise.resolve({ action: 'SELL', analysis, order });
        } else if (analysis.recommendation.toUpperCase() === 'BUY') {
          const orderSide = order.side.toUpperCase();
          if (orderSide === 'BUY') {
            if (!this.isOptionOrder(order)) {
              return portfolioService.getTdBalance(null, null)
                .then((balance) => {
                  console.log('balance', balance);
                  return portfolioService.getQuote(symbol, null, null)
                    .then((price) => {
                      order.price = price[symbol].quote.lastPrice;
                      this.incrementSell(order);
                      return portfolioService.getPositions(null)
                        .then((positions) => {
                          console.log('positions', positions);

                          const foundPosition = positions.find((pos) => {
                            return pos.instrument.symbol === symbol;
                          });

                          if (foundPosition) {
                            const positionCount = Number(foundPosition.longQuantity);
                            if (positionCount === 0) {
                              return Promise.reject({ message: `${order.holding.symbol} not found` });
                            } else {
                              const quantity = order.orderSize < positionCount ? order.orderSize : positionCount;
                              portfolioService.sendSellOrder(symbol,
                                quantity,
                                order.price,
                                'MARKET',
                                true,
                                null,
                                null)
                            }
                          }
                          return Promise.resolve({ action: 'SELL', analysis, order });
                        });
                    });
                });
            }
          }
          return Promise.resolve(analysis);
        } else {
          // return intradayPredicationService.train(symbol,
          //   moment().add({ days: 1 }).format('YYYY-MM-DD'),
          //   moment().subtract({ days: 4 }).format('YYYY-MM-DD'),
          //   0.5,
          //   null);
        }
        return Promise.resolve({ action: 'none', analysis });
      });
  }
}

export default new OrderingService();
