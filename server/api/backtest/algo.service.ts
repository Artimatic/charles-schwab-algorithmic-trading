import * as _ from 'lodash';
import { Indicators, DaytradeRecommendation, OrderType } from './backtest.constants';
import DecisionService from '../mean-reversion/reversion-decision.service';

class AlgoService {
  getLowerBBand(bband): number {
    return bband[0][0];
  }

  getUpperBBand(bband): number {
    return bband[2][0];
  }

  checkVwma(lastClose: number, vwma: number): DaytradeRecommendation {
    if (_.isNumber(lastClose) && _.isNumber(vwma)) {
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
    if (!indicators.length) {
      return DaytradeRecommendation.Neutral;
    }
    if (indicators[0].mfiLeft > indicators[indicators.length - 1].mfiLeft &&
      indicators[0].close < indicators[indicators.length - 1].close) {
      return indicators.reduce((previous, current) => {
        if (current.open > current.close) {
          previous.downCloseCount++;
        } else {
          previous.upCloseCount++;
        }

        if (previous.upCloseCount > previous.downCloseCount) {
          previous.recommendation = DaytradeRecommendation.Bullish;
        }
        return previous;
      }, {
        downCloseCount: 0,
        upCloseCount: 0,
        recommendation: DaytradeRecommendation.Neutral
      }).recommendation;
    } else if (indicators[0].mfiLeft < indicators[indicators.length - 1].mfiLeft && indicators[0].close > indicators[indicators.length - 1].close) {
      return indicators.reduce((previous, current) => {
        if (current.open > current.close) {
          previous.downCloseCount++;
        } else {
          previous.upCloseCount++;
        }

        if (previous.upCloseCount < previous.downCloseCount) {
          previous.recommendation = DaytradeRecommendation.Bearish;
        }
        return previous;
      }, {
        downCloseCount: 0,
        upCloseCount: 0,
        recommendation: DaytradeRecommendation.Neutral
      }).recommendation;
    } else {
      return DaytradeRecommendation.Neutral;
    }
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
          if (change > 0 && change < 0.1) {
            previous.bband = DaytradeRecommendation.Bullish;
          } else if (change < 0 && change < 0.1) {
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

      if (previous.bullishCounter > 9 && previous.bearishCounter < 3) {
        if (indicators[indicators.length - 3].mfiLeft < indicators[indicators.length - 1].mfiLeft && indicators[indicators.length - 3].close < indicators[indicators.length - 1].close) {
          previous.recommendation = OrderType.Buy;
        }
      } else if (previous.bearishCounter > 9 && previous.bullishCounter < 3) {
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
