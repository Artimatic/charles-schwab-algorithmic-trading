import * as moment from 'moment';
import * as _ from 'lodash';
import * as RequestPromise from 'request-promise';

import QuoteService from '../quote/quote.service';
import PortfolioService from '../portfolio/portfolio.service';
import ReversionService from '../mean-reversion/reversion.service';
import DecisionService from '../mean-reversion/reversion-decision.service';
import BaseErrors from '../../components/errors/baseErrors';
import * as tulind from 'tulind';
import * as configurations from '../../config/environment';
import AlgoService from './algo.service';
import BBandBreakoutService from './bband-breakout.service';
import MfiService from './mfi.service';
import DaytradeRecommendations from './daytrade-recommendations';
import { Recommendation, DaytradeRecommendation, OrderType, Indicators } from './backtest.constants';
import supportResistanceService from './support-resistance.service';

const dataServiceUrl = configurations.apps.goliath;
const mlServiceUrl = configurations.apps.armadillo;

const config = {
  shortTerm: [5, 110],
  longTerm: [10, 290]
};

export interface DaytradeParameters {
  mfiRange?: number[];
  bbandPeriod?: number;
  lossThreshold?: number;
  profitThreshold?: number;
  minQuotes: number;
}

export interface DaytradeAlgos {
  mfi?: string;
  bband?: string;
  momentum?: string;
}

export interface BacktestResults {
  symbol?: string;
  algo: string;
  recommendation?: string;
  orderHistory: any[];
  net: number;
  total: number;
  signals?: Indicators[];
  totalTrades: number;
  invested?: number;
  returns: number;
  lastVolume?: number;
  lastPrice?: number;
  startDate?: number;
  endDate?: number;
  upperResistance?: number;
  lowerResistance?: number;
  profitableTrades?: any;
  averageMove?: number;
  buySignals?: string[];
  sellSignals?: string[];
}

let startTime;
let endTime;

class BacktestService {
  tdRequestCount = 0;
  tiingoRequestCount = 0;
  tdThrottleExpiry = null;
  tiingoThrottleExpiry = null;
  lastRequest = null;
  lastRequestCount = 0;

  getIndicator() {
    return tulind.indicators;
  }

  getBBands(real, period, stddev) {
    return tulind.indicators.bbands.indicator([real], [period, stddev]);
  }

  getSMA(real, period) {
    return tulind.indicators.sma.indicator([real], [period]);
  }

  getRateOfChange(real, period) {
    return tulind.indicators.roc.indicator([real], [period]);
  }

  getVwma(close, volume, period) {
    return tulind.indicators.vwma.indicator([close, volume], [period]);
  }

  getMacd(real, shortPeriod, longPeriod, signalPeriod) {
    return tulind.indicators.macd.indicator([real], [shortPeriod, longPeriod, signalPeriod]);
  }

  getRsi(real, period) {
    return tulind.indicators.rsi.indicator([real], [period]);
  }

  getObv(close, volume) {
    return tulind.indicators.obv.indicator([close, volume], []);
  }

  getDemark9(close, high, low) {
    let perfectSell = true;
    let perfectBuy = true;
    for (let i = 4; i < 10; i++) {
      if (perfectSell) {
        if (close[i] < close[i - 4]) {
          perfectSell = false;
        }
      }
      if (perfectBuy) {
        if (close[i] > close[i - 4]) {
          perfectBuy = false;
        }
      }
    }

    if (perfectSell) {
      if ((high[11] < high[10] || high[11] < high[9]) || close[12] < close[8]) {
        perfectSell = false;
      }
    }
    if (perfectBuy) {
      if ((low[11] > low[10] || low[11] > low[9]) || close[12] > close[8]) {
        perfectBuy = false;
      }
    }
    return { perfectSell, perfectBuy };
  }

  processIndicators(intradayObj, period: number = 80) {
    const getIndicatorQuotes = [];
    const quotes = intradayObj.candles ? intradayObj.candles : intradayObj;
    if (!quotes.slice) {
      throw new Error(`processIndicators failed to get quotes ${JSON.stringify(quotes)}`);
    }
    _.forEach(quotes, (value, key) => {
      const idx = Number(key);
      const minLength = idx - period > 0 ? idx - period : idx - 14;
      const q = quotes.slice(minLength, idx);
      if (q.length > 0) {
        getIndicatorQuotes.push(this.initStrategy(q));
      }
    });
    return Promise.all(getIndicatorQuotes)
      .then((indicators: Indicators[]) => {
        return this.addOnDaytradeIndicators(indicators);
      });
  }

  getCurrentDaytradeIndicators(symbol, period = 80, dataSource = 'td'): Promise<Indicators> {
    return DaytradeRecommendations.getIntradayQuotes(symbol, dataSource)
      .then(intradayObj => {
        return this.processIndicators(intradayObj, period);
      })
      .then(indicators => {
        return indicators[indicators.length - 1];
      })
      .catch(err => {
        console.log('ERROR! getIntradayV2', err);
        return Promise.reject(err);
      });
  }

  addOnDaytradeIndicators(indicators: Indicators[]) {
    let isMfiLowIdx = -1;
    let isMfiHighIdx = -1;
    let macdBuyIdx = -1;
    let macdSellIdx = -1;
    let bbandBuyIdx = -1;

    _.forEach(indicators, (indicator, idx) => {
      if (idx > 80) {
        const mfi = AlgoService.checkMfi(indicator.mfiLeft);
        const macd = AlgoService.checkMacdDaytrade(indicator.macd, indicator.macdPrevious);
        if ((idx - isMfiHighIdx) > 5 || (idx - isMfiLowIdx) > 5) {
          indicators[idx].mfiTrend = null;
        }

        const bbandRecommendation = AlgoService.checkBBand(indicator.close,
          AlgoService.getLowerBBand(indicator.bband80), AlgoService.getUpperBBand(indicator.bband80));

        if (mfi === DaytradeRecommendation.Bullish) {
          isMfiLowIdx = idx;
        } else if (mfi === DaytradeRecommendation.Bearish) {
          isMfiHighIdx = idx;
        } else if (isMfiLowIdx > -1 && (idx - isMfiLowIdx) < 5 &&
          (macd === DaytradeRecommendation.Bullish || (idx - macdBuyIdx) < 3)) {
          indicators[idx].mfiTrend = true;
        } else if (isMfiHighIdx > -1 && (idx - isMfiHighIdx) < 5 &&
          (macd === DaytradeRecommendation.Bearish || (idx - macdSellIdx) < 3)) {
          indicators[idx].mfiTrend = false;
        } else if (macd === DaytradeRecommendation.Bullish) {
          macdBuyIdx = idx;
        } else if (macd === DaytradeRecommendation.Bearish) {
          macdSellIdx = idx;
        } else if (bbandRecommendation === DaytradeRecommendation.Bullish) {
          bbandBuyIdx = idx;
        }

        if (isMfiLowIdx > -1 && (idx - isMfiLowIdx) < 33 && (idx - isMfiLowIdx) > 5 &&
          (bbandRecommendation === DaytradeRecommendation.Bullish || (idx - macdBuyIdx) < 3)) {
          indicators[idx].mfiTrend = true;
        } else if ((isMfiLowIdx > -1 && bbandBuyIdx > -1 && macdBuyIdx > -1) &&
          ((idx - isMfiLowIdx) < 6) && ((idx - bbandBuyIdx) < 6) && ((idx - macdBuyIdx) < 6)) {
          indicators[idx].mfiTrend = true;
        }
      }
    });
    return indicators;
  }

  evaluateStrategyAll(ticker, end, start) {
    console.log('Executing: ', ticker, new Date());
    startTime = moment();
    this.runTest(ticker, end, start);
  }

  evaluateIntradayAlgo(ticker, end, start) {
    return this.runIntradayEvaluation(ticker, end, start);
  }

  intradayTest(ticker, end, start) {
    console.log('Executing: ', ticker, new Date());
    startTime = moment();
    return this.runIntradayTest(ticker, end, start);
  }

