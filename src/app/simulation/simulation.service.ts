import { Injectable } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { SimulationChartComponent } from './simulation-chart/simulation-chart.component';
import { BacktestService, PortfolioService } from '@shared/services';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {

  constructor(private portfolioService: PortfolioService,
    private backtestService: BacktestService
  ) { }

  simulateIntraday() {
    this.portfolioService.getIntradayPriceHistoryQuotes('MSFT').subscribe(data => {
      console.log('getIntradayPriceHistoryQuotes', data);
      this.backtestService.getDaytradeIndicators(data.candles, 80).subscribe(data => {
        console.log('daytrade indicators', data);
        this.backtestService.getDaytradeRecommendationFn('MSFT', null, null, { minQuotes: 80 }, data[data.length - 1])
          .subscribe(data => console.log('recommendation', data));
      });
    });
  }

  replayDay() {
    
  }
}
