import { Component, OnInit } from '@angular/core';
import { Stock } from '@shared/stock.interface';

@Component({
  selector: 'app-algo-evaluation',
  templateUrl: './algo-evaluation.component.html',
  styleUrls: ['./algo-evaluation.component.css']
})
export class AlgoEvaluationComponent implements OnInit {
  selectedColumns = [
    { field: 'stock', header: 'Stock' },
    { field: 'buySignals', header: 'Buy' },
    { field: 'sellSignals', header: 'Sell' },
    { field: 'recommendation', header: 'Recommendation' },
    { field: 'ml', header: 'Prediction' },
    { field: 'returns', header: 'Returns' },
    { field: 'impliedMovement', header: 'Implied Movement' },
    { field: 'lastPrice', header: 'Last Price' }
  ];
  selectedStock: any;
  currentList: Stock[] = [];
  stockList: Stock[] = [];

  constructor() { }

  ngOnInit(): void {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        this.stockList.push(savedBacktest[saved]);
      }
    }
    this.currentList = this.stockList;
  }

}