  getDateRanges(currentDate, startDate) {
    const current = moment(currentDate),
      start = moment(startDate);

    const days = current.diff(start, 'days') + 1;

    return {
      end: current.format(),
      start: start.subtract(this.getTradeDays(days), 'days').format()
    };
  }

  getData(ticker, currentDate, startDate) {
    const { end, start } = this.getDateRanges(currentDate, startDate);

    return QuoteService.getDailyQuotes(ticker, end, start)
      .then(data => {
        return data;
      });
  }

  writeCsv(name, startDate, currentDate, rows, fields, count) {
    // fs.writeFile(path.join(__dirname, '../../../tmp/' +
    //   `${name}_analysis_${startDate}-${currentDate}_${++count}.csv`
    // ), json2csv({ data: rows, fields: fields }), function (err) {
    //   if (err) { throw err; }
    //   console.log('file saved');
    // });
    return count;
  }

  runTest(ticker, currentDate, startDate) {
    const shortTerm = config.shortTerm;
    const longTerm = config.longTerm;
    const snapshots = [];
    return this.getData(ticker, currentDate, startDate)
      .then(quotes => {
        for (let i = shortTerm[0]; i < shortTerm[1]; i++) {
          for (let j = longTerm[0]; j < longTerm[1]; j++) {
            if (i + 3 < j) {
              const MAs = ReversionService.executeMeanReversion(ReversionService.calcMA, quotes, i, j);
              const recommendedDifference = 0.003;

              const averagesRange = { shortTerm: i, longTerm: j };
              const returns = DecisionService.calcReturns(MAs, recommendedDifference, startDate);

              if (returns.totalReturns > 0 && returns.totalTrades > 3) {
                snapshots.push({ ...averagesRange, ...returns, recommendedDifference });
              }

              snapshots.push({ ...averagesRange, ...returns, recommendedDifference });
            }
          }
        }
        console.log('Calculations done: ', ticker, new Date());
        endTime = moment();

        const duration = moment.duration(endTime.diff(startTime)).humanize();

        console.log('Duration: ', duration);

        // fs.writeFile(`${ticker}_analysis_${startDate}-${currentDate}.csv`,
        //   json2csv({ data: snapshots, fields: fields }), function (err) {
        //     if (err) { throw err; }
        //     console.log('file saved');
        //   });
        return snapshots;
      });
  }

  runDaytradeBacktest(symbol, currentDate, startDate, parameters) {
    return this.initDaytradeStrategy(symbol, startDate, currentDate, parameters)
      .then(indicators => {
        const testResults = this.backtestDaytradingIndicators(this.createDaytradeRecommendation,
          indicators,
          parameters);
        testResults.symbol = symbol;
        return testResults;
      });
  }

  backtestDaytradingIndicators(recommendationFn: Function,
    indicators: Indicators[],
    parameters: DaytradeParameters): BacktestResults {
    let orders = {
      trades: 0,
      buy: [],
      history: [],
      net: 0,
      total: 0,
      profitableTrades: 0,
      returns: 0
    };

    _.forEach(indicators, (indicator, idx) => {
      if (indicator.close) {
        let orderType = OrderType.None;
        const avgPrice = this.estimateAverageBuyOrderPrice(orders);

        const isAtLimit = this.determineStopProfit(avgPrice, indicator.close,
          parameters.lossThreshold, parameters.profitThreshold);
        if (isAtLimit) {
          orderType = OrderType.Sell;
          indicator.recommendation = { recommendation: OrderType.Sell };
        } else {
          const recommendation: Recommendation = recommendationFn(indicator.close,
            indicator,
            idx > 0 ? indicators[idx - 1] : null, false);

          orderType = recommendation.recommendation;
          indicator.recommendation = recommendation;
        }
        orders = this.calcTrade(orders, indicator, orderType, avgPrice);
        indicator.action = this.getIndicatorAction(indicator.recommendation.recommendation);
      }
    });

    return {
      algo: '',
      orderHistory: orders.history,
      net: orders.net,
      returns: orders.returns,
      total: orders.total,
      invested: orders.total,
      profitableTrades: orders.profitableTrades,
      totalTrades: orders.trades,
      signals: indicators
    };
  }

  createDaytradeRecommendation(price: number, indicator: Indicators, name = '', includeData = true): Recommendation {
    let counter = {
      bullishCounter: 0,
      bearishCounter: 0,
      neutralCounter: 0
    };

    const recommendations: Recommendation = {
      name: name,
      time: moment().format(),
      recommendation: OrderType.None,
      mfi: DaytradeRecommendation.Neutral,
      roc: DaytradeRecommendation.Neutral,
      bband: DaytradeRecommendation.Neutral,
      vwma: DaytradeRecommendation.Neutral,
      macd: DaytradeRecommendation.Neutral,
      demark9: DaytradeRecommendation.Neutral,
      bbandBreakout: DaytradeRecommendation.Neutral,
      data: null
    };

    if (includeData) {
      recommendations.data = { price, indicator };
    }

    const mfiRecommendation = AlgoService.checkMfi(indicator.mfiLeft);

    const rocMomentumRecommendation = AlgoService.checkRocMomentum(indicator.mfiPrevious, indicator.mfiLeft,
      indicator.roc10, indicator.roc10Previous,
      indicator.roc70, indicator.roc70Previous);

    const bbandRecommendation = AlgoService.checkBBand(price,
      AlgoService.getLowerBBand(indicator.bband80), AlgoService.getUpperBBand(indicator.bband80));

    const vwmaRecommendation = AlgoService.checkVwma(price, indicator.vwma);

    const macdRecommendation = AlgoService.checkMacdDaytrade(indicator.macd, indicator.macdPrevious);

    const demark9Recommendation = AlgoService.checkDemark9(indicator.demark9);
    const bbandBreakoutRecommendation = AlgoService.checkBBandBreakout(indicator.bbandBreakout);
    const supportRecommendation = AlgoService.checkSupport(indicator);
    const resistanceRecommendation = AlgoService.checkResistance(indicator);

    let mfiTradeRec = DaytradeRecommendation.Neutral;
    if (indicator.mfiTrend === true) {
      mfiTradeRec = DaytradeRecommendation.Bullish;
    } else if (indicator.mfiTrend === false) {
      mfiTradeRec = DaytradeRecommendation.Bearish;
    }

    counter = AlgoService.countRecommendation(mfiRecommendation, counter);
    counter = AlgoService.countRecommendation(rocMomentumRecommendation, counter);
    counter = AlgoService.countRecommendation(bbandRecommendation, counter);
    counter = AlgoService.countRecommendation(macdRecommendation, counter);
    counter = AlgoService.countRecommendation(demark9Recommendation, counter);
    counter = AlgoService.countRecommendation(mfiTradeRec, counter);
    counter = AlgoService.countRecommendation(bbandBreakoutRecommendation, counter);
    counter = AlgoService.countRecommendation(supportRecommendation, counter);
    counter = AlgoService.countRecommendation(resistanceRecommendation, counter);

    if (counter.bullishCounter > 1 && counter.bearishCounter < 2) {
      recommendations.recommendation = OrderType.Buy;
    } else if (counter.bearishCounter > 1 && counter.bearishCounter > counter.bullishCounter) {
      recommendations.recommendation = OrderType.Sell;
    }

    recommendations.mfi = mfiRecommendation;
    recommendations.roc = rocMomentumRecommendation;
    recommendations.bband = bbandRecommendation;
    recommendations.demark9 = demark9Recommendation;
    recommendations.macd = macdRecommendation;
    recommendations.mfiTrade = mfiTradeRec;
    recommendations.vwma = vwmaRecommendation;
    recommendations.bbandBreakout = bbandBreakoutRecommendation;

    return recommendations;
  }

