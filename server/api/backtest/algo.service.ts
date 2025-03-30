import * as _ from 'lodash';
import { Indicators, DaytradeRecommendation, OrderType } from './backtest.constants';
import DecisionService from '../mean-reversion/reversion-decision.service';
import { findStocksMatchingTradingPattern, TradingPatternData } from './flag-pennant-algo.service';

class AlgoService {
  getLowerBBand(bband): number {
    return bband[0][0];
  }

  getBBandMA(bband): number {
    return bband[1][0];
  }

  getUpperBBand(bband): number {
    return bband[2][0];
  }

  checkVwma(lastClose: number, vwma: number): DaytradeRecommendation {
    const change = DecisionService.getPercentChange(lastClose, vwma);

    if (_.isNumber(lastClose) && _.isNumber(vwma) && Math.abs(change) < 0.03) {
      if (lastClose < vwma) {
        return DaytradeRecommendation.Bullish;
      } else {
        return DaytradeRecommendation.Bearish;
      }
    }
    return DaytradeRecommendation.Neutral;
  }

  checkMfi(mfi: number): DaytradeRecommendation {
    if (mfi < 23) {
      return DaytradeRecommendation.Bullish;
    } else if (mfi > 75) {
      return DaytradeRecommendation.Bearish;
    }
    return DaytradeRecommendation.Neutral;
  }

  checkRocMomentum(mfiPrevious: number, mfi: number,
    roc10: number, roc10Previous: number,
    roc70: number, roc70Previous: number): DaytradeRecommendation {
    if (roc10Previous >= 0 && roc10 < 0) {
      if (mfiPrevious > mfi) {
        return DaytradeRecommendation.Bearish;
      }
    }

    if (roc70Previous <= 0 && roc70 > 0) {
      if (mfi < 65 && mfiPrevious < mfi) {
        return DaytradeRecommendation.Bullish;
      }
    }

    return DaytradeRecommendation.Neutral;
  }

  checkBBand(price: number, low: number, high: number): DaytradeRecommendation {
    if (price <= low) {
      return DaytradeRecommendation.Bullish;
    }

    if (price >= high) {
      return DaytradeRecommendation.Bearish;
    }

    return DaytradeRecommendation.Neutral;
  }

  countRecommendation(recommendation: DaytradeRecommendation,
    counter: any) {
    switch (recommendation) {
      case DaytradeRecommendation.Bullish:
        counter.bullishCounter++;
        break;
      case DaytradeRecommendation.Bearish:
        counter.bearishCounter++;
        break;
      default:
        counter.neutralCounter++;
    }
    return counter;
  }

  checkRocCrossover(roc70Previous: number, roc70: number, mfi: number): DaytradeRecommendation {
    if (roc70Previous > 0 && roc70 < 0 && mfi > 78) {
      return DaytradeRecommendation.Bearish;
    }
    if (roc70Previous < 0 && roc70 > 0 && mfi < 23) {
      return DaytradeRecommendation.Bullish;
    }

    return DaytradeRecommendation.Neutral;
  }

  checkMfiTrend(mfiPrevious: number, mfi: number, roc10Previous: number, roc10: number): DaytradeRecommendation {
    const change = DecisionService.getPercentChange(mfi, mfiPrevious);
    const changeRoc = Math.abs(DecisionService.getPercentChange(roc10, roc10Previous));
    if (change > 0.2 && roc10 > roc10Previous && changeRoc > 0.1) {
      return DaytradeRecommendation.Bullish;
    } else if (change < -0.2 && roc10Previous > roc10 && changeRoc > 0.1) {
      return DaytradeRecommendation.Bearish;
    }

    return DaytradeRecommendation.Neutral;
  }

