import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding } from '@shared/services';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { OrderTypes } from '@shared/models/smart-order';
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

  async createProtectivePutOrder(holding: PortfolioInfoHolding) {
    if (holding.shares && holding.assetType === 'equity') {
      let putsNeeded = Math.floor(holding.shares / 100);

      putsNeeded -= this.protectivePutCount(holding);
      console.log('Protective puts needed', holding.name, putsNeeded);
      if (putsNeeded > 0) {
        const putOption = await this.strategyBuilderService.getProtectivePut(holding.name);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(putOption.put.bid, putOption.put.ask);
        if (estimatedPrice < 10) {
          console.log('Protective put price is too low', estimatedPrice);
          return;
        }
        this.cartService.addOptionOrder(holding.name, [putOption.put], estimatedPrice, putsNeeded, OrderTypes.protectivePut);
      }
    }
  }

  async createTradingPair(tradingPairs: any[], currentHoldings = null) {
    this.strategyBuilderService.getTradingStrategies().forEach(async (strat) => {
      const buys: string[] = strat.strategy.buy;
      const sells: string[] = strat.strategy.sell;
      for (const buy of buys) {
        const buyOptionsData = await this.optionsDataService.getImpliedMove(buy).toPromise();
        if (buyOptionsData && buyOptionsData.move && buyOptionsData.move < 0.15) {
          const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(buy);
          const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;
          let currentCall = {
            call: bullishStrangle.call,
            price: callPrice,
            quantity: 0,
            underlying: buy
          };
          let currentPut = null;
          if (callPrice > 300) {
            for (const sell of sells) {
              if (!currentHoldings || !currentHoldings.find(holding => holding.name === sell)) {
                const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
                const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
                if (putPrice > 300) {
                  const sellOptionsData = await this.optionsDataService.getImpliedMove(sell).toPromise();
                  if (sellOptionsData && sellOptionsData.move && sellOptionsData.move < 0.15) {
                    const multiple = (callPrice > putPrice) ? Math.round(callPrice / putPrice) : Math.round(putPrice / callPrice);
                    let initialCallQuantity = (callPrice > putPrice) ? 1 : multiple;
                    let initialPutQuantity = (callPrice > putPrice) ? multiple : 1;
                    const { callQuantity, putQuantity } = this.getCallPutQuantities(callPrice, initialCallQuantity, putPrice, initialPutQuantity, multiple);
                    if (callQuantity + putQuantity < 5) {
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
            if (currentPut && currentCall) {
              const option1 = await this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call], currentCall.price, currentCall.quantity, OrderTypes.call, 'Buy', currentCall.quantity);
              const option2 = await this.cartService.createOptionOrder(currentPut.underlying, [currentPut.put], currentPut.price, currentPut.quantity, OrderTypes.put, 'Buy', currentCall.quantity);
              tradingPairs.push([option1, option2]);
            }
          }
        }
      }
    });
  }

  getCallPutQuantities(callPrice, callQuantity, putPrice, putQuantity, multiple) {
    while (Math.abs((callPrice * callQuantity) - (putPrice * putQuantity)) > 500 &&
      callQuantity + putQuantity < 15) {
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
      if (Math.abs(lastPrice - closePrice) < (backtestResults.averageMove * 0.90)) {
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