  getCurrentDaytrade(symbol: string, price: number, paidPrice: number, parameters, dataSource = 'td', response) {
    if (this.lastRequest && moment().diff(this.lastRequest, 'milliseconds') < 100) {
      if (this.lastRequestCount > 10) {
        response.status(429).send({ message: 'Last request was to soon.' });
        return Promise.reject();
      } else {
        this.lastRequestCount++;
      }
    } else {
      this.lastRequest = moment();
      this.lastRequestCount = 0;
    }
    return this.getCurrentDaytradeIndicators(symbol, parameters.minQuotes || 80, dataSource)
      .then((currentIndicators: Indicators) => {
        response.status(200).send(this.getDaytradeRecommendation(symbol, paidPrice, price, parameters, currentIndicators));
      })
      .catch(error => {
        console.log(error);
        response.status(500).send({ message: error });
      });
  }

  getDaytradeRecommendation(symbol: string, price: number, paidPrice: number, parameters, currentIndicators: Indicators) {
    let recommendation = {
      recommendation: OrderType.None
    };

    const avgPrice = Number(paidPrice);
    const lossThreshold = Number(parameters.lossThreshold);
    const profitThreshold = Number(parameters.profitThreshold);
    const isAtLimit = this.determineStopProfit(avgPrice, price,
      lossThreshold, profitThreshold);
    if (isAtLimit) {
      recommendation.recommendation = OrderType.Sell;
    } else {
      recommendation = this.createDaytradeRecommendation(currentIndicators.close, currentIndicators, symbol);
    }
    return recommendation;
  }

  getIndicatorAction(recommendation: string): string {
    if (recommendation === OrderType.None) {
      return 'INDETERMINANT';
    } if (recommendation === OrderType.Buy) {
      return 'STRONGBUY';
    } if (recommendation === OrderType.Sell) {
      return 'STRONGSELL';
    } else {
      return recommendation;
    }
  }

  backtestIndicators(recommendationFn: Function,
    indicators: Indicators[],
    parameters: DaytradeParameters): BacktestResults {
    let orders = {
      trades: 0,
      buy: [],
      history: [],
      net: 0,
      total: 0,
      profitableTrades: 0,
      returns: 0
    };

    let isMfiLowIdx = -1;
    let isMfiHighIdx = -1;

    _.forEach(indicators, (indicator, idx) => {
      if (indicator.close) {
        let orderType = OrderType.None;
        const avgPrice = this.estimateAverageBuyOrderPrice(orders);

        const isAtLimit = this.determineStopProfit(avgPrice, indicator.close,
          parameters.lossThreshold, parameters.profitThreshold);
        if (isAtLimit) {
          orderType = OrderType.Sell;
          indicator.recommendation = { recommendation: OrderType.Sell };
        } else {
          indicator.flagPennant = AlgoService.addFlagPennantData(indicators.slice(idx - 79, idx));

          const recommendation: Recommendation = recommendationFn(indicator.close,
            indicator,
            idx > 0 ? indicators[idx - 1] : null,
            indicators.slice(idx - 10, idx));

          orderType = recommendation.recommendation;
          indicator.recommendation = recommendation;
          try {
            if (idx > 80 && (!indicator.recommendation.mfiTrade || indicator.recommendation.mfiTrade === DaytradeRecommendation.Neutral)) {
              if (indicator.recommendation.mfiLow === DaytradeRecommendation.Bullish ||
                indicator.recommendation.mfi === DaytradeRecommendation.Bullish) {
                isMfiLowIdx = idx;
              } else if (isMfiLowIdx > -1 && (idx - isMfiLowIdx) < 45) {
                if (indicators[idx - 5].mfiLeft < indicators[idx - 4].mfiLeft && indicators[idx - 4].mfiLeft < indicators[idx - 1].mfiLeft &&
                  indicators[idx - 5].mfiLeft < indicators[idx - 3].mfiLeft &&
                  indicators[idx - 5].open > indicators[idx - 5].close && indicators[idx - 4].open < indicators[idx - 4].close && indicators[idx - 3].open < indicators[idx - 3].close) {
                  indicator.recommendation.mfiTrade = indicators.slice(idx - 20, idx).reduce((previous, current) => {
                    if (previous.lowestLow === -1) {
                      previous.lowestLow = current.close;
                    } else if (current.low < previous.lowestLow && current.mfiLeft > 38) {
                      previous.lowestLow = current.close;
                      previous.newLows++;
                    }

                    if (current.recommendation.demark9 === DaytradeRecommendation.Bullish ||
                      current.recommendation.demark9 === DaytradeRecommendation.Bearish) {
                      previous.demark = current.recommendation.demark9;
                    }
                    if (current.recommendation.bband === DaytradeRecommendation.Bullish ||
                      current.recommendation.bband === DaytradeRecommendation.Bearish) {
                      previous.bband = current.recommendation.bband;
                    }
                    if (current.recommendation.macd === DaytradeRecommendation.Bullish ||
                      current.recommendation.macd === DaytradeRecommendation.Bearish) {
                      previous.macd = current.recommendation.macd;
                    }

                    if (previous.bband === DaytradeRecommendation.Bullish && (previous.demark === DaytradeRecommendation.Bullish &&
                      previous.macd === DaytradeRecommendation.Bullish) &&
                      (previous.newLows <= 3)
                    ) {
                      previous.recommendation = DaytradeRecommendation.Bullish;
                    }
                    return previous;
                  }, {
                    lowestLow: -1,
                    newLows: 0,
                    demark: DaytradeRecommendation.Neutral,
                    bband: DaytradeRecommendation.Neutral,
                    macd: DaytradeRecommendation.Neutral,
                    recommendation: DaytradeRecommendation.Neutral
                  }).recommendation;
                  indicator.recommendation.recommendation = indicator.recommendation.mfiTrade === DaytradeRecommendation.Bullish ? OrderType.Buy : OrderType.None;
                }
              } else if (indicator.recommendation.mfi === DaytradeRecommendation.Bearish) {
                isMfiHighIdx = idx;
              } else if (isMfiHighIdx > -1 && (idx - isMfiHighIdx) < 45) {
                if (indicators[idx - 5].mfiLeft > indicators[idx - 4].mfiLeft && indicators[idx - 4].mfiLeft > indicators[idx - 3].mfiLeft &&
                  indicators[idx - 5].mfiLeft > indicators[idx - 2].mfiLeft &&
                  indicators[idx - 5].open < indicators[idx - 5].close && indicators[idx - 4].open > indicators[idx - 4].close && indicators[idx - 3].open > indicators[idx - 3].close) {
                  indicator.recommendation.mfiTrade = indicators.slice(idx - 20, idx).reduce((previous, current) => {
                    if (previous.highestHigh === -1) {
                      previous.highestHigh = current.close;
                    } else if (current.high > previous.highestHigh && current.mfiLeft < 61) {
                      previous.highestHigh = current.close;
                      previous.newHighs++;
                    }

                    if (current.recommendation.demark9 === DaytradeRecommendation.Bullish ||
                      current.recommendation.demark9 === DaytradeRecommendation.Bearish) {
                      previous.demark = current.recommendation.demark9;
                    }
                    if (current.recommendation.bband === DaytradeRecommendation.Bullish ||
                      current.recommendation.bband === DaytradeRecommendation.Bearish) {
                      previous.bband = current.recommendation.bband;
                    }
                    if (current.recommendation.macd === DaytradeRecommendation.Bullish ||
                      current.recommendation.macd === DaytradeRecommendation.Bearish) {
                      previous.macd = current.recommendation.macd;
                    }

                    if (previous.bband === DaytradeRecommendation.Bearish && (previous.demark === DaytradeRecommendation.Bearish &&
                      previous.macd === DaytradeRecommendation.Bearish) &&
                      previous.newHighs <= 3
                    ) {
                      previous.recommendation = DaytradeRecommendation.Bearish;
                    }
                    return previous;
                  }, {
                    highestHigh: -1,
                    newHighs: 0,
                    demark: DaytradeRecommendation.Neutral,
                    bband: DaytradeRecommendation.Neutral,
                    macd: DaytradeRecommendation.Neutral,
                    recommendation: DaytradeRecommendation.Neutral
                  }).recommendation;
                  indicator.recommendation.recommendation = indicator.recommendation.mfiTrade === DaytradeRecommendation.Bearish ? OrderType.Sell : OrderType.None;
                }
              }
              // 2020-07-02T05:00:00.000+0000b
            }
          } catch (error) {
            throw new Error(`mfiTrade ${error}`);
          }
        }

        orders = this.calcTrade(orders, indicator, orderType, avgPrice);
        indicator.action = this.getIndicatorAction(indicator.recommendation.recommendation);
      }
    });

    const lastRecommendation = this.getIndicatorAction(indicators[indicators.length - 1].recommendation.recommendation);

    const ordersResults = {
      algo: '',
      orderHistory: orders.history,
      net: orders.net,
      returns: orders.returns,
      total: orders.total,
      invested: orders.total,
      profitableTrades: orders.profitableTrades,
      totalTrades: orders.trades,
      recommendation: lastRecommendation
    };

    return {
      ...ordersResults,
      signals: indicators,
    };
  }

