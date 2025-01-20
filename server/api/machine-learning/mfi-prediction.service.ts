import * as moment from 'moment';
import * as _ from 'lodash';
import DecisionService from '../mean-reversion/reversion-decision.service';

import BacktestService from '../backtest/backtest.service';
import { BacktestResults } from '../backtest/backtest.service';
import PredictionService from './prediction.service';
import InputHelperService from './input-helper.service';

class MfiPredictionService extends PredictionService {
    modelName = 'mfi_model2025-01-20';
    foundPatterns = [];

    constructor() {
        super(10, 0.001);
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
        if (((futureSignal.mfiLeft > currentSignal.mfiLeft)) && DecisionService.getPercentChange(futureSignal.close, currentSignal.close) > this.outputLimit) {
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

    train(symbol, startDate, endDate, trainingSize) {
        let dataSet1 = null;
        return BacktestService.initDailyStrategy(symbol, moment(endDate).valueOf(), moment(startDate).valueOf(), { minQuotes: 80 })
            .then((result: BacktestResults) => {
                dataSet1 = this.processBacktestResults(result, null);

                return BacktestService.trainCustomModel(symbol, this.getModelName(),
                    dataSet1, trainingSize, moment().format('YYYY-MM-DD'));
            });
    }
}

export default new MfiPredictionService();
