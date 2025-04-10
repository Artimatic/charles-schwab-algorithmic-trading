import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PortfolioService from '../portfolio/portfolio.service';
import PredictionService from './prediction.service';

class IntradayPredicationService extends PredictionService {

  constructor() {
    super(16, 0, 'intradaymodel2025-02-14');
  }

  train(symbol, startDate, endDate, trainingSize, featureUse) {
    console.log('Getting data for', this.modelName);
    return BacktestService.runDaytradeBacktest(symbol, endDate, startDate,
      {
        lossThreshold: 0.003,
        profitThreshold: 0.02,
        minQuotes: 81
      })
      .then((results: BacktestResults) => {
        const finalDataSet = this.processBacktestResults(results, featureUse);
        console.log(this.getModelName());
        return BacktestService.trainTensorModel(symbol, this.getModelName(), finalDataSet, trainingSize, moment().format('YYYY-MM-DD'));
        // return BacktestService.trainCustomModel(symbol, this.getModelName(), finalDataSet, trainingSize, moment().format('YYYY-MM-DD'));
      });
  }

  activate(symbol, featureUse) {
    return this.getQuotes(symbol, moment().subtract({ days: 1 }).valueOf(), moment().valueOf())
      .then((quotes) => {
        return this.getIndicators(quotes);
      })
      .then((signalData) => {
        return this.activateModel(symbol, signalData, featureUse);
      });
  }


  getQuotes(symbol, start, end) {
    return PortfolioService.getIntradayV3(symbol, start, end, null);
  }

  getIndicators(quotes) {
    let price = null;
    let indicator = null;
    const subQuotes = quotes.slice(quotes.length - 80, quotes.length);
    if (!quotes.slice) {
      throw new Error(`getIndicators failed to get quotes ${JSON.stringify(quotes)}`);
    }
    price = quotes[quotes.length - 1].close;
    return BacktestService.initStrategy(subQuotes)
      .then((indicators) => {
        indicator = indicators;
        return BacktestService.createDaytradeRecommendation(price, indicator);
      })
      .then((recommendation) => {
        indicator.recommendation = recommendation;
        return indicator;
      });
  }

  activateModel(symbol, indicatorData, featureUse) {
    if (!featureUse) {
      featureUse = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    }
    const signal = indicatorData;
    const inputData = this.buildInputSet(null, signal, featureUse);
    console.log('Activate model for', this.modelName, inputData);
    return BacktestService.activateTensorModel(symbol, this.getModelName(),
      inputData,
      moment().format('YYYY-MM-DD'));
  }

  processBacktestResults(results: BacktestResults, featureUse): any[] {
    const signals = results.signals;
    const finalDataSet = [];
    signals.forEach((signal, idx) => {
      finalDataSet.push(this.buildFeatureSet(signals, signal, idx, featureUse));
    });
    console.log('Data set size: ', finalDataSet.length);
    return finalDataSet;
  }

  buildInputSet(openPrice, currentSignal, featureUse) {
    const dataSetObj = {
      date: null,
      input: null,
      output: null
    };

    const close = currentSignal.close;
    dataSetObj.date = currentSignal.date;

    const input = []
      .concat(this.comparePrices(currentSignal.vwma, close))
      .concat(this.convertRecommendations(currentSignal))
      .concat(this.convertRecommendationsForBearish(currentSignal));

    dataSetObj.input = [];

    if (!featureUse || !featureUse.length) {
      console.log('Bad feature data', featureUse);
      featureUse = input.map(val => 1);
    }

    dataSetObj.input = this.selectFeatures(input, featureUse);
    return dataSetObj;
  }
}

export default new IntradayPredicationService();
