import { Injectable } from '@angular/core';
import crc from 'crc';
import * as moment from 'moment-timezone';
import { BacktestService, CartService, PortfolioInfoHolding, ReportingService } from '@shared/services';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { OptionsDataService } from '@shared/options-data.service';
import { Options } from '@shared/models/options';
import { OrderHandlingService } from './order-handling/order-handling.service';
import { PriceTargetService } from './autopilot/price-target.service';

export interface TradingPair {
  put?: Options;
  call?: Options;
  quantity: number;
  price: number;
  underlying: string;
}

@Injectable({
  providedIn: 'root'
})
export class OptionsOrderBuilderService {
  tradingPairs: SmartOrder[][] = [];
  tradingPairDate = {};
  tradingPairMaxLife = 432000000;
  tradingPairsCounter = 0;
  currentTradeIdeas = { calls: [], puts: [] };
  maxImpliedMovement = 0.14;
  constructor(private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private optionsDataService: OptionsDataService,
    private backtestService: BacktestService,
    private reportingService: ReportingService,
    private orderHandlingService: OrderHandlingService,
    private priceTargetService: PriceTargetService
  ) { }

  private protectivePutCount(holding: PortfolioInfoHolding): number {
    if (holding.shares) {
      if (!holding.primaryLegs && holding.secondaryLegs) {
        if (holding.secondaryLegs[0].putCallInd === 'P') {
          return holding.secondaryLegs.reduce((acc, curr) => acc + curr.quantity, 0);
        }
      } else if (holding.primaryLegs && !holding.secondaryLegs) {
        if (holding.primaryLegs[0].putCallInd === 'P') {
          return holding.primaryLegs.reduce((acc, curr) => acc + curr.quantity, 0);
        }
      }
    }

    return 0;
  }

  private getHashValue(value: string) {
    return crc.crc32(value).toString(16);
  }

  getTradeHashValue(arr: SmartOrder[]) {
    const str = arr.reduce((acc: string, val: SmartOrder) => {
      if (!val || !val.holding) {
        return acc;
      }
      return acc + val.holding.symbol;
    }, '');
    return this.getHashValue(str);
  }

  getTradingPairs() {
    this.tradingPairs = this.tradingPairs.filter(val => {
      return !this.tradingPairDate[this.getTradeHashValue(val)]
        || Math.abs(new Date().valueOf() - this.tradingPairDate[this.getTradeHashValue(val)]) < this.tradingPairMaxLife;
    });
    return this.tradingPairs;
  }

  addTradingPairs(orders: SmartOrder[], reason) {
    const hashValue = this.getTradeHashValue(orders);
    this.tradingPairDate[hashValue] = new Date().valueOf();
    this.tradingPairs.push(orders);
    const calls = [];
    const puts = [];
    orders.forEach(order => {
      if (order.type === OrderTypes.call) {
        calls.push(order.holding.symbol);
      } else if (order.type === OrderTypes.put) {
        puts.push(order.holding.symbol);
      }
    });
    if (calls.length && puts.length) {
      this.strategyBuilderService.createStrategy('Pair', calls[0], calls, puts, reason);
    } else if (calls.length) {
      this.currentTradeIdeas.calls.push(calls[0]);
      if (this.currentTradeIdeas.puts.length) {
        this.strategyBuilderService.createStrategy('Pair', this.currentTradeIdeas.calls[0], this.currentTradeIdeas.calls, this.currentTradeIdeas.puts, reason);
        this.clearCurrentTradeIdeas();
      }
    } else if (puts.length) {
      this.currentTradeIdeas.puts.push(puts[0]);
      if (this.currentTradeIdeas.calls.length) {
        this.strategyBuilderService.createStrategy('Pair', this.currentTradeIdeas.calls[0], this.currentTradeIdeas.calls, this.currentTradeIdeas.puts, reason);
        this.clearCurrentTradeIdeas();
      }
    }
  }

