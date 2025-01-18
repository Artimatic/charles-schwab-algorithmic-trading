import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService, { FeatureSet } from './prediction.service';
import InputHelperService from './input-helper.service';
import DecisionService from '../mean-reversion/reversion-decision.service';

class BearPredictionService extends PredictionService {
    modelName = 'bear_model2025-01-04';
    foundPatterns = [];

    constructor() {
        super(3, 0.001);
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

    getOutput(currentClose, futureClose) {
        if (this.outputLimit < 0) {
            if (DecisionService.getPercentChange(currentClose, futureClose) < this.outputLimit) {
                return 1;
            }
        } else {
            if (DecisionService.getPercentChange(currentClose, futureClose) > this.outputLimit) {
                return 1;
            }
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

    train(symbol, startDate, endDate, trainingSize) {
        let dataSet1 = null;
        let dataSet2 = null;
        return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
            .then((result: BacktestResults) => {
                dataSet1 = this.processBacktestResults(result, null);
                return BacktestService.initDailyStrategy('VXX', moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 });
            })
            .then((result: BacktestResults) => {
                dataSet2 = this.processBacktestResults(result, null);
                const finalTrainingSet = dataSet1.map((val, idx) => {
                    return {
                        date: val.date,
                        //input: dataSet1[idx].input.concat(dataSet2[idx].input),
                        input: dataSet1[idx].input,
                        output: [val.output[0] === 1 ? 1 : 0]
                    };
                });

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

    // buildInputSet(currentSignal, featureUse) {
    //     const dataSetObj = {
    //         date: null,
    //         input: null,
    //         output: null
    //     };

    //     dataSetObj.date = currentSignal.date;

    //     const input = [
    //         //(currentSignal.open > currentSignal.close) ? 0 : 1,
    //     ]
    //         //.concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
    //         //.concat(InputHelperService.convertBBandToInput(currentSignal.close, currentSignal.bband80))
    //         // .concat(InputHelperService.convertRsiToInput(currentSignal.rsi))
    //         //.concat(InputHelperService.convertVwmaToInput(currentSignal.vwma, currentSignal.close))
    //         // .concat(InputHelperService.roc(currentSignal.roc10, currentSignal.roc10Previous))
    //         //.concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious))
    //         .concat(this.comparePrices(currentSignal.vwma, currentSignal.close))
    //         .concat(this.comparePrices(currentSignal.high, currentSignal.close))
    //         .concat(this.comparePrices(currentSignal.low, currentSignal.close))
    //         .concat(this.convertRecommendations(currentSignal))
    //         .concat(this.convertRecommendationsForBearish(currentSignal));

    //     dataSetObj.input = [];

    //     if (!featureUse) {
    //         featureUse = input.map(val => 1);
    //     }
    //     featureUse.forEach((value, idx) => {
    //         if (value === '1' || value === 1) {
    //             dataSetObj.input.push(input[idx]);
    //         }
    //     });

    //     return dataSetObj;
    // }

    // buildFeatureSet(signals, currentSignal, currentIndex, featureUse) {
    //     const futureClose = signals[currentIndex + this.outputRange].close;
    //     const closePrice = currentSignal.close;

    //     const dataSetObj = this.buildInputSet(currentSignal, featureUse);

    //     dataSetObj.output = [this.getOutput(closePrice, futureClose)];
    //     return dataSetObj;
    // }

    // train(symbol, startDate, endDate, trainingSize, featureUse) {
    //     let dataSet1 = null;
    //     let dataSet2 = null;
    //     return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(),
    //         moment(startDate).valueOf(), { minQuotes: 80 })
    //         .then((result: BacktestResults) => {
    //             dataSet1 = this.processBacktestResults(result, featureUse);
    //         //     return BacktestService.initDailyStrategy('VXX', moment(endDate).valueOf(),
    //         //         moment(startDate).valueOf(), { minQuotes: 80 });
    //         // })
    //         // .then((result: BacktestResults) => {
    //         //     dataSet2 = this.processBacktestResults(result, featureUse);
    //         //     return BacktestService.initDailyStrategy('TLT', moment(endDate).valueOf(),
    //         //         moment(startDate).valueOf(), { minQuotes: 80 });
    //         // })
    //         // .then((results: BacktestResults) => {
    //         //     dataSet2 = this.processBacktestResults(results, featureUse);

    //             const finalTrainingSet = dataSet1.map((val, idx) => {
    //                 return {
    //                     date: val.date,
    //                     //input: dataSet1[idx].input.concat(dataSet2[idx].input),
    //                     input: dataSet1[idx].input,
    //                     output: [val.output === 1 ? 1 : 0]
    //                 };
    //             });

    //             return BacktestService.trainCustomModel(symbol, this.getModelName(),
    //                 finalTrainingSet, trainingSize, moment().format('YYYY-MM-DD')).then((model) => {
    //                     model.push(finalTrainingSet);
    //                     return model;
    //                 });
    //         });
    // }
}

export default new BearPredictionService();
