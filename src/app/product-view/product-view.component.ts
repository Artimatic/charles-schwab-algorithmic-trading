import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment';

import { BacktestService } from '../shared';
import { ChartParam } from '../shared/services/backtest.service';
import { AiPicksService, MachineLearningService } from '@shared/services';
import { AiPicksPredictionData } from '@shared/services/ai-picks.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChartService } from '../simulation/chart.service';

@Component({
  selector: 'app-product-view',
  templateUrl: './product-view.component.html',
  styleUrls: ['./product-view.component.css']
})
export class ProductViewComponent implements OnInit, OnDestroy {
  chart;
  resolving = false;
  stock: string;
  backtestResults: any[];
  destroy$ = new Subject();

  constructor(
    private algo: BacktestService,
    private aiPicksService: AiPicksService,
    private chartService: ChartService,
    private machineLearningService: MachineLearningService
  ) { }

  ngOnInit() {
    this.aiPicksService.predictionData
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe((predictionData: AiPicksPredictionData) => {
        // const predictions = predictionData.predictionHistory.reduce((previous, current) => {
        //   previous[current.date] = current.prediction;
        //   return previous;
        // }, {});

        this.loadMLChart({
          algorithm: 'daily-indicators',
          symbol: predictionData.stock,
          date: predictionData.date
        });
      });

    this.algo.currentChart.subscribe((chart: ChartParam) => {
      switch (chart.algorithm) {
        case 'mfi': {
          this.loadMfi(chart);
          break;
        }
        case 'sma': {
          this.loadSma(chart, chart.date);
          break;
        }
        case 'bollingerband': {
          this.loadBBChart(chart.symbol, chart.date);
          break;
        }
        case 'bollingerbandmfi': {
          this.loadBBMfiChart(chart);
          break;
        }
        case 'macrossover': {
          this.loadMaCrossOverChart(chart);
          break;
        }
        case 'findresistance': {
          this.loadFindResistanceChart(chart);
          break;
        }
        case 'all': {
          this.loadMLChart(chart);
          break;
        }
        default: {
          this.loadDefaultChart(chart, chart.algorithm);
          break;
        }
      }
    });
  }

  triggerCondition(lastPrice, thirtyDay, ninetyDay, deviation) {
    if (this.calculatePercentDifference(thirtyDay, ninetyDay) <= deviation) {
      return true;
    }
    return false;
  }

  calculatePercentDifference(v1, v2) {
    return Math.abs(Math.abs(v1 - v2) / ((v1 + v2) / 2));
  }

