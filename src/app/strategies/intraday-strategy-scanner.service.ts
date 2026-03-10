import { Injectable } from '@angular/core';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OptionsOrderBuilderService } from './options-order-builder.service';
import * as moment from 'moment';

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
    console.log(`[${moment().format('HH:mm:ss')}] Starting intraday strategy scan`);
    const buys = [];
    const sells = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    const bearishStocks = this.strategyBuilderService.getBearishStocks();
    
    if (!bullishStocks || !bearishStocks) {
      console.log(`[${moment().format('HH:mm:ss')}] No stocks available for scanning`);
      return { buys, sells };
    }
    
    console.log(`[${moment().format('HH:mm:ss')}] Found ${bullishStocks.length} bullish and ${bearishStocks.length} bearish stocks to scan`);
    
    if (this.currentBullishListCounter >= bullishStocks.length) {
      this.currentBullishListCounter = 0;
    }
    if (this.currentBearishListCounter >= bearishStocks.length) {
      this.currentBearishListCounter = 0;
    }

    const bullStock = bullishStocks[this.currentBullishListCounter];
    console.log(`[${moment().format('HH:mm:ss')}] Scanning bullish stock ${bullStock} (${this.currentBullishListCounter + 1}/${bullishStocks.length})`);
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(bullStock);
    if (buy) {
      console.log(`[${moment().format('HH:mm:ss')}] Found buy opportunity for ${bullStock}`);
      buys.push(bullStock);
    }

    const bearStock = bearishStocks[this.currentBearishListCounter];
    console.log(`[${moment().format('HH:mm:ss')}] Scanning bearish stock ${bearStock} (${this.currentBearishListCounter + 1}/${bearishStocks.length})`);
    // Process backtestResults for bearish stocks
    const sell = this.optionsOrderBuilderService.shouldBuyPutOption(bearStock);
    if (sell) {
      console.log(`[${moment().format('HH:mm:ss')}] Found sell opportunity for ${bearStock}`);
      sells.push(sell);
    }
    
    this.currentBullishListCounter++;
    this.currentBearishListCounter++;
    
    console.log(`[${moment().format('HH:mm:ss')}] Completed scan. Found ${buys.length} buy and ${sells.length} sell opportunities`);
    return { buys, sells };
  }

  async scanStocksForIntradayBuys() {
    const buys = [];
    const bullishStocks = this.strategyBuilderService.getBullishStocks();
    if (this.currentCounter >= bullishStocks.length) {
      this.currentCounter = 0;
    }
    const stock = bullishStocks[this.currentCounter];
    console.log(`Scanning ${stock} for intraday buy opportunities`);
    // Process backtestResults for bullish stocks
    const buy = this.optionsOrderBuilderService.shouldBuyCallOption(stock, 0.5);
    if (buy) {
      buys.push(stock);
    }

    this.currentCounter++;
    return buys;
  }
}
