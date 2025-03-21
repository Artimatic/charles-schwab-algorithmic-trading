import { Component, OnDestroy, OnInit } from '@angular/core';
import { MachineLearningService } from '@shared/index';
import { AiPicksService } from '@shared/services';
import { AiPicksData, AiPicksPredictionData } from '@shared/services/ai-picks.service';
import * as moment from 'moment';
import * as _ from 'lodash';

import { SchedulerService } from '@shared/service/scheduler.service';

@Component({
  selector: 'app-ai-picks',
  templateUrl: './ai-picks.component.html',
  styleUrls: ['./ai-picks.component.css']
})
export class AiPicksComponent implements OnInit, OnDestroy {
  buys: AiPicksData[] = [];
  sells: AiPicksData[] = [];
  history: AiPicksData[] = [];

  buysLimit = 3;
  sellsLimit = 3;
  isLoading = false;
  counter = 0;
  historicalStock = '';
  endDate;
  showChart = false;
  chart;
  currentPrediction = null;

  constructor(private aiPicksService: AiPicksService,
    private machineLearningService: MachineLearningService,
    private schedulerService: SchedulerService
  ) { }

  ngOnInit() {
    this.aiPicksService.tickerBuyRecommendationQueue.subscribe(stock => {
      this.getPredictions(stock, true);
    });

    this.aiPicksService.tickerSellRecommendationQueue.subscribe(stock => {
      this.getPredictions(stock, false);
    });

    this.aiPicksService.addResults.subscribe((rec: AiPicksData) => {
      if (rec.value[0].prediction > 0.5) {
        this.addBuyPick(rec.label, rec.value[0]);
      } else {
        this.addSellPick(rec.label, rec.value[0]);
      }
    });

    this.aiPicksService.clearLists.subscribe(() => {
      this.buys = [];
      this.sells = [];
    });
  }

  getPredictions(stock, isBuy) {
    const TenDayPrediction = () => {
      this.schedulerService.schedule(() => {
        this.activate(stock, 10, 0.001, isBuy, null, () => { });
      }, 'aipicks', 300000);
    };

    const FiveDayPrediction = () => {
      this.schedulerService.schedule(() => {
        this.activate(stock, 5, 0.001, isBuy, null, TenDayPrediction);
      }, 'aipicks', 300000);
    };

    FiveDayPrediction();
  }

  activate(symbol: string, range, limit, isBuy: boolean, accuracy: number = null, cb: () => void) {
    this.isLoading = true;
    this.counter++;
    this.machineLearningService.activateDailyV4(symbol,
      null,
      range,
      limit)
      .subscribe((activation) => {
        this.counter--;
        if (!activation) {
          this.schedulerService.schedule(() => {
            this.trainAndActivate(symbol, range, limit, isBuy, null, cb);
          }, 'aipicks', 300000);
        } else {
          const prediction = { algorithm: range, prediction: activation.nextOutput, accuracy: accuracy };
          const item = this.createListObject(symbol, prediction);
          this.aiPicksService.mlNeutralResults.next(item);
          if (prediction.prediction > 0.5) {
            this.addBuyPick(symbol, prediction);
          } else {
            this.addSellPick(symbol, prediction);
          }

          this.schedulerService.schedule(() => {
            cb();
          }, 'aipicks', 300000);
        }
        this.isLoading = false;
      }, error => {
        this.aiPicksService.mlNeutralResults.next(null);
        this.counter--;
        console.log('error on activation ', error);
        this.isLoading = false;
      });
  }