  removeTradingPair(symbol1: string, symbol2: string = null) {
    this.tradingPairs = this.tradingPairs.filter((pair: SmartOrder[]) => pair[0].holding.symbol !== symbol1);
    this.tradingPairs = this.tradingPairs.filter((pair: SmartOrder[]) => {
      if (!symbol2) {
        return pair[0].holding.symbol !== symbol1;
      }
      return pair[0].holding.symbol !== symbol1 && pair[1].holding.symbol !== symbol2
    });

  }

  clearTradingPairs() {
    this.tradingPairs = [];
  }

  async addOptionByBalance(symbol: string, targetBalance: number, reason: string, isCall: boolean, addOrderRightAway = true) {
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);
    if (backtestResults?.impliedMovement > 0.1) {
      return this.reportingService.addAuditLog(symbol, `Implied movement too high for ${symbol}: ${backtestResults.impliedMovement}`);
    }
    const optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
    const bid = isCall ? optionStrategy.call.bid : optionStrategy.put.bid;
    const ask = isCall ? optionStrategy.call.ask : optionStrategy.put.ask;
    const price = this.strategyBuilderService.findOptionsPrice(bid, ask) * 100;
    let currentOption = {
      call: optionStrategy.call,
      put: optionStrategy.put,
      price: price,
      quantity: Math.floor(targetBalance / price) || 1,
      underlying: symbol
    };

