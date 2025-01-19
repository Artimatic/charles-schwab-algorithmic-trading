import * as moment from 'moment';
import * as _ from 'lodash';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';
import InputHelperService from './input-helper.service';

class VolatilityPredictionService extends PredictionService {
    modelName = 'volatility_model2025-01-19';
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

    getOutput(currentSignal, futureSignal) {
        if (futureSignal.mfiLeft > 60 || InputHelperService.convertBBandToInput(futureSignal.close, futureSignal.bband80)[0] === 1) {
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

        const close = currentSignal.close;
        dataSetObj.date = currentSignal.date;

        const input = [
            (openingPrice > close) ? 0 : 1,
        ]
            // .concat(this.comparePrices(currentSignal.vwma, close))
            // .concat(this.comparePrices(currentSignal.high, close))
            // .concat(this.comparePrices(currentSignal.low, close))
            // .concat(this.convertRecommendationsForBearish(currentSignal))
            .concat(InputHelperService.convertMfiToInput(currentSignal.mfiLeft))
            .concat(InputHelperService.convertBBandToInput(currentSignal.close, currentSignal.bband80))
            .concat(InputHelperService.convertRsiToInput(currentSignal.rsi))
            .concat(InputHelperService.convertVwmaToInput(currentSignal.vwma, currentSignal.close))
            .concat(InputHelperService.roc(currentSignal.roc10, currentSignal.roc10Previous))
            .concat(InputHelperService.checkMacd(currentSignal.macd, currentSignal.macdPrevious));
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

    train(startDate, endDate, trainingSize) {
        let dataSet1 = null;
        return BacktestService.initDailyStrategy('VXX', moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
            .then((result: BacktestResults) => {
                dataSet1 = this.processBacktestResults(result, null);

                return BacktestService.trainCustomModel('VXX', this.getModelName(),
                    dataSet1, trainingSize, moment().format('YYYY-MM-DD'));
            });
    }
}

export default new VolatilityPredictionService();
