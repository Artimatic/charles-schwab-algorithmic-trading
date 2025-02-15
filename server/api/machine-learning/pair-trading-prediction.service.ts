import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';

import * as configurations from '../../config/environment';

class PairTradingPredicationService extends PredictionService {
  foundPatterns = [];

  constructor() {
    super(10, 0.001, 'pair_trading_model2025-01-14');
  }

  setOutputRange(range: number) {
    this.outputRange = range;
  }

  setOutputLimit(limit: number) {
    this.outputLimit = limit;
  }

  getModelName() {
    return this.modelName + this.outputRange + '_' + this.outputLimit;
  }

  buildInputSet(openingPrice, currentSignal, featureUse) {
    const dataSetObj = {
      date: null,
      input: null,
      output: null
    };

    dataSetObj.date = currentSignal.date;
    const input = [
      currentSignal.action === 'STRONGBUY' || currentSignal.action === 'BUY' ? 1 : 0,
      currentSignal.action === 'STRONGSELL' || currentSignal.action === 'SELL' ? 1 : 0,
    ]
      .concat(this.convertRecommendations(currentSignal));

    dataSetObj.input = [];

    if (!featureUse) {
      featureUse = input.map(val => 1);
    }
    featureUse.forEach((value, idx) => {
      if (value === '1' || value === 1) {
        dataSetObj.input.push(input[idx]);
      }
    });

    return dataSetObj;
  }

  train(symbol1, symbol2, startDate, endDate, trainingSize, featureUse) {
    let dataSet1 = null;
    let dataSet2 = null;
    let dataSet3 = null;
    return BacktestService.initDailyStrategy(symbol1, moment(endDate).valueOf(),
      moment(startDate).valueOf(), { minQuotes: 80 })
      .then((result: BacktestResults) => {
        dataSet1 = this.processBacktestResults(result, featureUse);
        return BacktestService.initDailyStrategy(symbol2, moment(endDate).valueOf(),
          moment(startDate).valueOf(), { minQuotes: 80 });
      })
      .then((result: BacktestResults) => {
        dataSet2 = this.processBacktestResults(result, featureUse);
        return BacktestService.initDailyStrategy('VXX', moment(endDate).valueOf(),
          moment(startDate).valueOf(), { minQuotes: 80 });
      })
      .then((results: BacktestResults) => {
        dataSet3 = this.processBacktestResults(results, featureUse);
        const finalTrainingSet = dataSet1.map((val, idx) => {
          return {
            date: val.date,
            input: dataSet1[idx].input.concat(dataSet2[idx].input).concat(dataSet3[idx].input),
            output: [val.output[0] === 1 ? 1 : 0]
          };
        });

        return BacktestService.trainTensorModel(symbol1 + '_' + symbol2, this.getModelName(), 
        finalTrainingSet, trainingSize, 
        moment().format('YYYY-MM-DD'));

        // return BacktestService.trainCustomModel(symbol1 + '_' + symbol2, this.getModelName(),
        //   finalTrainingSet, trainingSize, moment().format('YYYY-MM-DD'));
      });
  }
}

export default new PairTradingPredicationService();
