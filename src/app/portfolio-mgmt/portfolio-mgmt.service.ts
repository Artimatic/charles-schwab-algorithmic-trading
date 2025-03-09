import { Injectable } from '@angular/core';
import { round } from 'lodash';
import { CartService, PortfolioInfoHolding } from '@shared/services';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { SmartOrder } from '@shared/index';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';

@Injectable({
  providedIn: 'root'
})
export class PortfolioMgmtService {

  constructor(private cartService: CartService,
    private machineDaytradingService: MachineDaytradingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private strategyBuilderService: StrategyBuilderService,
    private orderHandlingService: OrderHandlingService) { }

  // getMinMaxCash(this.riskToleranceList[1], this.riskToleranceList[this.riskCounter])
  async getMinMaxCash(minRiskPct, maxRiskPct): Promise<{ minCash: number, maxCash: number }> {
    const cash = await this.cartService.getAvailableFunds(false);
    const minCash = round(minRiskPct * cash, 2);
    const maxCash = round(maxRiskPct * cash, 2);
    return { minCash, maxCash };
  }

  hedgeCall(holding, currentHoldings, tradingPairs) {
    const pair = tradingPairs.find(tradeArr => tradeArr[0].holding.symbol === holding.name);
    if (pair && pair.length === 2) {
      console.log(`Trading pair for ${holding.name} call is ${pair[1].holding.name} put`);
      if (!currentHoldings.find(curr => curr.name === pair[1].holding.name)) {
        this.cartService.addToCart(pair[1], true, 'Hedging call with correlated stock');
      }
    }
  }

  async hedgePut(holding, currentHoldings, tradingPairs, minRiskPct, maxRiskPct) {
    const pair = tradingPairs.find(tradeArr => tradeArr.length === 2 && tradeArr[1].holding.symbol === holding.name);
    if (pair) {
      console.log(`Trading pair for ${holding.name} put is ${pair[1].holding.name} call`);
      if (!currentHoldings.find(curr => curr.name === pair[1].holding.name)) {
        const spyStrangle = await this.strategyBuilderService.getCallStrangleTrade('SPY');
        if (spyStrangle) {
          const callPrice = this.strategyBuilderService.findOptionsPrice(spyStrangle.call.bid, spyStrangle.call.ask) * 100;
          const putPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
          const { minCash, maxCash } = await this.getMinMaxCash(minRiskPct, maxRiskPct);
          const callQuantity = this.optionsOrderBuilderService.getCallPutQuantities(callPrice,
            1,
            putPrice,
            holding.primaryLegs[0].quantity,
            1,
            minCash,
            maxCash).callQuantity;
          const option = this.cartService.createOptionOrder('SPY', [spyStrangle.call], callPrice, callQuantity, OrderTypes.call, 'Hedge put', 'Buy', callQuantity);
          this.cartService.addToCart(option, true, 'Hedging put with SPY');
        }
      }
    }
  }

  async hedge(currentHoldings: PortfolioInfoHolding[], tradingPairs: SmartOrder[][], minRiskPct = 0.01, maxRiskPct = 0.05) {
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    currentHoldings.forEach(async (holding) => {
      if (!holding.primaryLegs && holding.assetType !== 'collective_investment') {
        if (holding.netLiq && (holding.netLiq / balance.liquidationValue) > 0.15)
          console.log('Adding protective put for', holding.name);
        await this.optionsOrderBuilderService.createProtectivePutOrder(holding);
      } 
      // else {
      //   if (!this.cartService.isStrangle(holding) && holding.primaryLegs) {
      //     if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
      //       this.hedgeCall(holding, currentHoldings, tradingPairs);
      //     } else if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
      //       await this.hedgePut(holding, currentHoldings, tradingPairs, minRiskPct, maxRiskPct);
      //     }
      //   }
      // }
    });

    return currentHoldings;
  }
}
