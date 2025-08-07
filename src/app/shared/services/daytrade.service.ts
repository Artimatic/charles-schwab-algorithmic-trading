import { Injectable } from '@angular/core';
import { BacktestService } from './backtest.service';
import { PortfolioService } from './portfolio.service';
import { OrderPref } from '../enums/order-pref.enum';
import { SmartOrder } from '../models/smart-order';

import * as moment from 'moment-timezone';
import * as _ from 'lodash';
import { IndicatorsService } from './indicators.service';
import { CartService } from './cart.service';
import { CardOptions } from '../models/card-options';
import { map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

@Injectable()
export class DaytradeService {

  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private indicatorsService: IndicatorsService,
    private cartService: CartService,
    private messageService: MessageService) { }

  getDefaultOrderSize(quantity) {
    return Math.ceil(quantity / 10);
  }

  closeTrades(resolve: Function, reject: Function, handleNotFound: Function): void {
    _.forEach(this.cartService.otherOrders, (order: SmartOrder) => {
      this.portfolioService.getPrice(order.holding.symbol)
        .toPromise()
        .then((quote) => {
          const sellOrder = this.createOrder(order.holding, 'Sell', order.positionCount, quote, moment().unix());

          this.sendSell(sellOrder, 'market', resolve, reject, handleNotFound);
        });
    });
  }

  private minutesOfDay(minutes: moment.Moment) {
    return minutes.minutes() + minutes.hours() * 60;
  }

  /*
  * const timePeriod = this.daytradeService.tradePeriod(moment.unix(lastTimestamp), this.startTime, this.noonTime, this.endTime);
  * if (timePeriod === 'pre' || timePeriod === 'after') {
  *  return null;
  * }
  */
  tradePeriod(time: moment.Moment, start: moment.Moment, noon: moment.Moment, end: moment.Moment) {
    let period: String = 'pre';
    const minutes = this.minutesOfDay(time);
    if (minutes > this.minutesOfDay(start)) {
      period = 'morning';
    }
    if (minutes > this.minutesOfDay(noon)) {
      period = 'afternoon';
    }
    if (minutes > this.minutesOfDay(end)) {
      period = 'after';
    }

    return period;
  }

  parsePreferences(preferences): CardOptions {
    const config: CardOptions = {
      TakeProfit: false,
      TrailingStopLoss: false,
      StopLoss: false,
      SellAtClose: false,
      MlBuySellAtClose: false
    };

    if (preferences) {
      preferences.forEach((value) => {
        switch (value) {
          case OrderPref.TakeProfit:
            config.TakeProfit = true;
            break;
          case OrderPref.StopLoss:
            config.StopLoss = true;
            break;
          case OrderPref.SellAtClose:
            config.SellAtClose = true;
            break;
          case OrderPref.TrailingStopLoss:
            config.TrailingStopLoss = true;
            break;
          case OrderPref.MlBuySellAtClose:
            config.MlBuySellAtClose = true;
            break;
        }
      });
    }
    return config;
  }

  getOrderQuantity(maxAllowedOrders: number,
    orderSize: number,
    ordersAlreadyMade: number): number {
    if (ordersAlreadyMade >= maxAllowedOrders) {
      return 0;
    }

    if (orderSize + ordersAlreadyMade > maxAllowedOrders) {
      return maxAllowedOrders - ordersAlreadyMade;
    }

    return orderSize;
  }

  getBuyOrderQuantity(maxAllowedOrders: number,
    orderSize: number,
    ordersAlreadyMade: number,
    positionCount: number): number {
    if (positionCount > orderSize) {
      return 0;
    }

    if (ordersAlreadyMade >= maxAllowedOrders) {
      return 0;
    }

    if (orderSize + ordersAlreadyMade > maxAllowedOrders) {
      return maxAllowedOrders - ordersAlreadyMade;
    }

    return orderSize;
  }

  sendBuy(buyOrder: SmartOrder, type: string, resolve, reject) {
    if (!buyOrder.quantity) {
      return null;
    }
    this.portfolioService.buy(buyOrder.holding, buyOrder.quantity, buyOrder.price, type).subscribe(
      response => {
        resolve(response);
        setTimeout(() => {
          // After the buy order, check the portfolio to confirm the order has filled
          this.portfolioService.getTdPortfolio().subscribe(
            portfolio => {
              const filledPosition = portfolio.find(position => position.instrument.symbol === buyOrder.holding.symbol);
              if (filledPosition) {
                console.log(`Buy order for ${buyOrder.holding.symbol} filled. Current position:`, filledPosition);
              } else {
                console.warn(`Buy order for ${buyOrder.holding.symbol} may not have filled yet.`);
                this.messageService.add({ severity: 'error', summary: `Buy order for ${buyOrder.holding.symbol} as not been filled`, sticky: true });
              }
            },
            error => {
              console.error('Error fetching portfolio after buy order:', error);
            }
          );
        }, 150000);
      },
      error => {
        reject(error);
      });
    return buyOrder;
  }

  sendSell(sellOrder: SmartOrder, type: string, resolve: Function, reject: Function, handleNotFound: Function): SmartOrder {
    return this.sendTdSell(sellOrder, type, resolve, reject, handleNotFound);
  }

  closePosition(sellOrder: SmartOrder, type: string, resolve: Function, reject: Function, handleNotFound: Function): SmartOrder {
    return this.closeTdPosition(sellOrder, type, resolve, reject, handleNotFound);
  }

  sendTdSell(sellOrder: SmartOrder, type: string, resolve: Function, reject: Function, handleNotFound: Function): SmartOrder {
    this.portfolioService.getTdPortfolio()
      .subscribe(result => {
        const foundPosition = result.find((pos) => {
          return pos.instrument.symbol === sellOrder.holding.symbol;
        });

        if (foundPosition) {
          const positionCount = Number(foundPosition.longQuantity);
          if (positionCount === 0) {
            handleNotFound();
          } else {
            sellOrder.quantity = sellOrder.quantity < positionCount ? sellOrder.quantity : positionCount;

            const price = sellOrder.price;

            this.portfolioService.sell(sellOrder.holding, sellOrder.quantity, price, type).subscribe(
              response => {
                resolve(response);
              },
              error => {
                reject(error);
              });
          }
        } else {
          handleNotFound();
        }
      });
    return sellOrder;
  }

  async sendOptionSell(symbol: string, quantity: number, price: number, resolve: Function, reject: Function, handleNotFound: Function) {
    const result = await this.portfolioService.getTdPortfolio().toPromise();
    const foundPosition = result.find((pos) => {
      return pos.instrument.symbol === symbol;
    });

    if (foundPosition) {
      const positionCount = Number(foundPosition.longQuantity);
      if (positionCount === 0) {
        handleNotFound();
      } else {
        quantity = quantity < positionCount ? quantity : positionCount;

        this.portfolioService.sendOptionSell(symbol, quantity, price)
          .subscribe(
            response => {
              resolve(response);
            },
            error => {
              reject(error);
            });
      }
    } else {
      handleNotFound();
    }
  }

  closeTdPosition(sellOrder: SmartOrder, type: string, resolve: Function, reject: Function, handleNotFound: Function): SmartOrder {
    this.portfolioService.getTdPortfolio()
      .subscribe(result => {
        const foundPosition = result.find((pos) => {
          return pos.instrument.symbol === sellOrder.holding.symbol;
        });

        if (foundPosition) {
          const positionCount = Number(foundPosition.longQuantity);
          if (positionCount === 0) {
            handleNotFound();
          } else {
            sellOrder.quantity = positionCount;

            const price = sellOrder.price;

            this.portfolioService.sell(sellOrder.holding, sellOrder.quantity, price, type).subscribe(
              response => {
                resolve(response);
              },
              error => {
                reject(error);
              });
          }
        } else {
          handleNotFound();
        }
      });
    return sellOrder;
  }

  buildTileList(orders: SmartOrder[]): any[] {
    let currentList: any[] = [];
    const tiles = [];

    for (let i = 0, len = orders.length; i < len; ++i) {
      let action = orders[i].side.toLowerCase();
      if (action === 'buy') {
        action = 'Bought';
      } else if (action === 'sell') {
        action = 'Sold';
      }
      const orderRow = {
        timeSubmitted: moment(orders[i].timeSubmitted).format('DD.MM.YYYY hh:mm'),
        signalTime: moment(orders[i].signalTime).format('hh:mma'),
        quantity: orders[i].quantity,
        price: orders[i].price,
        action
      };

      currentList.push(orderRow);
      if (currentList.length >= 5) {
        tiles.push({ orders: currentList, cols: 1, rows: 1 });
        currentList = [];
      }
    }

    tiles.push({ orders: currentList, cols: 1, rows: 1 });
    return tiles;
  }

  createOrder(holding, side: string, quantity: number, price: number, signalTime: number): SmartOrder {
    return {
      holding: holding,
      quantity: quantity,
      price: _.round(Number(price), 2),
      submitted: false,
      pending: false,
      side: side,
      timeSubmitted: moment().utc().format(),
      signalTime: moment.unix(signalTime).valueOf()
    };
  }

  getPercentChange(currentPrice: number, boughtPrice: number) {
    if (boughtPrice === 0 || currentPrice === boughtPrice) {
      return 0;
    } else {
      return _.round((currentPrice - boughtPrice) / boughtPrice, 3);
    }
  }

  calculatePercentDifference(v1, v2) {
    return Math.abs(Math.abs(v1 - v2) / ((v1 + v2) / 2));
  }

  addQuote(data, newQuote) {
    const quotes = data.chart.result[0].indicators.quote[0];
    quotes.close[quotes.close.length - 1] = 1 * newQuote;
    return data;
  }

  createNewChart() {
    return {
      chart: {
        result: [
          {
            timestamp: [],
            indicators: {
              quote: [
                {
                  low: [],
                  volume: [],
                  open: [],
                  high: [],
                  close: []
                }
              ]
            }
          }
        ]
      }
    };
  }

  getSubArray(reals: number[], period) {
    return _.slice(reals, reals.length - (period + 1));
  }

  estimateAverageBuyOrderPrice(orders: SmartOrder[]): number {
    if (orders.length === 0) {
      return 0;
    }

    const finalPositions: SmartOrder[] = [];

    _.forEach(orders, (currentOrder: SmartOrder) => {
      if (currentOrder.side.toLowerCase() === 'sell') {
        let sellSize: number = currentOrder.quantity;
        let i = 0;
        while (sellSize > 0 && i < finalPositions.length) {
          if (finalPositions[i].side.toLowerCase() === 'buy') {
            if (finalPositions[i].quantity > sellSize) {
              finalPositions[i].quantity -= sellSize;
              sellSize = 0;
            } else {
              const removed = finalPositions.shift();
              sellSize -= removed.quantity;
              i--;
            }
          }
          i++;
        }
      } else if (currentOrder.side.toLowerCase() === 'buy') {
        finalPositions.push(currentOrder);
      }
    });

    let sum = 0;
    let size = 0;

    _.forEach(finalPositions, (pos: SmartOrder) => {
      sum += _.multiply(pos.quantity, pos.price);
      size += pos.quantity;
    });

    if (sum === 0 || size === 0) {
      return 0;
    }

    return _.round(_.divide(sum, size), 2);
  }

  /*
  * Estimate the profit/loss of the last sell order
  */
  estimateSellProfitLoss(symbol: string) {
    return this.portfolioService.getTdPortfolio()
      .pipe(map((response) => {
        const foundPosition = response.find((pos) => {
          return pos.instrument.symbol === symbol;
        });
        if (foundPosition) {
          console.log('Found position', foundPosition, foundPosition.currentDayProfitLoss);
          return foundPosition.currentDayProfitLoss;
        }
        return null;
      }));
  }

  findMostCurrentQuoteIndex(quotes, firstIndex, lastIndex) {
    // TODO: Replace with real time quote
    let ctr = 1,
      tFirstIndex = firstIndex,
      tLastIndex = lastIndex;

    while (!quotes[tLastIndex] && quotes[tFirstIndex] && ctr < 3) {
      tFirstIndex = firstIndex - ctr;
      tLastIndex = lastIndex - ctr;
      if (quotes[tFirstIndex] && quotes[tLastIndex]) {
        firstIndex = tFirstIndex;
        lastIndex = tLastIndex;
        break;
      } else if (!quotes[tFirstIndex]) {
        break;
      }
      ctr++;
    }
    return { firstIndex, lastIndex };
  }

  convertToFixedNumber(num, sig) {
    return _.round(Number(num), sig);
  }

  convertHistoricalQuotes(backtestQuotes) {
    const data = {
      chart: {
        result: [
          {
            timestamp: [],
            indicators: {
              quote: [
                {
                  low: [],
                  volume: [],
                  open: [],
                  high: [],
                  close: []
                }
              ]
            }
          }
        ]
      }
    };

    _.forEach(backtestQuotes, (historicalData) => {
      const date = moment(historicalData.date);
      data.chart.result[0].timestamp.push(date.unix());
      data.chart.result[0].indicators.quote[0].close.push(historicalData.close);
      data.chart.result[0].indicators.quote[0].low.push(historicalData.low);
      data.chart.result[0].indicators.quote[0].volume.push(historicalData.volume);
      data.chart.result[0].indicators.quote[0].open.push(historicalData.open);
      data.chart.result[0].indicators.quote[0].high.push(historicalData.high);
    });

    return data;
  }

  getIntradayYahoo(symbol: string) {
    return this.backtestService.getIntradayV3({
      symbol,
      interval: '1m',
      range: '1d'
    })
      .toPromise()
      .then((quotes) => {
        quotes.chart.result[0].indicators.quote[0].close =
          this.indicatorsService.fillInMissingReals(_.get(quotes, 'chart.result[0].indicators.quote[0].close'));
        return this.portfolioService.getPrice(symbol)
          .toPromise()
          .then((quote) => {
            return this.addQuote(quotes, quote);
          });
      });
  }

  async sellDefaultHolding() {
    const default1 = 'VTI';
    const default2 = 'UPRO';
    const data = await this.portfolioService.getTdPortfolio()
      .pipe().toPromise();

    if (data) {
      for (const holding of data) {
        if (holding.instrument.symbol === default1) {
          const price = await this.portfolioService.getPrice(default1).toPromise();
          const order = this.cartService.buildOrder(default1, holding.longQuantity, price, 'Sell');
          this.sendSell(order, 'limit', () => { }, () => { }, () => { });
        } else if (holding.instrument.symbol === default2) {
          const price = await this.portfolioService.getPrice(default2).toPromise();
          const order = this.cartService.buildOrder(default2, holding.longQuantity, price, 'Sell');
          this.sendSell(order, 'limit', () => { }, () => { }, () => { });
        }
      }
    }
  }
}
