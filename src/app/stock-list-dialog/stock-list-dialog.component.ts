import { Component, OnInit } from '@angular/core';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { PersonalBearishPicks, AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { AlgoParam } from '@shared/algo-param.interface';
import { MenuItem } from 'primeng/api';
import { BacktestService } from '@shared/services';
import * as moment from 'moment-timezone';

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

  constructor(private backtestService: BacktestService) { }

  ngOnInit(): void {
    this.listType = [
      { label: 'Full list', value: 'full' },
      { label: 'Buy list', value: 'buy' },
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

  deleteRow(stock, rowIndex: number) {
    console.log('delete', stock, rowIndex);
    switch (this.activeList.value) {
      case 'full':
        CurrentStockList.splice(rowIndex, 1);
        break;
      case 'buy':
        AlwaysBuy.splice(rowIndex, 1);
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
        this.stockList = AlwaysBuy;
        break;
      case 'sell':
        this.stockList = PersonalBearishPicks;
        break;
    }
  }

  addRow() {
    switch (this.activeList.value) {
      case 'full':
        CurrentStockList.push({ ticker: this.newStock });
        break;
      case 'buy':
        AlwaysBuy.push({ ticker: this.newStock } as AlgoParam);
        break;
      case 'sell':
        PersonalBearishPicks.push({ ticker: this.newStock } as AlgoParam);
        break;
    }
    this.newStock = '';
  }
}
