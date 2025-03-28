import * as moment from 'moment';
import * as _ from 'lodash';
import * as RequestPromise from 'request-promise';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';

import TrainingService from './training.service';
import * as configurations from '../../config/environment';

import { patternFinderService } from './pattern-finder.service';
import InputHelperService from './input-helper.service';

const mlServiceUrl = configurations.apps.armadillo;

class VariableDailyPredicationService extends PredictionService {
  foundPatterns = [];

  constructor() {
    super(3, 0.001, 'dailymodel2025-01-04');
  }

  setOutputRange(range: number) {
    this.outputRange = range;
  }

  setOutputLimit(limit: number) {
    this.outputLimit = limit;
  }

  getModelName() {
    return 'daily_' + this.outputRange + '_' + this.outputLimit;
  }

  buildInputSet(openingPrice, currentSignal, featureUse) {
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
      // _.round(DecisionService.getPercentChange(openingPrice, close) * 1000, 0),
      // _.round(currentSignal.macd[2][currentSignal.macd[2].length - 1] * 1000)
      (openingPrice > close) ? 0 : 1,
    ]
      .concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious))
      .concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
      .concat(this.comparePrices(currentSignal.vwma, close))
      .concat(this.comparePrices(currentSignal.high, close))
      .concat(this.comparePrices(currentSignal.low, close))
      .concat(this.convertRecommendations(currentSignal))
      .concat(this.convertRecommendationsForBearish(currentSignal));
    // .concat([this.convertBBand(currentSignal)])
    // .concat([
    //   _.round(currentSignal.high, 2),
    //   _.round(currentSignal.low, 2),
    //   _.round(currentSignal.vwma, 2),
    // ])
    // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.vwma) * 1000, 2)])
    // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.high) * 1000, 2)])
    // .concat([_.round(DecisionService.getPercentChange(close, currentSignal.low) * 1000, 2)])
    // .concat([_.round(currentSignal.mfiLeft, 0)])
    // .concat([_.round(currentSignal.rsi, 0)]);

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

  train(symbol, startDate, endDate, trainingSize, featureUse) {
    return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
      .then((results: BacktestResults) => {
        const finalDataSet = this.processBacktestResults(results, featureUse);
        const foundPatterns = patternFinderService.findPatternsInFeatureSet(symbol, finalDataSet.slice(finalDataSet.length - 30, finalDataSet.length));
        if (foundPatterns.length > 0) {
          this.foundPatterns.push(foundPatterns);
          if (this.foundPatterns.length > 25) {
            this.foundPatterns.shift();
          }
        }
        return BacktestService.trainCustomModel(symbol, this.getModelName(), finalDataSet, trainingSize, moment().format('YYYY-MM-DD'));
      });
  }

  activate(symbol, featureUse) {
    let price = null;
    let openingPrice = null;
    let indicator = null;
    return TrainingService.buildDailyQuotes(symbol, moment().subtract({ days: 120 }).valueOf(), moment().valueOf())
      .then((quotes) => {
        const subQuotes = quotes.slice(quotes.length - 80, quotes.length);
        if (!quotes.slice) {
          throw new Error(`VariableDailyPredicationService failed to get quotes ${JSON.stringify(quotes)}`);
        }
        price = quotes[quotes.length - 1].close;
        openingPrice = quotes[0].close;
        return BacktestService.initStrategy(subQuotes);
      })
      .then((lastDayIndicator) => {
        indicator = lastDayIndicator;
        return BacktestService.createDaytradeRecommendation(price, indicator);
      })
      .then((recommendation) => {
        indicator.recommendation = recommendation;
        return indicator;
      })
      .then((signal) => {
        const inputData = this.buildInputSet(openingPrice, signal, featureUse);
        return BacktestService.activateCustomModel(symbol, this.getModelName(), inputData.input, moment().format('YYYY-MM-DD'));
      });
  }

  getDataSet(symbol, startDate, endDate, trainingSize, featureUse) {
    return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
      .then((results: BacktestResults) => {
        return this.processBacktestResults(results, featureUse);
      });
  }

  scoreV4(symbol, startDate, endDate, featureUse) {
    const URI = `${mlServiceUrl}api/score-custom`;

    return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
      .then((results: BacktestResults) => {
        const finalDataSet = this.processBacktestResults(results, featureUse);
        const options = {
          method: 'POST',
          uri: URI,
          body: {
            symbol,
            modelName: this.getModelName(),
            trainingData: finalDataSet
          },
          json: true
        };

        return RequestPromise(options)
          .catch((error) => {
            console.log('train-custom error: ', error.message);
          });
      });

  }

  getFoundPatterns() {
    return this.foundPatterns;
  }
}

export default new VariableDailyPredicationService();
