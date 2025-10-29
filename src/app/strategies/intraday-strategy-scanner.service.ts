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
    const backtestResults = await this.strategyBuilderService.getBacktestData(bullStock);
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(bullStock, backtestResults.impliedMovement / 2);
    if (buy) {
      buys.push(bullStock);
    }

    const bearStock = bearishStocks[this.currentBearishListCounter];

    const backtestResultsSell = await this.strategyBuilderService.getBacktestData(bearStock);
    // Process backtestResults for bearish stocks
    const sell = this.optionsOrderBuilderService.shouldBuyPutOption(bearStock, (backtestResultsSell.impliedMovement / 2));
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
    const backtestResults = await this.strategyBuilderService.getBacktestData(stock);
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(stock, backtestResults.impliedMovement - 0.02);
    if (buy) {
      buys.push(stock);
    }


    this.currentCounter++;
    return buys;
  }
}
