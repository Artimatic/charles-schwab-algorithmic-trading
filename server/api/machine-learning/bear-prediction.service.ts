import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';
import InputHelperService from './input-helper.service';
import DecisionService from '../mean-reversion/reversion-decision.service';

class BearPredictionService extends PredictionService {
    foundPatterns = [];

    constructor() {
        super(5, -0.01, 'bear_model2025-01-23');
    }

    setOutputRange(range: number) {
        this.outputRange = range;
    }

    setOutputLimit(limit: number) {
        this.outputLimit = limit;
    }

    getModelName() {
        return this.modelName + '_' + this.outputRange + '_' + this.outputLimit;
    }

    getOutput(currentSignal, futureSignal) {
        if (DecisionService.getPercentChange(futureSignal.close, currentSignal.close) < this.outputLimit) {
            return 1;
        }

        return 0;
    }

    buildInputSet(openingPrice, currentSignal, featureUse) {
        const dataSetObj = {
            date: null,
            input: null,
            output: null
        };

        // const hour = Number(moment(currentSignal.date).format('HH'));

        dataSetObj.date = currentSignal.date;

        const input = [
            // _.round(DecisionService.getPercentChange(openingPrice, close) * 1000, 0),
            // _.round(currentSignal.macd[2][currentSignal.macd[2].length - 1] * 1000)
            //(openingPrice > close) ? 0 : 1,
        ]
            // .concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious))
            // .concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
            //.concat(this.convertRecommendations(currentSignal))
            .concat(this.convertRecommendationsForBearish(currentSignal))
            .concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
            .concat(InputHelperService.convertBBandToInput(currentSignal.close, currentSignal.bband80))
            .concat(InputHelperService.convertRsiToInput(currentSignal.rsi))
            .concat(InputHelperService.convertVwmaToInput(currentSignal.vwma, currentSignal.close))
            .concat(InputHelperService.roc(currentSignal.roc10, currentSignal.roc10Previous))
            .concat(InputHelperService.convertObvToInput(currentSignal.obv))
            .concat(this.comparePrices(currentSignal.close, currentSignal.resistance.sort((a, b) => Math.abs(a - currentSignal.close) - Math.abs(b - currentSignal.close))))
            .concat(this.comparePrices(currentSignal.close, currentSignal.support.sort((a, b) => Math.abs(a - currentSignal.close) - Math.abs(b - currentSignal.close))))
            .concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious));
        //         .concat(this.comparePrices(currentSignal.vwma, currentSignal.close))
        //         .concat(this.comparePrices(currentSignal.high, currentSignal.close))
        //         .concat(this.comparePrices(currentSignal.low, currentSignal.close))
        //         .concat(this.convertRecommendations(currentSignal))
        //         .concat(this.convertRecommendationsForBearish(currentSignal));
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

        dataSetObj.input = this.selectFeatures(input, featureUse);

        return dataSetObj;
    }

    getTrainingData(symbol, startDate, endDate, features, data = null) {
        let dataSet1 = null;
        let dataSet2 = null;
        let initialPromise = null;
        if (data) {
            initialPromise = new Promise((resolve) => {
                resolve(data);
            });
        } else {
            initialPromise = BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 });
        }
        return initialPromise
            .then((result: BacktestResults) => {
                dataSet1 = this.processBacktestResults(result, features);
                return BacktestService.initDailyStrategy('VXX', moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 });
            })
            .then((result: BacktestResults) => {
                dataSet2 = this.processBacktestResults(result, null);
                return dataSet1.map((val, idx) => {
                    return {
                        date: val.date,
                        input: dataSet1[idx].input.concat(dataSet2[idx].input),
                        output: [val.output[0] === 1 ? 1 : 0]
                    };
                });
            });
    }

    train(symbol, startDate, endDate, trainingSize, features) {
        return this.getTrainingData(symbol, startDate, endDate, features).then((finalTrainingSet) => {
            return BacktestService.trainTensorModel(symbol, this.getModelName(),
                finalTrainingSet, trainingSize,
                moment().format('YYYY-MM-DD'));
        });
    }

    activate(symbol, startDate, endDate, trainingSize, features) {
        return this.getTrainingData(symbol,
            moment().subtract(85, 'days').format('YYYY-MM-DD'),
            moment().format('YYYY-MM-DD'),
            features).then((finalTrainingSet) => {
                return BacktestService.activateTensorModel(symbol, this.getModelName(),
                    finalTrainingSet,
                    moment().format('YYYY-MM-DD'));
            })
            .catch(() => {
                return this.train(symbol, startDate, endDate, trainingSize, features);
            });
    }
}

export default new BearPredictionService();
