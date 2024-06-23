import { Injectable } from '@angular/core';
import { BacktestService } from '@shared/services';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { Options } from '@shared/models/options';

@Injectable({
  providedIn: 'root'
})
export class PricingService {

  constructor(private backtestService: BacktestService,
    private strategyBuilderService: StrategyBuilderService
  ) { }

  async getPricing(primaryLegs: Options[], secondaryLeg: Options[]) {
    let calls;
    let puts;
    if (primaryLegs[0].putCallInd === 'C') {
      calls = primaryLegs;
      puts = secondaryLeg;
    } else {
      puts = primaryLegs;
      calls = secondaryLeg;
    }
    const callsTotalPrice = await this.getListFullPrice(calls);
    const putsTotalPrice = await this.getListFullPrice(puts);
    return {
      callsTotalPrice,
      putsTotalPrice
    }
  }
  
  async getListFullPrice(fullOrderList) {
    let fullPrice = 0;
    for (let i = 0; i < fullOrderList.length; i++) {
      const price = await this.backtestService.getLastPriceTiingo({ symbol: fullOrderList[i].symbol }).toPromise();
      const askPrice = price[fullOrderList[i].symbol].quote.askPrice;
      const bidPrice = price[fullOrderList[i].symbol].quote.bidPrice;

      const estimatedPrice = this.strategyBuilderService.findOptionsPrice(bidPrice, askPrice);
      fullPrice += estimatedPrice;
    }
    return fullPrice;
  }
}