  trainAndActivate(symbol, range, limit, isBuy, endDate: string = null, cb: () => void = null, activate = true) {
    this.isLoading = true;
    this.counter++;
    if (!endDate) {
      endDate = moment().format('YYYY-MM-DD');
    }
    const startDate = moment(endDate).subtract({ day: 365 }).format('YYYY-MM-DD');
    const historicalDate = this.endDate;
    this.machineLearningService.trainPredictDailyV4(symbol,
      endDate,
      startDate,
      0.7,
      null,
      range,
      limit
    )
      .subscribe((data) => {
        const score = _.round(data[0].score, 3);
        this.counter--;
        let delay = 0;
        if (this.counter > 0) {
          delay = 2000 + 1000 * this.counter;
        }
        if (activate) {
          setTimeout(() => {
            this.activate(symbol, range, limit, isBuy, score, cb);
          }, delay);
        } else {
          const prediction = {
            stock: symbol,
            algorithm: range,
            prediction: data[0].nextOutput,
            accuracy: score,
            predictionHistory: data[0].predictionHistory
          };

          this.addHistoricalPrediction(symbol, prediction, historicalDate);
        }

        this.isLoading = false;
      }, error => {
        this.counter--;
        this.activate(symbol, range, limit, isBuy, 0, cb);
        console.log('error: ', error);
        this.isLoading = false;
      });
  }

  addSellPick(symbol: string, predictionData: AiPicksPredictionData) {
    const isSellPick = (element: AiPicksData) => element.label === symbol;

    const index = this.sells.findIndex(isSellPick);

    if (index >= 0) {
      if (this.sells[index].value.length > 1) {
        this.sells[index].value = [];
      }
      this.sells[index].value.push(predictionData);
    } else {
      const sellItem = this.createListObject(symbol, predictionData);
      this.aiPicksService.mlSellResults.next(sellItem);

      this.sells.push(sellItem);
    }
  }

  addBuyPick(symbol: string, predictionData: AiPicksPredictionData) {
    const item = this.createListObject(symbol, predictionData);
    sessionStorage.setItem('lastBuyPick', JSON.stringify(item));

    this.aiPicksService.mlBuyResults.next(item);

    const isBuyPick = (element: AiPicksData) => element.label === symbol;

    const index = this.buys.findIndex(isBuyPick);

    if (index >= 0) {
      if (this.buys[index].value.length > 1) {
        this.buys[index].value = [];
      }
      this.buys[index].value.push(predictionData);
    } else {
      this.buys.push(item);
    }
  }

  addHistoricalPrediction(symbol, predictionData: AiPicksPredictionData, date: string) {
    this.currentPrediction = predictionData;
    predictionData.date = date;
    const item = this.createListObject(symbol, predictionData);

    const isPick = (element: AiPicksData) => element.label === symbol;

    const index = this.history.findIndex(isPick);
    if (index >= 0) {
      this.history[index].value.push(predictionData);
    } else {
      this.history.push(item);
    }
  }

  trainStock() {
    this.historicalStock = this.historicalStock.toUpperCase();
    const date = moment(this.endDate).format('YYYY-MM-DD');
    const TenDayPrediction = () => this.trainAndActivate(this.historicalStock, 10, 0.01, false, date, () => { }, false);
    const FivePrediction = () => this.trainAndActivate(this.historicalStock, 5, 0.01, false, date, TenDayPrediction, false);

    FivePrediction();
  }

  createListObject(symbol: string, predictionData: AiPicksPredictionData): AiPicksData {
    return { label: symbol, value: [predictionData] };
  }

  removeFromBuyList(name) {
    const idx = this.buys.findIndex(element => element.label === name);
    this.buys.splice(idx, 1);
  }

  removeFromSellList(name) {
    const idx = this.sells.findIndex(element => element.label === name);
    this.sells.splice(idx, 1);
  }

  removeFromHistoryList(name) {
    const idx = this.history.findIndex(element => element.label === name);
    this.history.splice(idx, 1);
  }

  removeAllBuys() {
    this.buys = [];
  }

  removeAllSells() {
    this.sells = [];
  }

  updateChart() {
    const predictionHistory = this.currentPrediction;

    this.aiPicksService.predictionData.next(predictionHistory);
  }

  ngOnDestroy() {
    this.aiPicksService.tickerBuyRecommendationQueue.unsubscribe();
    this.aiPicksService.tickerSellRecommendationQueue.unsubscribe();
    this.aiPicksService.clearLists.unsubscribe();
  }
}
