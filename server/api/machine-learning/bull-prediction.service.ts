import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService, { FeatureSet } from './prediction.service';
import InputHelperService from './input-helper.service';

class BullPredictionService extends PredictionService {
    foundPatterns = [];

    constructor() {
        super(10, 0.01, 'bull_model2025-01-23');
    }

    setOutputRange(range: number) {
        this.outputRange = range;
    }

    setOutputLimit(limit: number) {
        this.outputLimit = limit;
    }

    buildInputSet(openingPrice, currentSignal, featureUse) {
        const dataSetObj = {
            date: null,
            input: null,
            output: null
        };

        // const hour = Number(moment(currentSignal.date).format('HH'));

        dataSetObj.date = currentSignal.date;

        const input = []
            //.concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious))
            .concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
            .concat(InputHelperService.convertBBandToInput(currentSignal.close, currentSignal.bband80))
            .concat(InputHelperService.convertObvToInput(currentSignal.obv))
            .concat(InputHelperService.convertRsiToInput(currentSignal.rsi))
            //.concat(InputHelperService.convertVwmaToInput(currentSignal.vwma, currentSignal.close))
            //.concat(InputHelperService.roc(currentSignal.roc10, currentSignal.roc10Previous))
            .concat(this.comparePrices(currentSignal.vwma, currentSignal.close))
            .concat(this.comparePrices(currentSignal.vwma, currentSignal.high))
            .concat(this.comparePrices(currentSignal.vwma, currentSignal.low))
            .concat(this.comparePrices(currentSignal.close, currentSignal.resistance.sort((a, b) => Math.abs(a - currentSignal.close) - Math.abs(b - currentSignal.close))))
            .concat(this.comparePrices(currentSignal.close, currentSignal.support.sort((a, b) => Math.abs(a - currentSignal.close) - Math.abs(b - currentSignal.close))))
            .concat(this.convertRecommendations(currentSignal));

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

            // return BacktestService.trainCustomModel(symbol, this.getModelName(),
            //     finalTrainingSet, trainingSize, moment().format('YYYY-MM-DD')).then((model) => {
            //         model.push(finalTrainingSet);
            //         return model;
            //     });

            // const finalDataSet = this.processBacktestResults(results, featureUse);
            // return BacktestService.trainCustomModel(symbol, this.getModelName(), finalDataSet, trainingSize, moment().format('YYYY-MM-DD'));
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

export default new BullPredictionService();
