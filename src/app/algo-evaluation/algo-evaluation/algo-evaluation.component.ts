import { Component, OnInit } from '@angular/core';
import { AiPicksService } from '@shared/services';
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
    { field: 'impliedMovement', header: 'Implied Movement' }
  ];
  selectedStock: any;
  currentList: Stock[] = [];
  stockList: Stock[] = [];

  constructor(private aiPicksService: AiPicksService) { }

  ngOnInit(): void {
    this.getBacktests();

    this.aiPicksService.mlNeutralResults.subscribe(() => {
      this.getBacktests();
    });
  }

  getBacktests() {
    this.stockList = [];
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        this.stockList.push(savedBacktest[saved]);
      }
    }
    this.currentList = this.stockList.filter(stock => {
      if ((stock?.ml >= 0.5) &&(stock.recommendation.toLowerCase() === 'buy' || stock.recommendation.toLowerCase() === 'strongbuy')) {
        stock.recommendation = 'Buy';
        return true;
      } else if ((stock.ml === 0 || stock?.ml < 0.5) && (stock.recommendation.toLowerCase() === 'sell' || stock.recommendation.toLowerCase() === 'strongsell')) {
        stock.recommendation = 'Sell';
        return true;
      }
      return false;
    });
  }

}
