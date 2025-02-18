
import * as _ from 'lodash';
import { Order } from './order.interface';
import backtestService from '../backtest/backtest.service';
import intradayPredicationService from '../machine-learning/intraday-prediction.service';

import { Indicators } from '../backtest/backtest.constants';
import * as moment from 'moment-timezone';
import portfolioService from '../portfolio/portfolio.service';

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
      return (order.buyCount >= order.quantity || order.positionCount >= order.quantity);
    } else if (orderSide === 'SELL' || order.positionCount <= 0) {
      return order.sellCount >= order.quantity;
    }
  }

  private incrementSell(order: Order) {
    console.log('Sent sell order', order);
    order.sellCount += order.orderSize;
    order.positionCount -= order.orderSize;

    return order
  }

  private incrementBuy(order: Order) {
    console.log('Sent buy order', order);
    order.buyCount += order.orderSize;
    order.positionCount += order.orderSize;

    return order
  }

  private getOrderSize(orderQuantity: number, price: number, currentBalance: number) {
    if (price * orderQuantity < currentBalance) {
      return orderQuantity;
    } else {
      return Math.floor(currentBalance / price);
    }
  }

  private handleSellStock(symbol: string, order: Order, analysis) {
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
            order = this.incrementSell(order);
            order.orderSize = order.orderSize < positionCount ? order.orderSize : positionCount;
            return portfolioService.sendSellOrder(symbol,
              order.orderSize,
              order.price,
              'MARKET',
              true,
              null,
              null).
              then(res => {
                return Promise.resolve({ action: 'SELL', analysis, order, response: res });
              }).catch((error) => {
                return Promise.reject({ action: 'SELL', analysis, order, error });
              });
          }
        }
        return Promise.reject({ action: 'SELL', analysis, order, error: `${order.holding.symbol} not found` });
      });
  }

  private handleBuyStock(symbol: string, order: Order, analysis) {
    return portfolioService.getTdBalance(null, null)
      .then((balance) => {
        order.orderSize = this.getOrderSize(order.orderSize, order.price, balance.cashBalance);
        order = this.incrementBuy(order);
        return portfolioService.sendBuyOrder(symbol, order.orderSize, order.price, null, true, null, null)
          .then((response) => {
            return Promise.resolve({ action: 'BUY', analysis, order, response });
          }).catch((error) => {
            return Promise.reject({ action: 'BUY', analysis, order, error });
          });
      });
  }

  private shouldSellStock(order, analysis) {
    return !this.isOptionOrder(order) && order.side.toUpperCase() === 'SELL' && (order.forImmediateExecution || (analysis?.recommendation?.toUpperCase() === 'SELL'));
  }

  private shouldBuyStock(order, analysis) {
    return !this.isOptionOrder(order) && order.side.toUpperCase() === 'BUY' && (order.forImmediateExecution || (analysis?.recommendation?.toUpperCase() === 'BUY'));
  }

  processOrder(symbol, order: Order, analysis) {
    if (this.shouldSellStock(order, analysis)) {
      return this.handleSellStock(symbol, order, analysis);
    } else if (this.shouldBuyStock(order, analysis)) {
      return this.handleBuyStock(symbol, order, analysis);
    }
    return Promise.resolve({ action: 'none' });

  }
  processStockRecommendation(order: Order) {
    if (this.hasReachedOrderLimit(order)) {
      return Promise.reject('Order limit reached');
    }
    const symbol = order.holding.symbol.toUpperCase();
    if (order.forImmediateExecution) {
      return this.processOrder(symbol, order, null);
    }
    return backtestService.getCurrentDaytradeIndicators(symbol, 81, 'td')
      .then((technicalAnalysis: Indicators) => {
        // TODO: Set current price and paid price on order
        const analysis = backtestService.getDaytradeRecommendation(symbol, order.price, order.paidPrice, { lossThreshold: order.lossThreshold, profitThreshold: order.profitTarget }, technicalAnalysis);
        console.log('analysis', analysis);

        return this.processOrder(symbol, order, null);

        // return intradayPredicationService.train(symbol,
        //   moment().add({ days: 1 }).format('YYYY-MM-DD'),
        //   moment().subtract({ days: 4 }).format('YYYY-MM-DD'),
        //   0.5,
        //   null);
      });
  }
}

export default new OrderingService();