    const option = isCall ? currentOption.call : currentOption.put;
    if (addOrderRightAway) {
      this.cartService.addSingleLegOptionOrder(currentOption.underlying, [option], price, currentOption.quantity || 1,
        isCall ? OrderTypes.call : OrderTypes.put, 'Buy', reason);
    } else {

      let order = this.cartService.createOptionOrder(symbol, [option],
        price, currentOption.quantity || 1,
        isCall ? OrderTypes.call : OrderTypes.put, reason, 'Buy',
        null, false);
      this.addTradingPairs([order], reason);
    }
  }

  async createProtectivePutOrder(holding: PortfolioInfoHolding) {
    if (holding.shares && !holding.primaryLegs) {
      let putsNeeded = Math.floor(holding.shares / 100);

      putsNeeded -= this.protectivePutCount(holding);
      if (putsNeeded > 0) {
        const putOption = await this.strategyBuilderService.getCallStrangleTrade(holding.name);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(putOption.put.bid, putOption.put.ask);
        if (estimatedPrice < 1) {
          console.log(`Protective put price for ${holding.name} is too low`, estimatedPrice);
          return;
        }

        this.addOptionByBalance(holding.name, estimatedPrice, 'Protective put', false, false);
      }
    }
  }

  async createTradingPair(currentHoldings = null, minCashAllocation: number, maxCashAllocation: number) {
    this.strategyBuilderService.getTradingStrategies().forEach(async (strat) => {
      const buys: string[] = strat.strategy.buy;
      const sells: string[] = strat.strategy.sell;
      await this.balanceTrades(currentHoldings, buys, sells, minCashAllocation, maxCashAllocation, strat.reason ? strat.reason : 'Trading pair');
    });
  }

  clearCurrentTradeIdeas() {
    this.currentTradeIdeas = { calls: [], puts: [] };
  }

  async balanceTrades(currentHoldings = null,
    buyList: string[],
    sellList: string[],
    minCashAllocation: number,
    maxCashAllocation: number,
    reason: string,
    addToList = true) {
    if (minCashAllocation === maxCashAllocation) {
      minCashAllocation = 0;
    }
    for (const buy of buyList) {
      const buyOptionsData = await this.optionsDataService.getImpliedMove(buy).toPromise();
      if (buyOptionsData && buyOptionsData.move && buyOptionsData.move < this.maxImpliedMovement) {
        const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(buy);
        if (bullishStrangle && bullishStrangle.call) {
          const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;
          let currentCall = {
            call: bullishStrangle.call,
            price: callPrice,
            quantity: 0,
            underlying: buy
          };
          let currentPut = null;
          if (callPrice > 150 && callPrice < 3500 &&
            callPrice >= (minCashAllocation / 100) &&
            callPrice <= (maxCashAllocation / 2)) {
            for (const sell of sellList) {
              if (!currentHoldings || !currentHoldings.find(holding => holding.name === sell)) {
                const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
                if (bearishStrangle && bearishStrangle.put) {
                  const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
                  if (putPrice > 150 && putPrice < 3500 &&
                    putPrice >= (minCashAllocation / 100) &&
                    putPrice <= (maxCashAllocation / 2)) {
                    const sellOptionsData = await this.optionsDataService.getImpliedMove(sell).toPromise();
                    if (sellOptionsData && sellOptionsData.move && sellOptionsData.move < this.maxImpliedMovement) {
                      const multiple = (callPrice > putPrice) ? Math.round(callPrice / putPrice) : Math.round(putPrice / callPrice);
                      let initialCallQuantity = (callPrice > putPrice) ? 1 : multiple;
                      let initialPutQuantity = (callPrice > putPrice) ? multiple : 1;
                      const { callQuantity, putQuantity } = this.getCallPutQuantities(callPrice, initialCallQuantity, putPrice, initialPutQuantity, multiple, minCashAllocation, maxCashAllocation);
                      if (callQuantity + putQuantity < 25) {
                        bullishStrangle.call.quantity = callQuantity;
                        bearishStrangle.put.quantity = putQuantity;
                        const availableFunds = await this.cartService.getAvailableFunds(true);
                        if (availableFunds >= (callPrice * callQuantity + putPrice * putQuantity)) {
                          if (!currentPut || (currentCall.quantity * currentCall.price +
                            currentPut.quantity * currentPut.price) > (currentCall.quantity * currentCall.price + putQuantity * putPrice)) {
                            currentCall.quantity = callQuantity;
                            if (currentPut) {
                              currentPut.put = bearishStrangle.put;
                              currentPut.quantity = putQuantity;
                              currentPut.price = putPrice;
                              currentPut.underlying = sell;
                            } else {
                              currentPut = {
                                put: bearishStrangle.put,
                                price: putPrice,
                                quantity: putQuantity,
                                underlying: sell
                              };
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            if (currentPut && currentCall && (currentCall.price * currentCall.quantity) + (currentPut.price * currentPut.quantity) <= maxCashAllocation) {
              const option1 = this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call],
                currentCall.price, currentCall.quantity,
                OrderTypes.call, reason,
                'Buy', currentCall.quantity);
              const option2 = this.cartService.createOptionOrder(currentPut.underlying, [currentPut.put],
                currentPut.price, currentPut.quantity,
                OrderTypes.put, reason,
                'Buy', currentCall.quantity);

              if (addToList) {
                this.reportingService.addAuditLog(null,
                  `Trading pair ${option1?.primaryLegs[0]?.symbol} ${option2?.primaryLegs[0]?.symbol}. Reason: ${reason}, Min cash: ${minCashAllocation}, Max cash: ${maxCashAllocation}`);
                this.addTradingPairs([option1, option2], reason);
              }

              // const endDate = moment().format('YYYY-MM-DD');
              // const startDate = moment().subtract({ day: 600 }).format('YYYY-MM-DD');

              // const range = 10;
              // const limit = 0.001;
              // this.machineLearningService.trainTradingPair(currentCall.underlying,
              //   currentPut.underlying, endDate, startDate, 0.8, null, range, limit).subscribe();
              return [option1, option2];
            }
          } else {
            if (callPrice < minCashAllocation) {
              console.log('Call price too low', bullishStrangle.call, 'price:', callPrice, 'min:', minCashAllocation, 'max:', maxCashAllocation);

            } else if (callPrice > maxCashAllocation) {
              console.log('Call price too high', bullishStrangle.call, 'price:', callPrice, 'min:', minCashAllocation, 'max:', maxCashAllocation);
            }
          }
        }
      }
    }
    return null;
  }

  getCallPutQuantities(callPrice,
    callQuantity,
    putPrice,
    putQuantity,
    multiple = 1,
    minCashAllocation: number,
    maxCashAllocation: number) {
    while (Math.abs((callPrice * callQuantity) - (putPrice * putQuantity)) > 600 &&
      Math.abs((callPrice * callQuantity) - (putPrice * putQuantity)) <= maxCashAllocation) {
      if (callPrice > putPrice) {
        callQuantity++;
        putQuantity *= multiple;
      } else {
        putQuantity++;
        callQuantity *= multiple;
      }
    }

    let commonMaximum = 1;
    while (((callPrice * (callQuantity * commonMaximum)) + (putPrice * (putQuantity * commonMaximum))) <= maxCashAllocation &&
      ((callPrice * (callQuantity * commonMaximum)) + (putPrice * (putQuantity * commonMaximum))) < minCashAllocation) {
      commonMaximum++;
    }

    callQuantity *= commonMaximum;
    putQuantity *= commonMaximum;
    if ((callPrice * callQuantity) + (putPrice * putQuantity) > maxCashAllocation) {
      callQuantity = 0;
      putQuantity = 0;
    }

    return { callQuantity, putQuantity };
  }

  async hedgeCallTrade(stock: string, quantity: number, currentHoldings: PortfolioInfoHolding[]) {
    const tradingPairs = JSON.parse(localStorage.getItem('tradingPairs'));
    const foundPairs = tradingPairs.find(s => s.name === stock);
    if (foundPairs) {
      const existingHedges = currentHoldings.reduce((acc, holding) => {
        if (foundPairs.find(pair => pair.symbol === holding.name) &&
          holding.primaryLegs &&
          holding.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
          acc.push(holding);
        }
        return acc;
      }, []);

    }
    const pairTrades = this.strategyBuilderService.getTradingStrategies().find(s => s.name === stock);
    const foundCurrentHoldingHedge = currentHoldings.find(ch => pairTrades.strategy.sell.find(s => s === ch.name));
    let hedgeUnderlyingStock;
    if (foundCurrentHoldingHedge) {
      hedgeUnderlyingStock = foundCurrentHoldingHedge.name;
    } else {
      let foundBearishStrangle = null;
      let foundPrice = null;
      hedgeUnderlyingStock = pairTrades.strategy.sell.find(async (stockSymbol: string) => {
        const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(stockSymbol);
        const price = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
        if (price > 500) {
          foundBearishStrangle = bearishStrangle;
          foundPrice = price;
          return true;
        }
        return false;
      });
    }
    if (!hedgeUnderlyingStock) {
      return false;
    }
    const bullishStrangle = await this.strategyBuilderService.getPutStrangleTrade(hedgeUnderlyingStock);
    const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;

    //const { callQuantity, putQuantity } = this.getCallPutQuantities(callPrice, initialCallQuantity, putPrice, initialPutQuantity, multiple);
    return true;
  }

  hedgePutTrade(stock: string, quantity: number, currentHoldings: PortfolioInfoHolding[]) {
    const tradingPairs = JSON.parse(localStorage.getItem('tradingPairs'));
    const foundPairs = tradingPairs.find(s => s.name === stock);
    if (foundPairs) {
      const existingHedges = currentHoldings.reduce((acc, holding) => {
        if (foundPairs.find(pair => pair.symbol === holding.name) &&
          holding.primaryLegs &&
          holding.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
          acc.push(holding);
        }
        return acc;
      }, []);

    }
  }

  isExpiring(holding: PortfolioInfoHolding) {
    return (holding.primaryLegs ? holding.primaryLegs : []).concat(holding.secondaryLegs ? holding.secondaryLegs : []).find((option: Options) => {
      const expiry = option.description.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)[0];
      return moment(expiry).diff(moment(), 'days') < 30;
    });
  }

  async shouldBuyStrangle(symbol: string) {
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const lastPrice = price[symbol].quote.lastPrice;
    const closePrice = price[symbol].quote.closePrice;
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);

    if (!backtestResults.averageMove) {
      backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
    }
    if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
      if ((Math.abs(lastPrice - closePrice) < backtestResults.averageMove * 0.85) || (Math.abs(this.priceTargetService.getDiff(closePrice, lastPrice)) < backtestResults.impliedMovement * 0.3)) {
        return true;
      }
    }

    return false;
  }

  async getImpliedMove(symbol, backtestResults) {
    if (backtestResults?.impliedMovement) {
      return backtestResults.impliedMovement;
    } else {
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const lastPrice = price[symbol].quote.lastPrice;
      return (backtestResults.averageMove / lastPrice) * 3;
    }
  }
  async shouldBuyOption(symbol: string) {
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const lastPrice = price[symbol].quote.lastPrice;
    const closePrice = price[symbol].quote.closePrice;
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);

    const impliedMove = await this.getImpliedMove(symbol, backtestResults)
    const currentDiff = this.priceTargetService.getDiff(closePrice, lastPrice);
    if (backtestResults && backtestResults.ml !== null) {
      if (currentDiff < (((1 / (impliedMove + 0.01)) * 0.01))) {
        return true;
      }
    }

    return false;
  }

  async shouldSellOptions(holding: PortfolioInfoHolding, isStrangle: boolean, putCallInd: string) {
    if (this.isExpiring(holding)) {
      const log = `${holding.name} options are expiring soon`;
      this.reportingService.addAuditLog(holding.name, log);
      return true;
    } else if (!this.getTradingPairs().find(tradeArr => tradeArr.find(t => t.holding.symbol === holding.name))) {
      const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
      const price = await this.backtestService.getLastPriceTiingo({ symbol: holding.name }).toPromise();
      const lastPrice = price[holding.name].quote.lastPrice;
      const closePrice = price[holding.name].quote.closePrice;
      const impliedMove = await this.getImpliedMove(holding.name, backtestResults)
      const currentDiff = this.priceTargetService.getDiff(closePrice, lastPrice);
      if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
        if (isStrangle && Math.abs(currentDiff) > impliedMove) {
          this.reportingService.addAuditLog(holding.name, `Selling strangle due to large move ${Math.abs(lastPrice - closePrice)}, Average: ${backtestResults.averageMove}`);
          return true;
        } else if (putCallInd.toLowerCase() === 'c' && currentDiff > impliedMove) {
          this.reportingService.addAuditLog(holding.name, `Selling call due to large move ${closePrice - lastPrice}, Average: ${backtestResults.averageMove}`);
          return true;
        } else if (putCallInd.toLowerCase() === 'p' && currentDiff < (impliedMove * -1)) {
          this.reportingService.addAuditLog(holding.name, `Selling put due to large move ${closePrice - lastPrice}, Average: ${backtestResults.averageMove}`);
          return true;
        }
      }
    }
    return false;
  }


  async sellStrangle(holding: PortfolioInfoHolding) {
    if (this.cartService.isStrangle(holding)) {
      const seenPuts = {};
      const seenCalls = {};
      holding.primaryLegs.concat(holding.secondaryLegs).forEach((option: Options) => {
        const putCall = option.putCallInd;
        const expiry = option.description.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)[0];
        if (putCall === 'C') {
          if (!seenCalls[expiry]) {
            seenCalls[expiry] = [];
          }
          seenCalls[expiry].push(option);
        } else if (putCall === 'P') {
          if (!seenPuts[expiry]) {
            seenPuts[expiry] = [];
          }
          seenPuts[expiry].push(option);
        }
      });

      for (const key in seenCalls) {
        if (seenPuts[key]) {
          const fullOrderList = seenCalls[key].concat(seenPuts[key]);
          let fullPrice = 0;
          for (let i = 0; i < fullOrderList.length; i++) {
            fullPrice += await this.orderHandlingService.getEstimatedPrice(fullOrderList[i].symbol);
          }
          this.cartService.addSellStrangleOrder(holding.name, holding.primaryLegs, holding.secondaryLegs, fullPrice, holding.primaryLegs[0].quantity);
        }
      }
    }
  }

  addTradingPair(trade, reason: string) {
    const tradePairOrder = trade[0];
    tradePairOrder.secondaryLegs = trade[1].primaryLegs;
    this.cartService.addToCart(tradePairOrder, true, reason);
    this.removeTradingPair(trade[0].holding.symbol, trade[1].holding.symbol);
  }

  async checkCurrentOptions(currentHoldings: PortfolioInfoHolding[]) {
    this.reportingService.addAuditLog(null, 'Check current options');

    currentHoldings.forEach(async (holding) => {
      if (holding.primaryLegs) {
        const callPutInd = holding.primaryLegs[0].putCallInd.toLowerCase();
        const isStrangle = this.cartService.isStrangle(holding);
        const shouldSell = await this.shouldSellOptions(holding, isStrangle, callPutInd);

        if (isStrangle) {
          if (shouldSell) {
            await this.sellStrangle(holding);
          }
        } else {
          let orderType = null;
          const backtestData = await this.strategyBuilderService.getBacktestData(holding.name);
          if (callPutInd === 'c') {
            orderType = OrderTypes.call;
            if (shouldSell || (backtestData && backtestData.sellMl > 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL'))) {
              const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
              const reason = shouldSell ? 'Should sell options' : 'Backtest recommends selling';
              this.cartService.addSingleLegOptionOrder(holding.name, [holding.primaryLegs[0]], estPrice, holding.primaryLegs[0].quantity, orderType, 'Sell', reason);
            }
          } else if (callPutInd === 'p') {
            orderType = OrderTypes.put;
            if (shouldSell || (backtestData && backtestData.ml > 0.5 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY'))) {
              const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
              const reason = shouldSell ? 'Should sell options' : 'Backtest recommends selling';
              this.cartService.addSingleLegOptionOrder(holding.name, [holding.primaryLegs[0]], estPrice, holding.primaryLegs[0].quantity, orderType, 'Sell', reason);
            }
          }
        }
      }
    });

    if (this.tradingPairsCounter >= this.getTradingPairs().length) {
      this.tradingPairsCounter = 0;
    }
    const trade = this.getTradingPairs()[this.tradingPairsCounter];
    if (trade) {
      if (trade.length === 1) {
        const shouldBuy = await this.shouldBuyOption(trade[0].holding.symbol);
        if (shouldBuy) {
          const reason = trade[0].reason ? trade[0].reason : 'Low volatility';
          this.cartService.addToCart(trade[0], true, reason);
          this.removeTradingPair(trade[0].holding.symbol);
        }
      } else {
        const shouldBuy = await this.shouldBuyOption(trade[0].holding.symbol);
        if (shouldBuy) {
          this.addTradingPair(trade, trade[0].reason ? trade[0].reason : 'Low volatility');
        }
      }
    } else if (trade.length === 2 && trade[0] && trade[1]) {
      const shouldBuyCall = await this.shouldBuyOption(trade[0].holding.symbol);
      const shouldBuyPut = await this.shouldBuyOption(trade[1].holding.symbol);
      if (shouldBuyCall && shouldBuyPut) {
        this.addTradingPair(trade, trade[0].reason ? trade[0].reason : 'Low volatility');
      }
    }

    this.tradingPairsCounter++;
  }
}
