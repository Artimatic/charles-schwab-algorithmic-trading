import { Injectable } from '@angular/core';
import { StrategyBuilderService } from './strategy-builder.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';

@Injectable({
  providedIn: 'root'
})
export class NewStockFinderService {
  private newStocks: string[] = [];
  constructor(private strategyBuilderService: StrategyBuilderService) { }

  addStock(stock: string) {
    console.log('Adding stock', stock);
    this.newStocks.push(stock);
  }

  getNewStocks() {
    return this.newStocks;
  }
  
  async processOneStock() {
    if (!this.newStocks.length) {
      return;
    }
    const stock = this.newStocks.pop();
    const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(stock);

    if (bullishStrangle.call && bullishStrangle.put) {
      this.strategyBuilderService.addToNewStocks(stock);
      CurrentStockList.push({ ticker: stock });
    }
  }
}
