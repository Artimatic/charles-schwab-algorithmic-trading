import { BacktestResults } from '../backtest/backtest.service';
import { Indicators } from '../backtest/backtest.constants';

import DecisionService from '../mean-reversion/reversion-decision.service';
import * as _ from 'lodash';

export interface FeatureSet {
  date: string;
  input: number[];
  output: number[];
}

export default class PredictionService {
  outputRange: number;
  outputLimit: number;
  modelName = 'prediction';

  constructor(range, limit, modelName) {
    this.outputRange = range;
    this.outputLimit = limit;
    this.modelName = modelName;
  }

  getModelName(name = '') {
    return name + this.modelName + '_' + this.outputRange + '_' + this.outputLimit;
  }

  processBacktestResults(results: BacktestResults, featureUse): FeatureSet[] {
    const signals = results.signals;
    console.log('Got backtest: ', signals[0].date, signals[signals.length - 1].date);

    const finalDataSet = [];
    signals.forEach((signal, idx) => {
      finalDataSet.push(this.buildFeatureSet(signals, signal, idx, featureUse));

    });
    console.log('Data set size: ', finalDataSet.length);
    return finalDataSet;
  }

  selectFeatures(input, featureUse) {
    if (!featureUse || !featureUse.length) {
      return input;
    }
    return input.map((val, idx) => {
      if (idx < featureUse.length) {
        if (featureUse[idx] === '1' || featureUse[idx] === 1) {
          if (input[idx] === null) {
            return 0;
          } else {
            return val;
          }
        }
      }
      return val;
    });
  }

  buildFeatureSet(signals, currentSignal, currentIndex, featureUse) {
    const dataSetObj = this.buildInputSet(currentSignal.open, currentSignal, featureUse);
    const futureIdx = currentIndex + this.outputRange;
    if (futureIdx < signals.length) {
      const output = this.getOutput(currentSignal, signals[futureIdx]);
      dataSetObj.output = [output];
    } else {
      dataSetObj.output = [0];
    }
    return dataSetObj;
  }

  buildInputSet(openingPrice, currentSignal, featureUse) {
    if (!featureUse) {
      featureUse = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    }

    const dataSetObj = {
      date: null,
      input: null,
      output: null
    };

    const close = currentSignal.close;
    // const hour = Number(moment(currentSignal.date).format('HH'));

    dataSetObj.date = currentSignal.date;

    // 1,0,1,0,1,0,1,0,1,1,1,1,0: 6
    // 1,0,1,0,1,1,1,1,1,0,0,1,1: 5
    // 1,0,1,0,1,1,1,1,1,1,1,0,0: 5
    // 1,1,1,1,1,1,1,1,1,1,1,1,1
    const input = [
      _.round(DecisionService.getPercentChange(openingPrice, close) * 1000, 0),
      _.round(currentSignal.macd[2][currentSignal.macd[2].length - 1] * 1000)
    ]
      .concat(this.comparePrices(currentSignal.vwma, close))
      .concat(this.comparePrices(currentSignal.high, close))
      .concat(this.comparePrices(currentSignal.low, close))
      .concat(this.convertRecommendations(currentSignal))
      .concat([this.convertBBand(currentSignal)])
      // .concat([
      //   _.round(currentSignal.high, 2),
      //   _.round(currentSignal.low, 2),
      //   _.round(currentSignal.vwma, 2),
      // ])
      // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.vwma) * 1000, 2)])
      // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.high) * 1000, 2)])
      // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.low) * 1000, 2)])
      .concat([_.round(currentSignal.mfiLeft, 0)])
      .concat([_.round(currentSignal.rsi, 0)]);

    dataSetObj.input = this.selectFeatures(input, featureUse);

    return dataSetObj;
  }

  getOutput(currentSignal, futureSignal) {
    if (DecisionService.getPercentChange(futureSignal.close, currentSignal.close) > this.outputLimit) {
      return 1;
    }

    return 0;
  }

  convertRecommendations(signal: Indicators) {
    let input = [];
    const targetRecommendation = 'bullish';
    if (signal && signal.recommendation) {
      input = this.recommendationToInput(signal, input, targetRecommendation);
    } else {
      console.log('Error converting recommendation. Recommendation missing ', signal);
    }

    return input;
  }

  convertRecommendationsForBearish(signal: Indicators) {
    let input = [];
    const targetRecommendation = 'bearish';
    if (signal && signal.recommendation) {
      input = this.recommendationToInput(signal, input, targetRecommendation);
    } else {
      console.log('Missing recommendation: ', signal);
    }

    return input;
  }

  recommendationToInput(signal: Indicators, input, targetRecommendation) {
    for (const rec in signal.recommendation) {
      if (signal.recommendation.hasOwnProperty(rec)) {
        if (signal.recommendation[rec] && signal.recommendation[rec].toLowerCase) {
          if (signal.recommendation[rec].toLowerCase() === targetRecommendation) {
            input.push(1);
          } else {
            input.push(0);
          }
        }
      }
    }

    return input;
  }
  comparePrices(price, close) {
    if (close < price) {
      return 1;
    }
    return 0;
  }

  convertBBand(currentSignal) {
    if (currentSignal.bband80 && currentSignal.bband80.length === 3 &&
      currentSignal.bband80[0].length > 0 &&
      currentSignal.bband80[2].length > 0) {
      const lower = currentSignal.bband80[0][0];
      const currentClose = currentSignal.close;
      if (currentClose < lower) {
        return 1;
      }
      return 0;
    } else {
      return 0;
    }
  }
}