  determineStopProfit(paidPrice, currentPrice, lossThreshold = null, profitThreshold = null) {
    if (!paidPrice || !currentPrice || !lossThreshold || !profitThreshold) {
      return false;
    }
    const gain = DecisionService.getPercentChange(paidPrice, currentPrice);
    if (gain < lossThreshold || gain > profitThreshold) {
      return true;
    }
  }


  runIntradayEvaluation(symbol, currentDate, startDate) {
    return this.initDaytradeStrategy(symbol, startDate, currentDate, { minQuotes: 81 })
      .then(indicators => {
        const bbRangeFn = (price, bband) => {
          const lower = bband[0][0];
          return price < lower;
        };

        const lossThreshold = 0.05;
        const profitThreshold = 0.05;
        const mfiRange = [20, 75];
        const fields = ['leftRange', 'rightRange', 'totalTrades', 'net', 'avgTrade', 'returns'];
        let count = 0;
        let leftRange = -1;
        let rightRange = 1;

        const rows = [];
        while (leftRange < 0) {
          while (rightRange > 0) {
            const rocDiffRange = [leftRange, rightRange];
            const results = this.getBacktestResults(this.getBuySignal,
              this.getSellSignal,
              indicators,
              bbRangeFn,
              mfiRange,
              rocDiffRange,
              lossThreshold,
              profitThreshold);

            const returns = _.round(_.divide(results.net, results.total), 3);
            if (returns > 0 && _.divide(indicators.length, results.trades) < 250) {
              rows.push({
                leftRange,
                rightRange,
                net: _.round(results.net, 3),
                avgTrade: _.round(_.divide(results.total, results.trades), 3),
                returns,
                totalTrades: results.trades
              });
            }
            if (rows.length > 500000) {
              this.writeCsv(name, startDate, currentDate, _.cloneDeep(rows), fields, ++count);
              rows.length = 0;
            }
            rightRange = _.round(_.subtract(rightRange, 0.1), 3);
          }
          leftRange = _.round(_.add(leftRange, 0.1), 3);
          rightRange = 0.9;
        }

        this.writeCsv(symbol, startDate, currentDate, rows, fields, count);
        return [];
      });
  }

  initDaytradeStrategy(symbol, startDate, currentDate, parameters): Promise<Indicators[]> {
    const minQuotes = parameters.minQuotes;

    return PortfolioService.getIntradayV3(symbol, moment(startDate).valueOf(), moment(currentDate).valueOf(), null)
      .then(quotes => {
        if (quotes.length === 0) {
          console.log(`No quotes returned for ${startDate} - ${currentDate}`);
        }
        return this.processIndicators(quotes, minQuotes);
      });
  }

  initDailyStrategy(symbol, currentDate, startDate, parameters = { minQuotes: 80 }) {
    const minQuotes = parameters.minQuotes;
    const getIndicatorQuotes = [];

    return this.getData(symbol, currentDate, startDate)
      .then(quotes => {
        console.log('Found quotes ', quotes[0].date, ' to ', quotes[quotes.length - 1].date);
        _.forEach(quotes, (value, key) => {
          if (value) {
            const idx = Number(key);

            if (idx > minQuotes) {
              if (moment(quotes[idx].date).format('YYYY MM DD') === moment(quotes[idx - 1].date).format('YYYY MM DD')) {
                console.log('Found duplicate ', quotes[idx].date, quotes[idx - 1].date);
                quotes.splice(idx - 1, 1);
              }
              const q = quotes.slice(idx - minQuotes, idx + 1);
              getIndicatorQuotes.push(this.initStrategy(q));
            }
          }
        });

        return Promise.all(getIndicatorQuotes);
      })
      .then((indicators: Indicators[]) => {
        let testResults;

        testResults = this.backtestIndicators(this.getAllRecommendations,
          indicators,
          parameters);

        testResults.algo = 'All indicators';
        testResults.symbol = symbol;

        return testResults;
      });
  }

  runIntradayTest(symbol, currentDate, startDate) {
    return this.initDaytradeStrategy(symbol, startDate, currentDate, { minQuotes: 81 })
      .then(indicators => {
        const bbRangeFn = (price, bband) => {
          const lower = bband[0][0];
          return price < lower;
        };
        const lossThreshold = 0.002;
        const profitThreshold = 0.003;
        const rocDiffRange = [-0.5, 0.5];
        const mfiRange = [20, 80];
        return this.getBacktestResults(this.getBuySignal,
          this.getSellSignal,
          indicators,
          bbRangeFn,
          mfiRange,
          rocDiffRange,
          lossThreshold,
          profitThreshold);
      });
  }

  evaluateBband(symbol, currentDate, startDate) {
    const minQuotes = 81;
    const getIndicatorQuotes = [];
    return QuoteService.queryForIntraday(symbol, startDate, currentDate)
      .then(quotes => {
        console.log('quotes: ', quotes.length);
        _.forEach(quotes, (value, key) => {
          const idx = Number(key);
          if (idx > minQuotes) {
            const q = quotes.slice(idx - minQuotes, idx);
            getIndicatorQuotes.push(this.initMAIndicators(q));
          }
        });
        return Promise.all(getIndicatorQuotes);
      })
      .then(indicators => {
        const bbRangeFn = (price, bband) => {
          // const higher = bband[2][0];
          const lower = bband[0][0];

          return price < lower;
        };

        const lossThreshold = 0.05;
        const profitThreshold = 0.05;
        const fields = ['leftRange', 'rightRange', 'mfiLeft', 'mfiRight', 'totalTrades', 'net', 'avgTrade', 'returns'];
        let count = 0;
        const mfiLeft = 0;
        let mfiRight = 100;
        let leftRange = -1;
        let rightRange = 1;
        const rows = [];
        while (leftRange < -0.001) {
          rightRange = 0.9;
          while (rightRange > 0.001) {
            // mfiLeft = 0;
            // while (mfiLeft < 100) {
            mfiRight = 100;
            while (mfiRight > 0) {

              const mfiRange = [mfiLeft, mfiRight];

              const results = this.getBacktestResults(this.getMABuySignal,
                this.getMfiSellSignal,
                indicators,
                bbRangeFn,
                mfiRange,
                [leftRange, rightRange],
                lossThreshold,
                profitThreshold);

              if (results.net > 0 && _.divide(indicators.length, results.trades) < 250) {
                rows.push({
                  leftRange,
                  rightRange,
                  mfiLeft,
                  mfiRight,
                  net: _.round(results.net, 3),
                  avgTrade: _.round(_.divide(results.total, results.trades), 3),
                  returns: _.round(_.divide(results.net, results.total), 3),
                  totalTrades: results.trades
                });
              }

              if (rows.length > 500000) {
                this.writeCsv(`${symbol}-bband-intraday`, startDate, currentDate, _.cloneDeep(rows), fields, ++count);
                rows.length = 0;
              }

              mfiRight = _.subtract(mfiRight, 1);
            }
            //   mfiLeft = _.add(mfiLeft, 1);
            // }
            rightRange = _.round(_.subtract(rightRange, 0.01), 2);
          }
          leftRange = _.round(_.add(leftRange, 0.01), 2);
        }

        this.writeCsv(`${symbol}-bband-intraday`, startDate, currentDate, rows, fields, count);
        return [];
      });
  }

