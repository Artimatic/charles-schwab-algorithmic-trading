import { Injectable } from '@angular/core';
import { StrategyBuilderService } from './strategy-builder.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { FullList } from '../rh-table/backtest-stocks.constant';

@Injectable({
  providedIn: 'root'
})
export class NewStockFinderService {
  private newStocks: string[] = [];
  constructor(private strategyBuilderService: StrategyBuilderService) { }

  addOldList() {
    FullList.forEach(stock => {
      this.addStock(stock);
    });
  }

  addStock(stock: string) {
    const exists = this.strategyBuilderService.getRecentBacktest(stock, 100);
    if (!exists) {
      console.log('Adding stock', stock);
      this.newStocks.push(stock);
    }
  }

  getNewStocks() {
    return this.newStocks;
  }

  async processOneStock() {
    if (!this.newStocks.length) {
      return;
    }
    const stock = this.newStocks.pop();
    const bullishStrangle = await this.strategyBuilderService.getStrangleTrade(stock);

    if (bullishStrangle && bullishStrangle.call && bullishStrangle.put) {
      this.strategyBuilderService.addToNewStocks(stock);
      CurrentStockList.push({ ticker: stock });
    }
  }
}
