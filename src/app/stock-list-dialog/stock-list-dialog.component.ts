import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';

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
  @ViewChild('fileInput', {static: false}) fileInput;
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

  addRow(stock: string = null) {
    stock = stock ? stock : this.newStock;
    stock = stock.toUpperCase();
    switch (this.activeList.value) {
      case 'full':
        if (CurrentStockList.find(s => s.ticker === stock)) {
          CurrentStockList.push({ ticker: stock });
        }
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

  upload() {
    const reader = new FileReader();
    const fileBrowser = this.fileInput.nativeElement;

    const overwriteOnload = function (evt: any) {
      const data = evt.target.result;

      const workbook = XLSX.read(data, { type: 'binary' });

      const parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      parsedData.forEach((row: any) => {
        if (row.__EMPTY && row.__EMPTY !== 'Ticker') {
          this.addRow(row.__EMPTY);
        }
      });
    };

    reader.onload = overwriteOnload.bind(this);
    reader.readAsBinaryString(fileBrowser.files[0]);
  }
}