  evaluateDailyMfi(symbol, currentDate, startDate) {
    const minQuotes = 81;
    const getIndicatorQuotes = [];

    return this.getData(symbol, currentDate, startDate)
      .then(quotes => {
        console.log('quotes: ', quotes.length);
        _.forEach(quotes, (value, key) => {
          const idx = Number(key);
          if (idx > minQuotes) {
            const q = quotes.slice(idx - minQuotes, idx);
            getIndicatorQuotes.push(this.initMAIndicators(q));
          }
        });
        return Promise.all(getIndicatorQuotes);
      })
      .then(indicators => {
        const bbRangeFn = (price, bband) => {
          return null;
        };

        const testResult = [];
        const name = `${symbol}-mfi-daily`;
        const lossThreshold = 0.03;
        const profitThreshold = 0.05;
        const mfiRange = [20, 80];
        const fields = ['leftRange', 'rightRange', 'totalTrades', 'net', 'avgTrade', 'returns'];
        let count = 0;
        let leftRange = -0.9;
        let rightRange = 0.9;
        let bestResult = null;

        const rows = [];
        while (leftRange < 0) {
          while (rightRange > 0) {
            const rocDiffRange = [leftRange, rightRange];
            const results = this.getBacktestResults(this.getBuySignal,
              this.getSellSignal,
              indicators,
              bbRangeFn,
              mfiRange,
              rocDiffRange,
              lossThreshold,
              profitThreshold);

            if (results.net > 0) {
              const line = {
                leftRange,
                rightRange,
                net: _.round(results.net, 3),
                avgTrade: _.round(_.divide(results.total, results.trades), 3),
                returns: _.round(_.divide(results.net, results.total), 3),
                totalTrades: results.trades
              };

              rows.push(line);
              testResult.push(line);
              if (!bestResult || (line.returns > bestResult)) {
                bestResult = line;
              }
            }
            if (rows.length > 500000) {
              this.writeCsv(name, startDate, currentDate, _.cloneDeep(rows), fields, ++count);
              rows.length = 0;
            }
            rightRange = _.round(_.subtract(rightRange, 0.1), 3);
          }
          leftRange = _.round(_.add(leftRange, 0.1), 3);
          rightRange = 0.9;
        }


        // this.writeCsv(name, startDate, currentDate, rows, fields, count);
        let recommendation = 'INDETERMINANT';
        const lastInd = indicators[indicators.length - 1];
        if (bestResult) {
          // if (this.getBuySignal(indicators[indicators.length - 1],
          //     [0, 1], mfiRange, null)) {
          // [bestResult.leftRange, bestResult.rightRange], mfiRange, null)) {
          if (lastInd.mfiLeft < 20) {
            recommendation = 'BUY';
          } else if (lastInd.mfiLeft > 80) {
            recommendation = 'SELL';
          }
          testResult.push({ ...bestResult, algo: 'daily-mfi', recommendation, ...lastInd });
        }
        return testResult;
      });
  }

  getBacktestResults(buySignalFn: Function,
    sellSignalFn: Function,
    indicators,
    bbRangeFn,
    mfiRange,
    rocDiffRange,
    lossThreshold,
    profitThreshold) {
    let orders = {
      trades: 0,
      buy: [],
      history: [],
      net: 0,
      total: 0,
      returns: 0
    };

    _.forEach(indicators, (indicator) => {
      if (indicator.close) {
        let orderType;
        const avgPrice = this.estimateAverageBuyOrderPrice(orders);
        let sell = false,
          buy = false;
        if (orders.buy.length > 0) {
          sell = sellSignalFn(avgPrice,
            indicator.close,
            lossThreshold,
            profitThreshold,
            indicator,
            rocDiffRange,
            mfiRange);
        }

        buy = buySignalFn(indicator, rocDiffRange, mfiRange, bbRangeFn(indicator.close, indicator.bband80));

        if (buy) {
          orderType = 'buy';
        } else if (sell) {
          orderType = 'sell';
        }

        orders = this.calcTrade(orders, indicator, orderType, avgPrice);
      }
    });

    return { ...orders, indicators };
  }

  getBuySignal(indicator, rocDiffRange, mfiRange, bbCondition) {
    let num, den;
    if (indicator.roc70 > indicator.roc10) {
      num = indicator.roc70;
      den = indicator.roc10;
    } else {
      den = indicator.roc70;
      num = indicator.roc10;
    }

    const momentumDiff = _.round(_.divide(num, den), 3);

    // console.log('indicator: ', moment(indicator.date).format('HH:mm'), bbCondition, momentumDiff, indicator.mfiLeft)
    // if (bbCondition) {
    //   if (momentumDiff < rocDiffRange[0] || momentumDiff > rocDiffRange[1]) {
    //     if (indicator.mfiLeft < mfiLimit) {
    //       return true;
    //     }
    //   }
    // }
    if (momentumDiff < rocDiffRange[0] || momentumDiff > rocDiffRange[1]) {
      if (indicator.mfiLeft < mfiRange[0]) {
        return true;
      }
    }

    return false;
  }

  getSellSignal(paidPrice, currentPrice, lossThreshold, profitThreshold, indicator, rocDiffRange, mfiRange) {
    let num, den;
    if (indicator.roc70 > indicator.roc10) {
      num = indicator.roc70;
      den = indicator.roc10;
    } else {
      den = indicator.roc70;
      num = indicator.roc10;
    }

    const momentumDiff = _.round(_.divide(num, den), 3);
    const gain = DecisionService.getPercentChange(currentPrice, paidPrice);
    if (gain < lossThreshold || gain > profitThreshold) {
      return true;
    }

    const higher = indicator.bband80[0][2];

    if (currentPrice > higher) {
      if (momentumDiff < rocDiffRange[0] || momentumDiff > rocDiffRange[1]) {
        // if (indicator.mfiLeft > mfiRange[0] && indicator.mfiLeft < mfiRange[1]) {
        return true;
        // }
      }
    }
  }

  getMfiSellSignal(paidPrice, currentPrice, lossThreshold, profitThreshold, indicator, rocDiffRange, mfiRange) {
    // console.log(indicator.roc10, rocDiffRange[1], indicator.roc70, rocDiffRange[0]);
    const gain = DecisionService.getPercentChange(currentPrice, paidPrice);
    if (gain < lossThreshold || gain > profitThreshold) {
      return true;
    }

    const higher = indicator.bband80[0][2];
    if (indicator.roc10 < rocDiffRange[1] && indicator.roc70 < rocDiffRange[0]) {
      if (indicator.mfiLeft > 80 || (currentPrice > higher && indicator.mfiLeft > mfiRange[1])) {
        return true;
      }
    }
  }

  getMABuySignal(indicator: any, rocDiffRange, mfiRange: number[], bbCondition) {
    if (indicator.mfiLeft > mfiRange[0] && indicator.mfiLeft < mfiRange[1]) {
      // const crossover = _.round(DecisionService.calculatePercentDifference(indicator.sma5, indicator.sma70), 3);
      if (bbCondition) {
        let num, den;
        if (indicator.roc70 > indicator.roc10) {
          num = indicator.roc70;
          den = indicator.roc10;
        } else {
          den = indicator.roc70;
          num = indicator.roc10;
        }

        const momentumDiff = _.round(_.divide(num, den), 3);
        if (momentumDiff < rocDiffRange[0] || momentumDiff > rocDiffRange[1]) {
          return true;
        }
      }
    }

    return false;
  }

