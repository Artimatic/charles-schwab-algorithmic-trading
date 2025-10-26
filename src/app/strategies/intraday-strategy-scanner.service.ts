import { Injectable } from '@angular/core';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OptionsOrderBuilderService } from './options-order-builder.service';

@Injectable({
  providedIn: 'root'
})
export class IntradayStrategyScannerService {

  constructor(private strategyBuilderService: StrategyBuilderService,
    private optionsOrderBuilderService: OptionsOrderBuilderService) { }

  async scanStocksForIntradayStrategies() {
    const buys = [];
    const sells = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    const bearishStocks = this.strategyBuilderService.getBearishStocks();
    bullishStocks.forEach(async (stock) => {
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock);
      // Process backtestResults for bullish stocks
      const buy = this.optionsOrderBuilderService.shouldBuyCallOption(stock, backtestResults.impliedMovement - 0.015);
      if (buy) {
        buys.push(stock);
      }
    });
    bearishStocks.forEach(async (stock) => {
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock);
      // Process backtestResults for bearish stocks
      const buy = this.optionsOrderBuilderService.shouldBuyPutOption(stock, backtestResults.impliedMovement - 0.015);
      if (buy) {
        sells.push(stock);
      }
    });
    return { buys, sells };
  }

  async scanStocksForIntradayBuys() {
    const buys = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    bullishStocks.forEach(async (stock) => {
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock);
      // Process backtestResults for bullish stocks
      const buy = this.optionsOrderBuilderService.shouldBuyCallOption(stock, backtestResults.impliedMovement - 0.02);
      if (buy) {
        buys.push(stock);
      }
    });

    return buys;
  }
}
