import { Component, OnInit } from '@angular/core';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { PersonalBearishPicks } from '../rh-table/backtest-stocks.constant';
import { AlgoParam } from '@shared/algo-param.interface';
import { MenuItem } from 'primeng/api';
import { BacktestService } from '@shared/services';
import * as moment from 'moment-timezone';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';

@Component({
  selector: 'app-stock-list-dialog',
  templateUrl: './stock-list-dialog.component.html',
  styleUrls: ['./stock-list-dialog.component.css']
})
export class StockListDialogComponent implements OnInit {
  stockList: { ticker: string }[] = [];
  newList: { ticker: string }[] = [];
  listType: any[];
  activeList;
  selectedList;
  newStock = '';
  items: MenuItem[];

  constructor(private backtestService: BacktestService, private strategyBuilderService: StrategyBuilderService) { }

  ngOnInit(): void {
    this.listType = [
      { label: 'Full list', value: 'full' },
      { label: 'Bullish', value: 'buy' },
      { label: 'Bearish', value: 'sell' }
    ];
    this.activeList = this.listType[0];
    this.stockList = CurrentStockList;
    this.items = [
      {
        label: 'Get losers',
        command: () => {
          this.getLosers();
        }
      }
    ];
  }

  async getWinners() {
    this.stockList.filter(async (stock) => {
      const current = moment().format('YYYY-MM-DD');
      const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
      const results = await this.backtestService.getBacktestEvaluation(stock.ticker, start, current, 'daily-indicators').toPromise();
      const lastSignal = results.signals[results.signals.length - 1];
      return lastSignal.close > lastSignal.bband80[1][0];
    });
  }

  async getLosers() {
    this.stockList.filter(async (stock) => {
      const current = moment().format('YYYY-MM-DD');
      const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
      const results = await this.backtestService.getBacktestEvaluation(stock.ticker, start, current, 'daily-indicators').toPromise();
      const lastSignal = results.signals[results.signals.length - 1];
      return lastSignal.close < lastSignal.bband80[1][0];
    });
  }

  deleteRow(stock: AlgoParam, rowIndex: number) {
    console.log('delete', stock, rowIndex);
    switch (this.activeList.value) {
      case 'full':
        CurrentStockList.splice(rowIndex, 1);
        break;
      case 'buy':
        this.strategyBuilderService.removeFromBuyList(stock.ticker);
        this.setToAlwaysBuyList();
        break;
      case 'sell':
        PersonalBearishPicks.splice(rowIndex, 1);
        break;
    }
  }

  changedList() {
    switch (this.activeList.value) {
      case 'full':
        this.stockList = CurrentStockList;
        break;
      case 'buy':
        this.setToAlwaysBuyList();
        break;
      case 'sell':
        this.stockList = PersonalBearishPicks;
        break;
    }
  }

  setToAlwaysBuyList() {
    this.stockList = this.strategyBuilderService.getBuyList();
  }

  addRow() {
    this.newStock = this.newStock.toUpperCase();
    switch (this.activeList.value) {
      case 'full':
        CurrentStockList.push({ ticker: this.newStock });
        break;
      case 'buy':
        this.strategyBuilderService.addToBuyList(this.newStock);
        this.setToAlwaysBuyList();
        break;
      case 'sell':
        PersonalBearishPicks.push({ ticker: this.newStock } as AlgoParam);
        break;
    }
    this.newStock = '';
  }
}
