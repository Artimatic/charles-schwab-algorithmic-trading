import * as moment from 'moment';
import bullPredictionService from "../machine-learning/bull-prediction.service";
import optionsService from "../options/options.service";
import backtestService, { BacktestResults } from "./backtest.service";
import bearPredictionService from '../machine-learning/bear-prediction.service';
import { Indicators } from './backtest.constants';

class BacktestDataService {

    constructor() { }

    private addAverageMove(backtest: BacktestResults): BacktestResults {
        const lastSignal = backtest.signals[backtest.signals.length - 1];
        let highToLowSum = 0;
        backtest.signals.forEach((sig) => {
            highToLowSum += sig.high - sig.low;
        });
        backtest.averageMove = Number((highToLowSum / backtest.signals.length).toFixed(2)) || lastSignal.high - lastSignal.low;
        return backtest;
    }

    private getBuySellSignals(lastSignal: Indicators) {
        const buySignals = [];
        const sellSignals = [];
        for (const indicator in lastSignal.recommendation) {
          if (lastSignal.recommendation.hasOwnProperty(indicator)) {
            if (lastSignal.recommendation[indicator] === 'Bullish') {
              buySignals.push(indicator);
            } else if (lastSignal.recommendation[indicator] === 'Bearish') {
              sellSignals.push(indicator);
            }
          }
        }
        return { buySignals, sellSignals };
      }

    private addBuySellSignals(backtest: BacktestResults): BacktestResults {
        let counter = backtest.signals.length - 1;
        let { buySignals, sellSignals } = this.getBuySellSignals(backtest.signals[counter]);
  
        while (counter > backtest.signals.length - 6) {
          const currentSignalRecommendations = this.getBuySellSignals(backtest.signals[counter]);
          buySignals = buySignals.concat(currentSignalRecommendations.buySignals.filter(indicator => !buySignals.find(sig => sig === indicator)));
          sellSignals = sellSignals.concat(currentSignalRecommendations.sellSignals.filter(indicator => !sellSignals.find(sig => sig === indicator)));
          counter--;
        }
        backtest.buySignals = buySignals;
        backtest.sellSignals = sellSignals;
        return backtest;
    }

    getDefaultData(ticker: string, trainingStartDate, trainingEndDate) {
        ticker = ticker.toUpperCase();
        let finalData;

        return backtestService.initDailyStrategy(ticker, trainingEndDate, trainingStartDate, { minQuotes: 80 })
            .then((dailyData) => {
                finalData = this.addAverageMove(dailyData);
                finalData = this.addBuySellSignals(finalData);
                return optionsService.calculateImpliedMove(null,
                    ticker.toUpperCase(),
                    10,
                    'S',
                    29,
                    null)
            })
            .then((optionsData) => {
                finalData.impliedMovement = optionsData.move;
                return bullPredictionService.train(ticker, trainingStartDate, trainingEndDate, null, finalData);
            })
            .then((buyMl) => {
                if (buyMl[0].nextOutput) {
                    finalData.ml = buyMl[0].nextOutput[0];
                    finalData.mlScore = buyMl[0].score;
                }
                return bearPredictionService.train(ticker, trainingStartDate, trainingEndDate, null, finalData);
            })
            .then((sellMl) => {
                if (sellMl[0].nextOutput) {
                    finalData.sellMl = sellMl[0].nextOutput[0];
                    finalData.sellMlScore = sellMl[0].score;
                }
                finalData.backtestDate = moment().format();
                return finalData;
            })
    }
}

export default new BacktestDataService();