  checkMfiDivergence(indicators: Indicators[]): DaytradeRecommendation {
    return indicators.reduce((previous, current) => {
      if (current.recommendation.mfi === DaytradeRecommendation.Bearish) {
        previous.mfi = DaytradeRecommendation.Bullish;
      } else if (current.recommendation.mfi === DaytradeRecommendation.Bullish) {
        previous.mfi = DaytradeRecommendation.Bearish;
      }

      if (current.bband80 && current.bband80[1] && current.bband80[1][0]) {
        const change = DecisionService.getPercentChange(current.close, current.bband80[1][0]);
        if (change > 0 && change < 0.10) {
          previous.bband = DaytradeRecommendation.Bullish;
        } else if (change < 0 && change < 0.10) {
          previous.bband = DaytradeRecommendation.Bearish;
        }
      }

      if (previous.lastClose < current.close && previous.lastMfi > current.mfiLeft) {
        previous.divergent = DaytradeRecommendation.Bullish;
      } else if (previous.lastClose > current.close && previous.lastMfi < current.mfiLeft) {
        previous.divergent = DaytradeRecommendation.Bearish;
      } else {
        previous.lastClose = current.close;
        previous.lastMfi = current.mfiLeft;
      }

      if (previous.bband === DaytradeRecommendation.Bullish &&
        previous.divergent === DaytradeRecommendation.Bullish &&
        previous.mfi === DaytradeRecommendation.Bullish) {
        previous.recommendation = DaytradeRecommendation.Bullish;
      } else if (previous.bband === DaytradeRecommendation.Bearish &&
        previous.divergent === DaytradeRecommendation.Bearish &&
        previous.mfi === DaytradeRecommendation.Bearish) {
        previous.recommendation = DaytradeRecommendation.Bearish;
      }
      return previous;
    }, {
      mfi: DaytradeRecommendation.Neutral,
      macd: DaytradeRecommendation.Neutral,
      bband: DaytradeRecommendation.Neutral,
      lastMfi: 0,
      lastClose: 0,
      divergent: DaytradeRecommendation.Neutral,
      recommendation: DaytradeRecommendation.Neutral
    }).recommendation;
  }

  checkMfiTrade(indicators: Indicators[]): DaytradeRecommendation {
    return indicators.reduce((previous, current) => {
      if (current.recommendation.mfi === DaytradeRecommendation.Bearish) {
        if (previous.lastMfiHighPrice < current.close) {
          previous.recommendation = DaytradeRecommendation.Bearish;
        }
        previous.lastMfiHighPrice = current.close;
      } else if (current.recommendation.mfi === DaytradeRecommendation.Bullish) {
        if (previous.lastMfiLowPrice > current.close) {
          previous.recommendation = DaytradeRecommendation.Bullish;
        }
        previous.lastMfiLowPrice = current.close;
      } else {
        previous.recommendation = DaytradeRecommendation.Neutral;
      }
      return previous;
    }, {
      lastMfiLowPrice: 0,
      lastMfiHighPrice: 0,
      recommendation: DaytradeRecommendation.Neutral
    }).recommendation;
  }

  checkMfiDivergence2(indicators: Indicators[]): DaytradeRecommendation {
    if (!indicators.length) {
      return DaytradeRecommendation.Neutral;
    }
    return indicators.reduce((previous, current) => {
      try {
        if (current.recommendation.mfiLow === DaytradeRecommendation.Bullish ||
          current.recommendation.mfiLow === DaytradeRecommendation.Bearish) {
          previous.mfiLow = current.recommendation.mfiLow;
        }

        if (current.bband80 && current.bband80[1] && current.bband80[1][0]) {
          const change = DecisionService.getPercentChange(current.close, current.bband80[1][0]);
          if (change > 0 && change < 0.15) {
            previous.bband = DaytradeRecommendation.Bullish;
          } else if (change < 0 && change < 0.15) {
            previous.bband = DaytradeRecommendation.Bearish;
          }
        }

        if (current.open > current.close) {
          previous.downCloseCount++;
        } else {
          previous.upCloseCount++;
        }

        if (previous.upCloseCount < previous.downCloseCount && previous.bband === DaytradeRecommendation.Bearish && previous.mfiLow === DaytradeRecommendation.Bearish) {
          previous.recommendation = DaytradeRecommendation.Bearish;
        } else if (previous.upCloseCount > previous.downCloseCount && previous.bband === DaytradeRecommendation.Bullish && previous.mfiLow === DaytradeRecommendation.Bullish) {
          previous.recommendation = DaytradeRecommendation.Bullish;
        }
      } catch (error) {
        console.log(current);
        throw new Error(`checkMfiDivergenceError ${error}`);
      }
      return previous;
    }, {
      mfiLow: DaytradeRecommendation.Neutral,
      bband: DaytradeRecommendation.Neutral,
      downCloseCount: 0,
      upCloseCount: 0,
      recommendation: DaytradeRecommendation.Neutral
    }).recommendation;
  }

  checkSupport(indicator: Indicators): DaytradeRecommendation {
    if (indicator.high > indicator.support[0] &&
      indicator.low < indicator.support[0] &&
      indicator.close < indicator.support[0]) {
      return DaytradeRecommendation.Bearish;
    }

    return DaytradeRecommendation.Neutral;
  }

