import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';

class AllocationPredictionService extends PredictionService {
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
            currentSignal.recommendation.toUpperCase() === 'STRONGBUY' || currentSignal.recommendation.toUpperCase() === 'BUY' ? 1 : 0,
            currentSignal.recommendation.toUpperCase() === 'STRONGSELL' || currentSignal.recommendation.toUpperCase() === 'SELL' ? 1 : 0,
        ]
            .concat(this.comparePrices(currentSignal.vwma, openingPrice))
            .concat(this.convertRecommendations(currentSignal))
            .concat(this.convertRecommendationsForBearish(currentSignal));

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

    async train(symbol1, symbol2, startDate, endDate, trainingSize, featureUse) {
        const stockList = ['SPY', 'VXX', 'COIN', 'AAPL', 'GOOGL', 'AMZN', 'MSFT', 'TSLA', 'FB', 'NFLX'];
        let dataSet1 = null;
        let dataSet2 = null;
        let spyDataSet = null;
        const trainingData = stockList.map(async (stock) => {
            return await BacktestService.initDailyStrategy(stock, moment(endDate).valueOf(),
                moment(startDate).valueOf(), { minQuotes: 80 });
        });

        return BacktestService.initDailyStrategy(symbol1, moment(endDate).valueOf(),
            moment(startDate).valueOf(), { minQuotes: 80 })
            .then((result: BacktestResults) => {
                dataSet1 = this.processBacktestResults(result, featureUse);
                return BacktestService.initDailyStrategy(symbol2, moment(endDate).valueOf(),
                    moment(startDate).valueOf(), { minQuotes: 80 });
            })
            .then((result: BacktestResults) => {
                dataSet2 = this.processBacktestResults(result, featureUse);
                return BacktestService.initDailyStrategy('SPY', moment(endDate).valueOf(),
                    moment(startDate).valueOf(), { minQuotes: 80 });
            })
            .then((results: BacktestResults) => {
                spyDataSet = this.processBacktestResults(results, featureUse);
                const finalInput = dataSet1.input.concat(dataSet2.input).concat(spyDataSet.input);
                const finalOutput = dataSet1.output.map((val, idx) => {
                    return dataSet1.output[idx] === 1 && dataSet2.output[idx] === 0;
                });

                const finalSet = {
                    date: dataSet1.date,
                    input: finalInput,
                    output: finalOutput
                };

                return BacktestService.trainCustomModel(symbol1 + '_' + symbol2, this.getModelName(),
                    finalSet, trainingSize, moment().format('YYYY-MM-DD'));
            });
    }
}

export default new AllocationPredictionService();