  calcTrade(orders, dayQuote, orderType, avgPrice) {
    if (orderType && orderType.toLowerCase() === 'sell') {
      if (orders.buy.length > 0) {
        orders.trades++;
        const len = orders.buy.length;
        const profit = (dayQuote.close - avgPrice) * len;
        if (profit > 0) {
          if (orders.profitableTrades) {
            orders.profitableTrades++;
          } else {
            orders.profitableTrades = 1;
          }
        }
        orders.total += (avgPrice * len);
        orders.net += profit;
        const drawdown = profit / (avgPrice * len);
        orders.maxDrawdown = (!orders.maxDrawdown || drawdown < orders.maxDrawdown) ? drawdown : orders.maxDrawdown;
        orders.returns = orders.net / orders.total;
        dayQuote.signal = 'sell';
        orders.history.push(dayQuote);
        orders.buy = [];
      }
    } else if (orderType && orderType.toLowerCase() === 'buy') {
      orders.buy.push(dayQuote.close);
      dayQuote.signal = 'buy';
      orders.history.push(dayQuote);
    }
    return orders;
  }

  estimateAverageBuyOrderPrice(orders) {
    return _.reduce(orders.buy, (sum, value) => {
      return sum + value;
    }, 0) / orders.buy.length;
  }

  getSubArray(reals, period) {
    return reals.slice(reals.length - (period + 1));
  }

  getSubArrayShift(reals, period, modifier) {
    const length = reals.length + modifier;
    return reals.slice(length - (period + 1), length);
  }

  processQuotes(quotes) {
    const reals = [],
      highs = [],
      lows = [],
      volumes = [],
      timeline = [];

    _.forEach(quotes, (value) => {
      if (value.close && value.high && value.low) {
        reals.push(value.close);
        highs.push(value.high);
        lows.push(value.low);
        volumes.push(value.volume);
        timeline.push(value.date);
      }
    });

    return { reals, highs, lows, volumes, timeline, quotes: quotes };
  }

  initStrategy(quotes) {
    const currentQuote = quotes[quotes.length - 1];
    const indicators = this.processQuotes(quotes);
    if (!currentQuote) {
      console.log('current quote not found: ', quotes.length, quotes[0]);
    }
    return this.getIndicators(indicators, 80, currentQuote);
  }

  getIndicators(indicators, bbandPeriod, returnObject) {
    const currentQuote: Indicators = returnObject;
    const levels = supportResistanceService.calculateSupportResistance(indicators.quotes)
    currentQuote.support = levels.support;
    currentQuote.resistance = levels.resistance;
    return this.getBBands(indicators.reals, bbandPeriod, 2)
      .then((bband80) => {
        currentQuote.bband80 = bband80;
        const quotes10Day = this.getSubArray(indicators.reals, 24);
        return this.getRateOfChange(quotes10Day, 24);
      })
      .then((roc10) => {
        const rocLen = roc10[0].length - 1;
        currentQuote.roc10 = _.round(roc10[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 24, -1), 24);
      })
      .then((roc10Previous) => {
        const rocLen = roc10Previous[0].length - 1;
        currentQuote.roc10Previous = _.round(roc10Previous[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArray(indicators.reals, 70), 70);
      })
      .then((roc70) => {
        const rocLen = roc70[0].length - 1;
        currentQuote.roc70 = _.round(roc70[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 70, -1), 70);
      })
      .then((roc70Previous) => {
        const rocLen = roc70Previous[0].length - 1;
        currentQuote.roc70Previous = _.round(roc70Previous[0][rocLen], 4);

        return MfiService.getMfi(this.getSubArray(indicators.highs, 14),
          this.getSubArray(indicators.lows, 14),
          this.getSubArray(indicators.reals, 14),
          this.getSubArray(indicators.volumes, 14),
          14);
      })
      .then((mfiLeft) => {
        const len = mfiLeft[0].length - 1;
        currentQuote.mfiLeft = _.round(mfiLeft[0][len], 3);
        return this.getVwma(this.getSubArray(indicators.reals, 70),
          this.getSubArray(indicators.volumes, 70), 70);
      })
      .then(vwma => {
        const vwmaLen = vwma[0].length - 1;
        currentQuote.vwma = _.round(vwma[0][vwmaLen], 3);
        return this.getSMA(indicators.reals, 10);
      })
      .then((sma10) => {
        currentQuote.sma10 = sma10[0][sma10[0].length - 1];
        return this.getSMA(indicators.reals, 50);
      })
      .then((sma50) => {
        currentQuote.sma50 = sma50[0][sma50[0].length - 1];
        return this.getMacd(indicators.reals, 12, 26, 9);
      })
      .then(macd => {
        currentQuote.macd = macd;
        return Promise.all([
          this.getMacd(indicators.reals.slice(0, indicators.reals.length - 1), 12, 26, 9),
          this.getMacd(indicators.reals.slice(0, indicators.reals.length - 2), 12, 26, 9),
          this.getMacd(indicators.reals.slice(0, indicators.reals.length - 3), 12, 26, 9)
        ]);
      })
      .then(values => {
        let predicate = null;
        if (currentQuote.macd > 0) {
          predicate = (currentMacd) => {
            const macd = currentMacd[2];
            return macd[macd.length - 1] <= 0;
          };
        } else {
          predicate = (currentMacd) => {
            const macd = currentMacd[2];
            return macd[macd.length - 1] > 0;
          };
        }
        let counter = 0;
        while (counter < values.length) {
          if (predicate(values[counter])) {
            currentQuote.macdPrevious = values[counter];
            break;
          }
          counter++;
        }
        if (!currentQuote.macdPrevious) {
          currentQuote.macdPrevious = values[0];
        }
        return this.getRsi(this.getSubArray(indicators.reals, 14), 14);
      })
      .then(rsi => {
        currentQuote.rsi = rsi;
        return this.getDemark9(this.getSubArray(indicators.reals, 13),
          this.getSubArray(indicators.highs, 13),
          this.getSubArray(indicators.lows, 13));
      })
      .then(demark9 => {
        currentQuote.demark9 = demark9;
        return MfiService.getMfiLow(indicators.highs,
          indicators.lows,
          indicators.reals,
          indicators.volumes,
          75);
      })
      .then(mfiLow => {
        currentQuote.mfiLow = mfiLow;
        return this.getObv(this.getSubArrayShift(indicators.reals, 14, -1), this.getSubArrayShift(indicators.volumes, 14, -1));
      }).then(obv => {
        currentQuote.obv = obv;
        return MfiService.getMfi(this.getSubArrayShift(indicators.highs, 14, -1),
          this.getSubArrayShift(indicators.lows, 14, -1),
          this.getSubArrayShift(indicators.reals, 14, -1),
          this.getSubArrayShift(indicators.volumes, 14, -1),
          14);
      })
      .then((mfiPrevious) => {
        const len = mfiPrevious[0].length - 1;
        currentQuote.mfiPrevious = _.round(mfiPrevious[0][len], 3);
        return BBandBreakoutService.isBreakout(indicators.reals, currentQuote.mfiPrevious,
          currentQuote.mfiLeft, currentQuote.bband80, bbandPeriod);
      })
      .then((bbandBreakout) => {
        currentQuote.bbandBreakout = bbandBreakout;
        return currentQuote;
      })
      .catch(error => {
        console.log('Error creating indicators: ', error);
        return error;
      });
  }

  initMAIndicators(quotes) {
    const currentQuote = quotes[quotes.length - 1];
    const indicators = this.processQuotes(quotes);

    return this.getBBands(indicators.reals, 80, 2)
      .then((bband80) => {
        currentQuote.bband80 = bband80;
        //   return this.getSMA(indicators.reals, 5);
        // })
        // .then((sma5) => {
        //   currentQuote.sma5 = sma5[0][sma5[0].length - 1];
        //   return this.getSMA(indicators.reals, 70);
        // })
        // .then((sma70) => {
        //   currentQuote.sma70 = sma70[0][sma70[0].length - 1];
        return this.getRateOfChange(this.getSubArray(indicators.reals, 24), 24);
      })
      .then((roc10) => {
        const rocLen = roc10[0].length - 1;
        currentQuote.roc10 = _.round(roc10[0][rocLen], 3);
        return this.getRateOfChange(this.getSubArray(indicators.reals, 70), 70);
      })
      .then((roc70) => {
        const rocLen = roc70[0].length - 1;
        currentQuote.roc70 = _.round(roc70[0][rocLen], 3);
        //   return this.getRateOfChange(this.getSubArray(indicators.reals, 5), 5);
        // })
        // .then((roc5) => {
        //   const rocLen = roc5[0].length - 1;
        //   currentQuote.roc5 = _.round(roc5[0][rocLen], 3);
        return MfiService.getMfi(this.getSubArray(indicators.highs, 14),
          this.getSubArray(indicators.lows, 14),
          this.getSubArray(indicators.reals, 14),
          this.getSubArray(indicators.volumes, 14),
          14);
      })
      .then((mfiLeft) => {
        const len = mfiLeft[0].length - 1;
        currentQuote.mfiLeft = _.round(mfiLeft[0][len], 3);
        return currentQuote;
      });
  }

  getMeanReversionChart(ticker, currentDate, startDate, deviation, shortTerm, longTerm) {
    return this.getData(ticker, currentDate, startDate)
      .then(quotes => {
        return ReversionService.executeMeanReversion(ReversionService.calcMA, quotes, shortTerm, longTerm);
      })
      .catch(err => {
        console.log('ERROR! backtest', err);
        return Promise.reject(BaseErrors.InvalidArgumentsError());
      });
  }

  getTradeDays(days) {
    const workDaysPerWeek = 5 / 7,
      holidays = 9;

    return Math.ceil(days * workDaysPerWeek - holidays);
  }

  getInfoV2(symbol, endDate, startDate) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');


    const query = `${dataServiceUrl}backtest/strategy/mean-reversion/train?` +
      `symbol=${symbol}&to=${to}&from=${from}` +
      `&s=30&l=90&d=0.03&p=80`;

    const options = {
      method: 'GET',
      uri: query
    };

    return RequestPromise(options)
      .then((data) => {
        const arr = JSON.parse(data);
        return arr;
      })
      .catch((error) => {
        console.log('Error getInfoV2: ', error.error);
      });
  }

