import { Component, OnInit } from '@angular/core';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { PersonalBearishPicks, PersonalBullishPicks } from '../rh-table/backtest-stocks.constant';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-stock-list-dialog',
  templateUrl: './stock-list-dialog.component.html',
  styleUrls: ['./stock-list-dialog.component.css']
})
export class StockListDialogComponent implements OnInit {
  fullList;
  buyList;
  sellList;
  items: MenuItem[];
  activeItem: MenuItem;

  constructor() { }

  ngOnInit(): void {
    this.fullList = CurrentStockList;
    this.buyList = PersonalBullishPicks;
    this.sellList = PersonalBearishPicks;

    this.items = [
      { label: 'Full list' },
      { label: 'Bullish' },
      { label: 'Bearish' }
    ];
    this.activeItem = this.items[0];
  }

}
