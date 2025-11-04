import { Injectable } from '@angular/core';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OptionsOrderBuilderService } from './options-order-builder.service';

@Injectable({
  providedIn: 'root'
})
export class IntradayStrategyScannerService {
  currentBullishListCounter = 0;
  currentBearishListCounter = 0;
  currentCounter = 0;
  constructor(private strategyBuilderService: StrategyBuilderService,
    private optionsOrderBuilderService: OptionsOrderBuilderService) { }

  async scanStocksForIntradayStrategies() {
    const buys = [];
    const sells = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    const bearishStocks = this.strategyBuilderService.getBearishStocks();
    if (!bullishStocks || !bearishStocks) {
      return { buys, sells };
    }
    if (this.currentBullishListCounter >= bullishStocks.length) {
      this.currentBullishListCounter = 0;
    }
    if (this.currentBearishListCounter >= bearishStocks.length) {
      this.currentBearishListCounter = 0;
    }

    const bullStock = bullishStocks[this.currentBullishListCounter];
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(bullStock);
    if (buy) {
      buys.push(bullStock);
    }

    const bearStock = bearishStocks[this.currentBearishListCounter];

    // Process backtestResults for bearish stocks
    const sell = this.optionsOrderBuilderService.shouldBuyPutOption(bearStock);
    if (sell) {
      sells.push(sell);
    }
    this.currentBullishListCounter++;
    this.currentBearishListCounter++;
    return { buys, sells };
  }

  async scanStocksForIntradayBuys() {
    const buys = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    if (this.currentCounter >= bullishStocks.length) {
      this.currentCounter = 0;
    }
    const stock = bullishStocks[this.currentCounter];
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(stock, 0.7);
    if (buy) {
      buys.push(stock);
    }


    this.currentCounter++;
    return buys;
  }
}
