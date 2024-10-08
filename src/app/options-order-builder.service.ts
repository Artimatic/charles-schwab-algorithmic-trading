import { Injectable } from '@angular/core';
import crc from 'crc';
import { BacktestService, CartService, PortfolioInfoHolding } from '@shared/services';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { OptionsDataService } from '@shared/options-data.service';
import { Options } from '@shared/models/options';

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
  constructor(private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private optionsDataService: OptionsDataService,
    private backtestService: BacktestService
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

  addTradingPairs(orders: SmartOrder[]) {
    const hashValue = this.getTradeHashValue(orders);
    this.tradingPairDate[hashValue] = new Date().valueOf();
    this.tradingPairs.push(orders);
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

  async createProtectivePutOrder(holding: PortfolioInfoHolding) {
    if (holding.shares && !holding.primaryLegs) {
      let putsNeeded = Math.floor(holding.shares / 100);

      putsNeeded -= this.protectivePutCount(holding);
      console.log(putsNeeded, 'Protective puts needed for', holding.name);
      if (putsNeeded > 0) {
        const putOption = await this.strategyBuilderService.getCallStrangleTrade(holding.name);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(putOption.put.bid, putOption.put.ask);
        if (estimatedPrice < 3) {
          console.log(`Protective put price for ${holding.name} is too low`, estimatedPrice);
          return;
        }
        this.cartService.addOptionOrder(holding.name, [putOption.put],
          estimatedPrice, putsNeeded, OrderTypes.protectivePut, 'Buy',
          'Adding protective put');
      }
    }
  }

  async createTradingPair(currentHoldings = null, minCashAllocation: number, maxCashAllocation: number) {
    this.strategyBuilderService.getTradingStrategies().forEach(async (strat) => {
      const buys: string[] = strat.strategy.buy;
      const sells: string[] = strat.strategy.sell;
      await this.balanceTrades(currentHoldings, buys, sells, minCashAllocation, maxCashAllocation);
    });
  }

  async balanceTrades(currentHoldings = null, buyList: string[], sellList: string[], minCashAllocation: number, maxCashAllocation: number) {
    for (const buy of buyList) {
      const buyOptionsData = await this.optionsDataService.getImpliedMove(buy).toPromise();
      if (buyOptionsData && buyOptionsData.move && buyOptionsData.move < 0.16) {
        const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(buy);
        if (!bullishStrangle || !bullishStrangle.call) {
          console.log('Unable to find call for', buy);
        } else {
          const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;
          let currentCall = {
            call: bullishStrangle.call,
            price: callPrice,
            quantity: 0,
            underlying: buy
          };
          let currentPut = null;
          if (callPrice > 200 && callPrice < 8000) {
            for (const sell of sellList) {
              if (!currentHoldings || !currentHoldings.find(holding => holding.name === sell)) {
                const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
                if (!bearishStrangle || !bearishStrangle.put) {
                  console.log('Unable to find put for', sell);
                } else {
                  const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
                  if (putPrice > 200 && putPrice < 8000) {
                    const sellOptionsData = await this.optionsDataService.getImpliedMove(sell).toPromise();
                    if (sellOptionsData && sellOptionsData.move && sellOptionsData.move < 0.15) {
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

            if (currentPut && currentCall) {
              const option1 = this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call], currentCall.price, currentCall.quantity, OrderTypes.call, 'Buy', currentCall.quantity);
              const option2 = this.cartService.createOptionOrder(currentPut.underlying, [currentPut.put], currentPut.price, currentPut.quantity, OrderTypes.put, 'Buy', currentCall.quantity);

              this.addTradingPairs([option1, option2]);
            }
          } else {
            console.log('Call price too low or high', bullishStrangle.call, callPrice);
          }
        }
      }
    }
  }

  getCallPutQuantities(callPrice, callQuantity, putPrice, putQuantity, multiple = 1, minCashAllocation: number, maxCashAllocation: number) {
    while (Math.abs((callPrice * callQuantity) - (putPrice * putQuantity)) > 140 &&
      callQuantity + putQuantity < 15 && ((callPrice * callQuantity) + (putPrice * putQuantity)) <= maxCashAllocation
      && ((callPrice * callQuantity) + (putPrice * putQuantity)) >= minCashAllocation) {
      if (callPrice > putPrice) {
        callQuantity++;
        putQuantity *= multiple;
      } else {
        putQuantity++;
        callQuantity *= multiple;
      }
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

  async shouldBuyStrangle(symbol: string) {
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const lastPrice = price[symbol].quote.lastPrice;
    const closePrice = price[symbol].quote.closePrice;
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);

    if (!backtestResults.averageMove) {
      backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
    }
    if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
      if (Math.abs(lastPrice - closePrice) < (backtestResults.averageMove * 0.85)) {
        return true;
      }
    }

    return false;
  }

  async shouldBuyOption(symbol: string) {
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const lastPrice = price[symbol].quote.lastPrice;
    const closePrice = price[symbol].quote.closePrice;
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);

    if (!backtestResults.averageMove) {
      backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
    }
    if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
      if (Math.abs(lastPrice - closePrice) < (backtestResults.averageMove * 0.7)) {
        return true;
      }
    }

    return false;
  }
}
