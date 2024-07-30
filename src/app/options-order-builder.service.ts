import { Injectable } from '@angular/core';
import { CartService, PortfolioInfoHolding } from '@shared/services';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { OrderTypes } from '@shared/models/smart-order';
import { OptionsDataService } from '@shared/options-data.service';

@Injectable({
  providedIn: 'root'
})
export class OptionsOrderBuilderService {

  constructor(private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private optionsDataService: OptionsDataService
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
    if (holding.shares) {
      let putsNeeded = 0;
      if ((holding.primaryLegs && !holding.secondaryLegs && holding.primaryLegs[0].putCallInd === 'P')) {
        putsNeeded = Math.floor((holding.shares / 100) - holding.primaryLegs.length) || 1;
      } else if (!holding.primaryLegs && holding.secondaryLegs && holding.secondaryLegs[0].putCallInd === 'P') {
        putsNeeded = Math.floor((holding.shares / 100) - holding.secondaryLegs.length) || 1;
      } else if (!holding.primaryLegs && !holding.secondaryLegs) {
        putsNeeded = Math.floor(holding.shares / 100);
      }

      putsNeeded -= this.protectivePutCount(holding);

      if (putsNeeded > 0) {
        const putOption = await this.strategyBuilderService.getProtectivePut(holding.name);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(putOption.put.bid, putOption.put.ask);
        this.cartService.addOptionOrder(holding.name, [putOption.put], estimatedPrice, putsNeeded, OrderTypes.protectivePut);
      }
    }
  }

  async createTradingPair() {
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
          if (callPrice > 500) {
            for (const sell of sells) {
              const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
              const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.call.bid, bearishStrangle.call.ask) * 100;
              if (putPrice > 500) {
                const sellOptionsData = await this.optionsDataService.getImpliedMove(sell).toPromise();
                if (sellOptionsData && sellOptionsData.move && sellOptionsData.move < 0.15) {
                  const multiple = (callPrice > putPrice) ? Math.round(callPrice / putPrice) : Math.round(putPrice / callPrice);
                  let initialCallQuantity = 1;
                  let initialPutQuantity = multiple;
                  const { callQuantity, putQuantity } = this.getCallPutQuantities(callPrice, initialCallQuantity, putPrice, initialPutQuantity, multiple);
                  if (callQuantity + putQuantity < 5) {
                    bullishStrangle.call.quantity = callQuantity;
                    bearishStrangle.put.quantity = putQuantity;
                    const availableFunds = await this.cartService.getAvailableFunds(true);
                    if (availableFunds >= (callPrice * callQuantity + putPrice * putQuantity)) {
                      currentCall.quantity = callQuantity;
                      currentPut.put = bearishStrangle.put;
                      currentPut.quantity = putQuantity;
                      currentPut.price = putPrice;
                      currentPut.underlying = sell;
                      break;
                    }
                  }
                }
              }
            }
            this.cartService.addOptionOrder(currentCall.underlying, [currentCall.call], currentCall.price, currentCall.quantity, OrderTypes.call, 'Buy');
            this.cartService.addOptionOrder(currentPut.underlying, [currentPut.put], currentPut.price, currentPut.quantity, OrderTypes.put, 'Buy');
          }
        }
      }
    });
  }

  getCallPutQuantities(callPrice, callQuantity, putPrice, putQuantity, multiple) {
    while (Math.abs((callPrice * callQuantity) - (putPrice * putQuantity)) < 500 &&
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

}
