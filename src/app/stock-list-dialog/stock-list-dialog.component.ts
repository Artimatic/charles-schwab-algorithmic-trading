import { Component, OnInit } from '@angular/core';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { PersonalBearishPicks, AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { AlgoParam } from '@shared/algo-param.interface';

@Component({
  selector: 'app-stock-list-dialog',
  templateUrl: './stock-list-dialog.component.html',
  styleUrls: ['./stock-list-dialog.component.css']
})
export class StockListDialogComponent implements OnInit {
  stockList: { ticker: string }[] = [];
  listType: any[];
  activeList;
  selectedList;
  newStock = '';

  constructor() { }

  ngOnInit(): void {
    this.listType = [
      { label: 'Full list' },
      { label: 'Always buy' },
      { label: 'Bearish' }
    ];
    this.activeList = this.listType[0];
    this.stockList = CurrentStockList;
  }

  deleteRow(stock, rowIndex: number) {
    console.log('delete', stock, rowIndex);
    switch (this.activeList.label) {
      case 'Full list':
        CurrentStockList.splice(rowIndex, 1);
        break;
      case 'Bullish':
        AlwaysBuy.splice(rowIndex, 1);
        break;
      case 'Bearish':
        PersonalBearishPicks.splice(rowIndex, 1);
        break;
    }
  }

  changedList() {
    switch (this.activeList.label) {
      case 'Full list':
        this.stockList = CurrentStockList;
        break;
      case 'Bullish':
        this.stockList = AlwaysBuy;
        break;
      case 'Bearish':
        this.stockList = PersonalBearishPicks;
        break;
    }
  }

  addRow() {
    switch (this.activeList.label) {
      case 'Full list':
        CurrentStockList.push({ ticker: this.newStock });
        break;
      case 'Bullish':
        AlwaysBuy.push({ ticker: this.newStock } as AlgoParam);
        break;
      case 'Bearish':
        PersonalBearishPicks.push({ ticker: this.newStock } as AlgoParam);
        break;
    }
    this.newStock = '';
  }
}