  loadBBMfiChart(params: ChartParam) {
    this.resolving = true;
    const currentDate = moment(params.date).format('YYYY-MM-DD');
    const pastDate = moment(params.date).subtract(800, 'days').format('YYYY-MM-DD');
    this.algo.getBBMfiBacktestChart(params.symbol, currentDate, pastDate)
      .map(result => {
        this.initBacktestResults(params.symbol, result, result.signals);
      })
      .subscribe(
        response => {
          this.stock = params.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  loadMaCrossOverChart(data: ChartParam) {
    this.resolving = true;
    const currentDate = moment(data.date).format('YYYY-MM-DD');
    const pastDate = moment(data.date).subtract(800, 'days').format('YYYY-MM-DD');

    this.algo.getMaCrossOverBacktestChart(data.symbol, currentDate,
      pastDate, data.params.fastAvg || 30,
      data.params.slowAvg || 90)
      .map(result => {
        this.initBacktestResults(data.symbol, result, result.signals);
      })
      .subscribe(
        response => {
          this.stock = data.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  loadFindResistanceChart(data: ChartParam) {
    this.resolving = true;
    const currentDate = moment(data.date).format('YYYY-MM-DD');
    const pastDate = moment(data.date).subtract(800, 'days').format('YYYY-MM-DD');

    this.algo.getResistanceChart(data.symbol, pastDate, currentDate)
      .map(result => {
        this.initBacktestResults(data.symbol, result, result.signals);
      })
      .subscribe(
        response => {
          this.stock = data.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  loadChart(data: ChartParam) {
    this.resolving = true;
    const currentDate = moment(data.date).format('YYYY-MM-DD');
    const pastDate = moment(data.date).subtract(365, 'days').format('YYYY-MM-DD');

    this.algo.getBacktestEvaluation(data.symbol, pastDate, currentDate, data.algorithm)
      .map(result => {
        this.initBacktestResults(data.symbol, result, result.signals);
      })
      .subscribe(
        response => {
          this.stock = data.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  initBacktestResults(symbol, result, signals) {
    this.backtestResults = [result];
    const time = [];
    const seriesData = [];

    signals.forEach(day => {
      time.push(day.date);
      const signal = this.buildSignal(day.action, day.close, day.volume, '');
      seriesData.push(signal);

      this.chart = this.chartService.initChart(symbol, time, seriesData);
    });
  }

  initDefaultResults(symbol, result, signals, algoName: string) {
    if (algoName) {
      result.algo = algoName;
    }
    this.backtestResults = [result];
    const time = [];
    const seriesData = [];

    signals.forEach(day => {
      let action = day.action;
      if (algoName) {
        const recommendation = day.recommendation[algoName].toUpperCase();
        switch (recommendation) {
          case 'BEARISH': {
            action = 'STRONGSELL';
            break;
          }
          case 'BULLISH': {
            action = 'STRONGBUY';
            break;
          }
          default: {
            action = 'INDETERMINANT';
            break;
          }
        }
      }
      time.push(day.date);
      // if (moment(day.date).format('YYYY-MM-DD') === moment('2022-02-11T05:00:00.000+0000').format('YYYY-MM-DD')) {
      //   console.log(day);
      // }
      const signal = this.buildSignal(action, day.close, day.volume, day.recommendation);
      seriesData.push(signal);
      this.chart = this.chartService.initChart(symbol, time, seriesData);
    });
  }

  loadMLChart(chartParameters: ChartParam) {
    const endDate = moment().format('YYYY-MM-DD');
    const startDate = moment(endDate).subtract({ day: 300 }).format('YYYY-MM-DD');
    this.machineLearningService.trainPredictDailyV4(chartParameters.symbol,
      endDate,
      startDate,
      0.7,
      null,
      10,
      0.001
    )
      .subscribe((data) => {
        const prediction = {
          stock: data.symbol,
          algorithm: 10,
          prediction: data[0].nextOutput,
          accuracy: null,
          predictionHistory: data[0].predictionHistory
        };

        const defaultPeriod = 500;
        this.resolving = true;
        const currentDate = moment(data.date).format('YYYY-MM-DD');
        const pastDate = moment(data.date).subtract(defaultPeriod, 'days').format('YYYY-MM-DD');

        this.algo.getBacktestEvaluation(chartParameters.symbol, pastDate, currentDate, 'daily-indicators')
          .map(result => {
            if (result.signals > defaultPeriod) {
              result.signals = result.signals.slice(result.signals.length - defaultPeriod, result.signals.length);
            }
            this.initMlResults(chartParameters.symbol, result, result.signals, prediction);
          })
          .subscribe(
            response => {
              this.stock = chartParameters.symbol;
              this.resolving = false;
            },
            err => {
              this.resolving = false;
            }
          );
      });
  }

  initMlResults(symbol, result, signals, predictionData) {
    this.backtestResults = [result];
    const time = [];
    const seriesData = [];

    signals.forEach(day => {
      time.push(day.date);
      let action;
      const prediction = predictionData.predictionHistory.find(predict => predict.date === day.date);
      action = day.recommendation.recommendation.toUpperCase();
      if (prediction && prediction.prediction) {
        if (prediction.prediction > 0.5) {
          action = 'STRONGBUY';
        } else if (prediction < 0.5) {
          action = 'STRONGSELL';
        }  
      }

      const signal = this.buildSignal(action, day.close, day.volume, day.recommendation, prediction);

      seriesData.push(signal);

      this.chart = this.chartService.initChart(symbol, time, seriesData);
    });
  }

  loadDefaultChart(data: ChartParam, algoName: string) {
    const defaultPeriod = 500;
    data.algorithm = 'daily-indicators';
    this.resolving = true;
    const currentDate = moment(data.date).format('YYYY-MM-DD');
    const pastDate = moment(data.date).subtract(defaultPeriod, 'days').format('YYYY-MM-DD');

    this.algo.getBacktestEvaluation(data.symbol, pastDate, currentDate, data.algorithm)
      .map(result => {
        if (result.signals > defaultPeriod) {
          result.signals = result.signals.slice(result.signals.length - defaultPeriod, result.signals.length);
        }
        this.initDefaultResults(data.symbol, result, result.signals, algoName);
      })
      .subscribe(
        response => {
          this.stock = data.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  loadMfi(data: ChartParam) {
    this.loadDefaultChart(data, 'mfi');
  }

  loadSma(data: ChartParam, endDate): void {
    this.resolving = true;

    const currentDate = moment(endDate).format('YYYY-MM-DD');
    const pastDate = moment(endDate).subtract(700, 'days').format('YYYY-MM-DD');

    this.algo.getBacktestChart(data.symbol,
      pastDate,
      currentDate,
      data.params.deviation || 0.003,
      data.params.fastAvg || 30,
      data.params.slowAvg || 90)
      .map(result => {
        const time = [],
          seriesData = [];
        let signal;

        result.forEach(day => {
          time.push(day.date);
          if (this.triggerCondition(day.close,
            day.shortTermAvg,
            day.longTermAvg,
            data.params.deviation || 0.003)) {
            if (day.trending === 'Sell') {
              signal = {
                y: day.close,
                marker: {
                  symbol: 'triangle-down',
                  fillColor: 'red',
                  radius: 5
                },
                name: '<br><b>Short:</b> ' + day.shortTermAvg +
                  '<br><b>Long:</b> ' + day.longTermAvg +
                  '<br><b>Deviation:</b> ' + day.deviation
              };
            } else if (day.trending === 'Buy') {
              signal = {
                y: day.close,
                marker: {
                  symbol: 'triangle',
                  fillColor: 'green',
                  radius: 5
                },
                name: '<br><b>Short:</b> ' + day.shortTermAvg +
                  '<br><b>Long:</b> ' + day.longTermAvg +
                  '<br><b>Deviation:</b> ' + day.deviation
              };
            } else {
              signal = {
                y: day.close,
                name: '<br><b>Short:</b> ' + day.shortTermAvg +
                  '<br><b>Long:</b> ' + day.longTermAvg +
                  '<br><b>Deviation:</b> ' + day.deviation
              };
            }
          } else {
            signal = {
              y: day.close,
              name: '<br><b>Short:</b> ' + day.shortTermAvg +
                '<br><b>Long:</b> ' + day.longTermAvg +
                '<br><b>Deviation:</b> ' + day.deviation
            };
          }
          seriesData.push(signal);
        });

        this.chart = this.chartService.initChart(data.symbol, time, seriesData);

        return result;
      })
      .subscribe(
        response => {
          this.stock = data.symbol;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  buildAlgoText(recommendations): string {
    let sellText = '<br><b>Sells: </b>';
    let buyText = '<br><b>Buys: </b>';

    const sellsArr = [];
    const buysArr = [];

    for (const key in recommendations) {
      if (recommendations[key].toLowerCase() !== 'neutral') {
        if (recommendations[key].toLowerCase() === 'bullish') {
          buysArr.push(key);
        } else if (recommendations[key].toLowerCase() === 'bearish') {
          sellsArr.push(key);
        }
      }
    }

    if (sellsArr.length > 0) {
      sellText += sellsArr.join(',');
    }

    if (buysArr.length > 0) {
      buyText += buysArr.join(',');
    }

    return buyText + sellText;
  }

  buildSignal(action: string, close: number, volume: number, recommendations: any, prediction = 0) {
    const radius = 3
    switch (action) {
      case 'SELL':
        return {
          y: close,
          marker: {
            symbol: 'diamond',
            fillColor: 'red',
            radius: radius * 2
          },
          name: '<br><b>Prediction:</b> ' + prediction + '<b>Volume:</b> '+ volume + this.buildAlgoText(recommendations)
        };
      case 'STRONGSELL':
        return {
          y: close,
          marker: {
            symbol: 'diamond',
            fillColor: 'red',
            radius: radius * 2
          },
          name: '<br><b>Prediction:</b> ' + prediction + '<b>Volume:</b> '+ volume + this.buildAlgoText(recommendations)
        };
      case 'BUY':
        return {
          y: close,
          marker: {
            symbol: 'diamond',
            fillColor: 'green',
            radius: radius * 2
          },
          name: '<br><b>Prediction:</b> ' + prediction + '<b>Volume:</b> ' + volume + this.buildAlgoText(recommendations)
        };
      case 'STRONGBUY':
        return {
          y: close,
          marker: {
            symbol: 'triangle',
            fillColor: 'green',
            radius: radius * 2
          },
          name: '<br><b>Prediction:</b> ' + prediction + '<b>Volume:</b> ' + volume + this.buildAlgoText(recommendations)
        };
      default:
        return {
          y: close,
          marker: {
            enabled: false
          },
          name: '<br><b>Prediction:</b> ' + prediction + '<b>Volume:</b> ' + volume + this.buildAlgoText(recommendations)
        };
    }
  }

  loadBBChart(stock: string, endDate): void {
    this.resolving = true;

    const currentDate = moment(endDate).format('YYYY-MM-DD');
    const startDate = moment(endDate).subtract(700, 'days').format('YYYY-MM-DD');

    this.algo.getInfoV2Chart(stock, currentDate, startDate)
      .map(result => {
        this.initBacktestResults(stock, {}, result.signals);
      })
      .subscribe(
        response => {
          this.stock = stock;
          this.resolving = false;
        },
        err => {
          this.resolving = false;
        }
      );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
