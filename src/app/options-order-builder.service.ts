import { Injectable } from '@angular/core';
import { CartService, PortfolioInfoHolding } from '@shared/services';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { OrderTypes } from '@shared/models/smart-order';
import { OptionsDataService } from '@shared/options-data.service';
import { OrderHandlingService } from './order-handling/order-handling.service';

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
                      this.cartService.addOptionOrder(buy, [bullishStrangle.call], callPrice, callQuantity, OrderTypes.call, 'Buy');
                      this.cartService.addOptionOrder(sell, [bearishStrangle.put], putPrice, putQuantity, OrderTypes.put, 'Buy');
                    }
                  }
                }
              }
            }
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

  hedgeCallTrade(stock: string, currentHoldings: PortfolioInfoHolding[]) {
    const pairTrades = this.strategyBuilderService.getTradingStrategies().find(s => s.name === stock);
    const foundHedge = currentHoldings.find(ch => ch.name === stock);
    let hedgeUnderlyingStock;
    if (foundHedge) {
      hedgeUnderlyingStock = foundHedge.name;
    } else {
      hedgeUnderlyingStock = pairTrades.strategy.sell.find(async (stockSymbol: string) => {
        const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(stockSymbol);
        const price = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;
        return price > 500;
      });
    }
    if (!hedgeUnderlyingStock) {
      return;
    } else {
      // const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(hedgeUnderlyingStock);
      // const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;

      // const { callQuantity, putQuantity } = this.getCallPutQuantities(callPrice, initialCallQuantity, putPrice, initialPutQuantity, multiple);
      
    }
  }

  hedgePutTrade(stock: string, currentHoldings: PortfolioInfoHolding[]) {

  }


}
