import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as moment from 'moment-timezone';
import { round } from 'lodash-es';
import { GlobalSettingsService } from 'src/app/settings/global-settings.service';
import { MachineLearningService } from './machine-learning/machine-learning.service';

export interface AiPicksPredictionData {
  algorithm: number;
  prediction: number;
  accuracy: number;
  date?: string;
  stock?: string;
  predictionHistory?: AiPicksPredictionDate[];
}

export interface AiPicksPredictionDate {
  date: string;
  prediction: number;
}

export interface AiPicksData {
  label: string;
  value: AiPicksPredictionData[];
}

@Injectable({
  providedIn: 'root'
})
export class AiPicksService {
  tickerBuyRecommendationQueue: Subject<string> = new Subject();
  tickerSellRecommendationQueue: Subject<string> = new Subject();
  addResults: Subject<AiPicksData> = new Subject();
  mlBuyResults: Subject<AiPicksData> = new Subject();
  mlSellResults: Subject<AiPicksData> = new Subject();
  mlNeutralResults: Subject<AiPicksData> = new Subject();
  predictionData: Subject<AiPicksPredictionData> = new Subject();

  clearLists: Subject<boolean> = new Subject();
  constructor(private globalSettingsService: GlobalSettingsService,
    private machineLearningService: MachineLearningService) { }

  async trainAndActivate(symbol, range = 5, limit = 0.001) {
    const endDate = this.globalSettingsService.getLastTradeDate().format('YYYY-MM-DD');
    const startDate = moment(endDate).subtract({ day: 200 }).format('YYYY-MM-DD');
    let trainingResult = null;
    try {
      trainingResult = await this.machineLearningService.trainPredictDailyV4(symbol,
        endDate,
        startDate,
        0.8,
        null,
        range,
        limit
      ).toPromise();
    } catch (error) {
      console.log('error: ', error);
    }
    try {
      const activation = await this.machineLearningService.activateDailyV4(symbol,
        null,
        range,
        limit).toPromise();
      if (activation) {
        this.addResults.next({
          label: symbol, value: [
            {
              algorithm: range,
              prediction: (activation as any).nextOutput,
              accuracy: trainingResult && trainingResult.length > 0 ? trainingResult[0].score : 0
            }
          ]
        })
        return { label: symbol, value: (activation as any).nextOutput };
      } else {
        console.log('no activation data', activation, symbol,
          endDate,
          startDate,
          0.8,
          null,
          range,
          limit);
      }
    } catch (error) {
      console.log(error);
      if (trainingResult && ((trainingResult as any)[0].nextOutput !== null)) {
        return { label: symbol, value: (trainingResult as any)[0].nextOutput };
      } else {
        console.log('Training results missing next output', trainingResult);
      }
    }
    return null;
  }
}