  checkResistance(indicator: Indicators): DaytradeRecommendation {
    if (indicator.high > indicator.resistance[0] &&
      indicator.low < indicator.resistance[0] &&
      indicator.close > indicator.resistance[0]) {
      return DaytradeRecommendation.Bullish;
    }

    return DaytradeRecommendation.Neutral;
  }

  checkMacd(indicator: Indicators, previousIndicator: Indicators): DaytradeRecommendation {
    if (previousIndicator) {
      const macd = indicator.macd[2];
      const prevMacd = previousIndicator.macd[2];

      if (macd[macd.length - 1] > 0 && prevMacd[prevMacd.length - 1] <= 0) {
        return DaytradeRecommendation.Bullish;
      } else if (macd[macd.length - 1] <= 0 && prevMacd[prevMacd.length - 1] > 0) {
        return DaytradeRecommendation.Bearish;
      }
    }
    return DaytradeRecommendation.Neutral;
  }

  checkMacdDaytrade(currentMacd: any, previousMacd: any): DaytradeRecommendation {
    if (previousMacd) {
      const macd = currentMacd[2];
      const prevMacd = previousMacd[2];

      if (macd[macd.length - 1] > 0 && prevMacd[prevMacd.length - 1] <= 0) {
        return DaytradeRecommendation.Bullish;
      } else if (macd[macd.length - 1] <= 0 && prevMacd[prevMacd.length - 1] > 0) {
        return DaytradeRecommendation.Bearish;
      }
    }
    return DaytradeRecommendation.Neutral;
  }

  checkDemark9(demark9Indicator): DaytradeRecommendation {
    if (demark9Indicator.perfectSell) {
      return DaytradeRecommendation.Bearish;
    } else if (demark9Indicator.perfectBuy) {
      return DaytradeRecommendation.Bullish;
    }
    return DaytradeRecommendation.Neutral;
  }

  checkMfiLow(mfiLow: number, mfi: number): DaytradeRecommendation {
    const change = DecisionService.getPercentChange(mfi, mfiLow);

    if (change < 0.03 && change > -0.03) {
      return DaytradeRecommendation.Bullish;
    }

    return DaytradeRecommendation.Neutral;
  }

  checkBBandBreakout(isBreakout) {
    return isBreakout ? DaytradeRecommendation.Bullish : DaytradeRecommendation.Neutral;
  }

  checkFlagPennant(indicator: Indicators): DaytradeRecommendation {
    if (indicator.flagPennant.flagPennantFormation &&
      indicator.flagPennant.steepPrecedingTrend &&
      indicator.flagPennant.breakoutOccurred) {
      return DaytradeRecommendation.Bullish;
    }
    return DaytradeRecommendation.Neutral;
  }

  addFlagPennantData(indicators: Indicators[]): TradingPatternData {
    const matchResult = findStocksMatchingTradingPattern(indicators, {
      steepPrecedingTrend: false,  // Set by the steep trend analysis
      flagPennantFormation: false,  // Set by the flag/pennant analysis
      breakoutOccurred: false,  //Set by the breakout anlaysis
      breakoutDirection: 'up',
      measuredRuleTargetMet: false,
    }, 10, 20);
    return matchResult;
  }

  determineFinalRecommendation(indicators: Indicators[]): OrderType {
    if (!indicators.length) {
      return OrderType.None;
    }

    return indicators.slice(-5).reduce((previous, current) => {
      const recommendations = current.recommendation;
      for (let rec in recommendations) {
        if (recommendations[rec] === DaytradeRecommendation.Bullish) {
          previous.bullishCounter++;
        } else if (recommendations[rec] === DaytradeRecommendation.Bearish) {
          previous.bearishCounter++;
        }
      }


      if (previous.bullishCounter > 4 && previous.bullishCounter - previous.bearishCounter > 3) {
        if (indicators[indicators.length - 3].mfiLeft < indicators[indicators.length - 1].mfiLeft && indicators[indicators.length - 3].close < indicators[indicators.length - 1].close) {
          previous.recommendation = OrderType.Buy;
        }
      } else if (previous.bearishCounter > 4 && previous.bearishCounter - previous.bullishCounter > 3) {
        if (indicators[indicators.length - 3].mfiLeft > indicators[indicators.length - 1].mfiLeft && indicators[indicators.length - 3].close > indicators[indicators.length - 1].close) {
          previous.recommendation = OrderType.Sell;
        }
      }
      return previous;
    }, {
      bullishCounter: 0,
      bearishCounter: 0,
      recommendation: OrderType.None
    }).recommendation;
  }
}

export default new AlgoService();