  getInfoV2Chart(symbol, endDate, startDate) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    console.log('to: ', to, ' from:', from);
    const query = `${dataServiceUrl}backtest/strategy/mean-reversion/chart?` +
      `symbol=${symbol}&to=${to}&from=${from}` +
      `&s=30&l=90&d=0.03&p=80`;

    const options = {
      method: 'GET',
      uri: query
    };

    return RequestPromise(options)
      .then((data) => {
        const arr = JSON.parse(data);
        return arr;
      })
      .catch((error) => {
        return error;
      });
  }

  getHistoricalMatches(symbol, endDate, startDate) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    console.log('to: ', to, ' from:', from);
    const post = `${dataServiceUrl}backtest/train/find`;

    const options = {
      method: 'POST',
      uri: post,
      body: {
        symbol: symbol,
        to: to,
        from: from,
        save: false
      },
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error getHistoricalMatches: ', error.error);
      });
  }

  checkServiceStatus(serviceName) {
    let serviceUrl = '';
    switch (serviceName) {
      case 'data':
        serviceUrl = `${dataServiceUrl}actuator/health`;
        break;
      case 'ml':
        serviceUrl = `${mlServiceUrl}health`;
        break;
    }

    const options = {
      method: 'GET',
      uri: serviceUrl
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error checkServiceStatus: ', error.error);
      });
  }

  getTrainingData(symbol, endDate, startDate, useClosePrice = false) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    console.log('to: ', to, ' from:', from);
    const url = `${configurations.apps.goliath}backtest/train`;

    const options = {
      method: 'GET',
      uri: url,
      qs: {
        ticker: symbol,
        to,
        from,
        save: false,
        useClosePrice
      },
    };

    return RequestPromise(options)
      .then(data => JSON.parse(data))
      .catch(error => {
        console.log('Error getTrainingData', error.statusCode);
      });
  }

  runRNN(symbol, endDate, startDate, response) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    const URI = `${mlServiceUrl}api?` +
      `symbol=${symbol}&to=${to}&from=${from}`;

    const options = {
      method: 'GET',
      uri: URI
    };

    RequestPromise(options)
      .catch((error) => {
        console.log('Error runRNN: ', error.error);
      });

    response.status(200).send();
  }

  activateRNN(symbol, startDate, response) {
    const today = moment(startDate).format('YYYY-MM-DD');
    const yesterday = moment(startDate).add(-1, 'days').format('YYYY-MM-DD');

    this.getTrainingData(symbol, today, yesterday)
      .then((trainingData) => {
        const URI = `${mlServiceUrl}api/activate`;

        const options = {
          method: 'POST',
          uri: URI,
          body: {
            symbol: 'SPY',
            input: trainingData[trainingData.length - 1].input,
            round: false,
            to: today
          },
          json: true
        };

        RequestPromise(options)
          .catch((error) => {
            console.log('Error activateRNN: ', error.error);
          });
      });
    response.status(200).send();
  }

  checkRNNStatus(symbol, endDate, modelName) {
    const to = moment(endDate).format('YYYY-MM-DD');

    const URI = `${dataServiceUrl}precog/prediction?` +
      `symbol=${symbol}&date=${to}&modelName=${modelName}`;

    const options = {
      method: 'GET',
      uri: URI,
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error checkRNNStatus: ', error.message);
      });
  }

  /*
  * {'symbol': 'SHAK',
  * 'to': '2019-11-01',
  * 'from':'2018-09-24',
  * 'settings': [0.03, 30, 90, 80],
  * 'strategy': 'MoneyFlowIndex'
  * }
  */
  bbandMfiInfo(symbol, endDate, startDate) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');


    const query = `${dataServiceUrl}backtest/strategy`;

    const options = {
      method: 'POST',
      uri: query,
      body: {
        symbol,
        to,
        from,
        strategy: 'bbmfi'
      },
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error bbandMfiInfo: ', error);
      });
  }

  /*
  * {'symbol': 'SPY',
  * 'to': '2019-11-15',
  * 'from':'2018-01-24',
  * 'settings': [0.03, 30, 90, 80],
  * 'strategy': 'MOVINGAVERAGECROSSOVER'
  * }
  */
  getMovingAverageCrossOverInfo(symbol, endDate, startDate, settings) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    const query = `${dataServiceUrl}backtest/strategy`;

    const options = {
      method: 'POST',
      uri: query,
      body: {
        symbol,
        to,
        from,
        strategy: 'MOVINGAVERAGECROSSOVER',
        settings
      },
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error getMovingAverageCrossOverInfo: ', error);
      });
  }

  /*
* {'symbol': 'SPY',
* 'to': '2019-11-15',
* 'from':'2018-01-24',
* 'settings': [0.03, 30, 90, 80],
* 'strategy': 'MOVINGAVERAGECROSSOVER'
* }
*/
  findResistance(symbol, endDate, startDate) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');

    const query = `${dataServiceUrl}backtest/strategy`;

    const options = {
      method: 'POST',
      uri: query,
      body: {
        symbol,
        to,
        from,
        strategy: 'FINDRESISTANCE'
      },
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error findResistance: ', error);
      });
  }

  getRocMfiTrend(quotes) {
    const currentQuote = quotes[quotes.length - 1];
    const indicators = this.processQuotes(quotes);

    const quotes10Day = this.getSubArray(indicators.reals, 24);
    return this.getRateOfChange(quotes10Day, 24)
      .then((roc10) => {
        const rocLen = roc10[0].length - 1;
        currentQuote.roc10 = _.round(roc10[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 24, -1), 24);
      })
      .then((roc10Previous) => {
        const rocLen = roc10Previous[0].length - 1;
        currentQuote.roc10Previous = _.round(roc10Previous[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArray(indicators.reals, 70), 70);
      })
      .then((roc70) => {
        const rocLen = roc70[0].length - 1;
        currentQuote.roc70 = _.round(roc70[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 70, -1), 70);
      })
      .then((roc70Previous) => {
        const rocLen = roc70Previous[0].length - 1;
        currentQuote.roc70Previous = _.round(roc70Previous[0][rocLen], 4);

        return MfiService.getMfi(this.getSubArray(indicators.highs, 14),
          this.getSubArray(indicators.lows, 14),
          this.getSubArray(indicators.reals, 14),
          this.getSubArray(indicators.volumes, 14),
          14);
      })
      .then((mfiLeft) => {
        const len = mfiLeft[0].length - 1;
        currentQuote.mfiLeft = _.round(mfiLeft[0][len], 3);
        return MfiService.getMfi(this.getSubArrayShift(indicators.highs, 14, -10),
          this.getSubArrayShift(indicators.lows, 14, -10),
          this.getSubArrayShift(indicators.reals, 14, -10),
          this.getSubArrayShift(indicators.volumes, 14, -10),
          14);
      })
      .then((mfiPrevious) => {
        const len = mfiPrevious[0].length - 1;
        currentQuote.mfiPrevious = _.round(mfiPrevious[0][len], 3);
        return currentQuote;
      });
  }

  getMachineLearningIndicators(quotes) {
    const currentQuote = quotes[quotes.length - 1];
    const indicators = this.processQuotes(quotes);

    const quotes10Day = this.getSubArray(indicators.reals, 24);
    return this.getRateOfChange(quotes10Day, 24)
      .then((roc10) => {
        const rocLen = roc10[0].length - 1;
        currentQuote.roc10 = _.round(roc10[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 24, -1), 24);
      })
      .then((roc10Previous) => {
        const rocLen = roc10Previous[0].length - 1;
        currentQuote.roc10Previous = _.round(roc10Previous[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArray(indicators.reals, 70), 70);
      })
      .then((roc70) => {
        const rocLen = roc70[0].length - 1;
        currentQuote.roc70 = _.round(roc70[0][rocLen], 4);

        return this.getRateOfChange(this.getSubArrayShift(indicators.reals, 70, -1), 70);
      })
      .then((roc70Previous) => {
        const rocLen = roc70Previous[0].length - 1;
        currentQuote.roc70Previous = _.round(roc70Previous[0][rocLen], 4);

        return MfiService.getMfi(this.getSubArray(indicators.highs, 14),
          this.getSubArray(indicators.lows, 14),
          this.getSubArray(indicators.reals, 14),
          this.getSubArray(indicators.volumes, 14),
          14);
      })
      .then((mfiLeft) => {
        const len = mfiLeft[0].length - 1;
        currentQuote.mfiLeft = _.round(mfiLeft[0][len], 3);
        return MfiService.getMfi(this.getSubArrayShift(indicators.highs, 14, -10),
          this.getSubArrayShift(indicators.lows, 14, -10),
          this.getSubArrayShift(indicators.reals, 14, -10),
          this.getSubArrayShift(indicators.volumes, 14, -10),
          14);
      })
      .then((mfiPrevious) => {
        const len = mfiPrevious[0].length - 1;
        currentQuote.mfiPrevious = _.round(mfiPrevious[0][len], 3);
        return currentQuote;
      });
  }

  getAllRecommendations(price: number, indicator: Indicators, previousIndicator: Indicators, allIndicators: Indicators[]): Recommendation {
    const recommendations: Recommendation = {
      recommendation: OrderType.None,
      mfi: DaytradeRecommendation.Neutral,
      mfiLow: DaytradeRecommendation.Neutral,
      vwma: DaytradeRecommendation.Neutral,
      mfiTrade: DaytradeRecommendation.Neutral,
      macd: DaytradeRecommendation.Neutral,
      demark9: DaytradeRecommendation.Neutral,
      mfiDivergence: DaytradeRecommendation.Neutral,
      mfiDivergence2: DaytradeRecommendation.Neutral,
      bband: DaytradeRecommendation.Neutral,
      flagPennant: DaytradeRecommendation.Neutral,
      breakSupport: DaytradeRecommendation.Neutral,
      breakResistance: DaytradeRecommendation.Neutral
    };

    recommendations.roc = AlgoService.checkRocCrossover(indicator.roc70Previous, indicator.roc70, indicator.mfiLeft);

    recommendations.mfi = AlgoService.checkMfi(indicator.mfiLeft);

    recommendations.macd = AlgoService.checkMacd(indicator, previousIndicator);

    recommendations.demark9 = AlgoService.checkDemark9(indicator.demark9);

    recommendations.mfiLow = AlgoService.checkMfiLow(indicator.mfiLow, indicator.mfiLeft);

    recommendations.bband = AlgoService.checkBBand(price,
      AlgoService.getLowerBBand(indicator.bband80), AlgoService.getUpperBBand(indicator.bband80));

    recommendations.vwma = AlgoService.checkVwma(price, indicator.vwma);

    recommendations.mfiDivergence = AlgoService.checkMfiDivergence(allIndicators);
    recommendations.mfiDivergence2 = AlgoService.checkMfiDivergence2(allIndicators);
    recommendations.mfiTrade = AlgoService.checkMfiTrade(allIndicators);
    recommendations.flagPennant = AlgoService.checkFlagPennant(indicator);
    recommendations.breakSupport = AlgoService.checkSupport(indicator);
    recommendations.breakResistance = AlgoService.checkResistance(indicator);

    recommendations.recommendation = AlgoService.determineFinalRecommendation(allIndicators);

    return recommendations;
  }

  calibrateDaytrade(symbols, currentDate, startDate, response) {
    const quotesPromises = [];
    const parameters = {
      lossThreshold: 0.003,
      profitThreshold: 0.003,
      minQuotes: 81
    };

    for (const symbol of symbols) {
      quotesPromises.push(this.initDaytradeStrategy(symbol, startDate, currentDate, parameters));
    }

    Promise.all(quotesPromises).then(function (indicators) {
      response.status(200).send(indicators);
    });
  }

  trainV2Model(symbol, endDate, startDate, trainingSize) {
    const to = moment(endDate).format('YYYY-MM-DD');
    const from = moment(startDate).format('YYYY-MM-DD');
    console.log('from - to: ', from, to);

    const URI = `${mlServiceUrl}api/test-model?`;

    const options = {
      method: 'GET',
      uri: URI,
      qs: {
        symbol,
        to,
        from,
        trainingSize
      }
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error trainV2Model: ', error);
      });
  }

  trainCustomModel(symbol, modelName, trainingData, trainingSize, date) {
    const URI = `${mlServiceUrl}api/train-custom`;

    const options = {
      method: 'POST',
      uri: URI,
      body: {
        symbol,
        modelName,
        trainingData,
        trainingSize,
        to: date
      },
      json: true
    };
    console.log('model name: ', modelName);
    return RequestPromise(options)
      .catch((error) => {
        console.log('train-custom error: ', error.message);
      });
  }

  trainTensorModel(symbol, modelName, trainingData, trainingSize, date) {
    const URI = `${mlServiceUrl}api/tensor/train-model`;

    const options = {
      method: 'POST',
      uri: URI,
      body: {
        symbol,
        modelName,
        trainingData,
        trainingSize,
        to: date
      },
      json: true
    };

    return RequestPromise(options);
  }

  activateTensorModel(symbol, modelName, trainingData, date) {
    const URI = `${mlServiceUrl}api/tensor/train-model`;

    const options = {
      method: 'POST',
      uri: URI,
      body: {
        symbol,
        modelName,
        trainingData,
        to: date,
        scoreOnly: true
      },
      json: true
    };

    return RequestPromise(options);
  }

  activateV2Model(symbol, startDate, trainingData) {
    const today = moment(startDate).format('YYYY-MM-DD');

    const URI = `${mlServiceUrl}api/v2/activate`;

    const options = {
      method: 'POST',
      uri: URI,
      body: {
        symbol,
        input: trainingData[trainingData.length - 1].input,
        round: false,
        to: today
      },
      json: true
    };

    return RequestPromise(options)
      .catch((error) => {
        console.log('Error activateV2Model: ', error);
      });
  }

  activateCustomModel(symbol, modelName: string, input, to) {
    const URI = `${mlServiceUrl}api/activate-custom`;
    console.log('Activating model:', modelName);
    const options = {
      method: 'POST',
      uri: URI,
      body: {
        symbol,
        modelName,
        input,
        to,
        round: false
      },
      json: true
    };

    return RequestPromise(options);
  }
}

export default new BacktestService();
