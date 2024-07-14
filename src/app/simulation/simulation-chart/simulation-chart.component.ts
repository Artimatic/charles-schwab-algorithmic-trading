import { Component, OnInit } from '@angular/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import * as moment from 'moment';
import { BacktestService, MachineLearningService, PortfolioService } from '@shared/services';
import { ChartService } from '../chart.service';
import { DaytradeStrategiesService } from 'src/app/strategies/daytrade-strategies.service';
import { DaytradeRecommendation, Recommendation } from '@shared/stock-backtest.interface';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { AlgoQueueItem, TradeService } from '@shared/services/trade.service';

@Component({
  selector: 'app-simulation-chart',
  templateUrl: './simulation-chart.component.html',
  styleUrls: ['./simulation-chart.component.css']
})
export class SimulationChartComponent implements OnInit {
  chart;
  buyStates: Recommendation[][] = [];
  sellStates: Recommendation[][] = [];
  currentState: Recommendation[] = [];
  updateChart = new Subject();
  symbol: string;
  lastSelectedSignal;

  constructor(private config: DynamicDialogConfig,
    private daytradeStrategiesService: DaytradeStrategiesService,
    private chartService: ChartService,
    private backtestService: BacktestService,
    private tradeService: TradeService,
    private machineLearningService: MachineLearningService) { }

  ngOnInit(): void {
    this.simulateIntraday(this.config.data.symbol);
    this.buyStates = this.daytradeStrategiesService.buyStates;
    this.sellStates = this.daytradeStrategiesService.sellStates;
    this.updateChart.pipe(take(1)).subscribe(chartVal => this.chart = chartVal);
  }

  buildSignal(analysis: Recommendation, closePrice: number, info: string) {
    switch (analysis.recommendation.toUpperCase()) {
      case 'SELL':
        return {
          y: closePrice,
          marker: {
            symbol: 'triangle-down',
            fillColor: 'red',
            radius: 6
          },
          name: `${info}`,
          data: analysis
        };
      case 'BUY':
        return {
          y: closePrice,
          marker: {
            symbol: 'triangle',
            fillColor: 'green',
            radius: 6
          },
          name: `${info}`,
          data: analysis
        };
      default:
        return {
          y: closePrice,
          name: `${info}`,
          data: analysis
        };
    }
  }

  convertPointToRecommendation(name: string) {
    const firstArr = name.split(')Sell(');
    const recommendation = {
      bband: DaytradeRecommendation.Neutral,
      bbandBreakout: DaytradeRecommendation.Neutral,
      demark9: DaytradeRecommendation.Neutral,
      macd: DaytradeRecommendation.Neutral,
      mfi: DaytradeRecommendation.Neutral,
      mfiTrade: DaytradeRecommendation.Neutral,
      roc: DaytradeRecommendation.Neutral,
      vwma: DaytradeRecommendation.Neutral
    };

    for (const buy of firstArr[0].replace('Buy(', '').split(',')) {
      if (recommendation[buy]) {
        recommendation[buy] = DaytradeRecommendation.Bullish;
      }
    }

    for (const sell of firstArr[1].replace(')', '').split(',')) {
      if (recommendation[sell]) {
        recommendation[sell] = DaytradeRecommendation.Bearish;
      }
    }

    return recommendation;
  }

  simulateIntraday(symbol: string) {
    this.symbol = symbol;
    const clickHandler = (event) => {
      this.lastSelectedSignal = event.point.data;
      this.currentState.push(this.convertPointToRecommendation(event.point.name));
      this.currentState = [].concat(this.currentState);
      console.log(event);
    };

    const start = moment().subtract({ days: 3 }).format('YYYY-MM-DD');
    const end = moment().subtract({ days: 2 }).format('YYYY-MM-DD');
    const time = [];
    const seriesData = [];
    this.machineLearningService.getQuotes(symbol, start, end)
      .subscribe(async (quotes) => {
        const indicators = await this.backtestService.getDaytradeIndicators(quotes, 80).toPromise();
        for (const indicator of indicators) {
          const analysis = await this.backtestService.getDaytradeRecommendationFn(symbol, null, null, { minQuotes: 80 }, indicator).toPromise()
          let buys = 'Buy(';
          let sells = 'Sell(';
          const buyArr = [];
          const sellArr = [];

          for (const rec in analysis) {
            if (analysis.hasOwnProperty(rec)) {
              if (analysis[rec].toLowerCase && analysis[rec].toLowerCase() === 'bullish') {
                buyArr.push(rec);
              } else if (analysis[rec].toLowerCase && analysis[rec].toLowerCase() === 'bearish') {
                sellArr.push(rec);
              }
            }
          }
          buys += buyArr.join(',') + ')';
          sells += sellArr.join(',') + ')';
          const signal = this.buildSignal(analysis, indicator.close, buys + sells)
          seriesData.push(signal);
          time.push(indicator.date);
        }
        this.chart = this.chartService.initChart(symbol, time, seriesData, 'HH:mm', clickHandler);
      });
  }

  addBuyState() {
    this.daytradeStrategiesService.buyStates.push(this.currentState);
    this.currentState = [];
  }

  addSellState() {
    this.daytradeStrategiesService.sellStates.push(this.currentState);
    this.currentState = [];
  }

  sendSignals() {
    const resetCommand: AlgoQueueItem = {
      symbol: this.symbol,
      reset: true
    };
    this.tradeService.algoQueue.next(resetCommand);
    if (this.lastSelectedSignal) {
      const queueItem: AlgoQueueItem = {
        symbol: this.symbol,
        reset: false,
        analysis: this.lastSelectedSignal.data,
        ml: null
      };
      this.tradeService.algoQueue.next(queueItem);
    }

  }
}
