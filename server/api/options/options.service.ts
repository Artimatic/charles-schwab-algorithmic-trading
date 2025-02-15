
import * as _ from 'lodash';

import PortfolioService from '../portfolio/portfolio.service';

import * as configurations from '../../config/environment';

const dataServiceUrl = configurations.apps.goliath;

export interface MonthlyStrategyList {
  month: string;
  year: number;
  day: number;
  daysToExp: number;
  secondaryMonth: string;
  secondaryYear: number;
  secondaryDay: number;
  secondaryDaysToExp: number;
  type: string;
  secondaryType: string;
  leap: boolean;
  optionStrategyList: Strategy[];
}

export interface Strategy {
  primaryLeg: Option;
  secondaryLeg: Option;
  strategyStrike: number;
  strategyBid: number;
  strategyAsk: number;
}

export interface Option {
  symbol: string;
  putCallInd: string;
  description: string;
  bid: number;
  ask: number;
  range: string;
  strikePrice: number;
  totalVolume: number;
}

export interface OptionsChain {
  symbol: string;
  status: string;
  strategy: string;
  interval: number;
  isDelayed: boolean;
  isIndex: boolean;
  interestRate: number;
  underlyingPrice: number;
  volatility: number;
  daysToExpiration: number;
  numberOfContracts: number;
  assetMainType: string;
  assetSubType: string;
  isChainTruncated: boolean;
  intervals: number[];
  monthlyStrategyList: MonthlyStrategyList[];
}

export interface ImpliedMove {
  move: number;
  upperPrice: number;
  lowerPrice: number;
  strategy: Strategy;
}

class OptionService {

  getMidPrice(ask, bid) {
    return _.round(_.multiply(_.add(_.divide(_.subtract(_.divide(ask, bid), 1), 2), 1), bid), 2);
  }

  calculateImpliedMove(accountId, symbol, strikeCount, optionType, minExpiration = 29, response) {
    return PortfolioService.getOptionsStrangle(accountId, symbol, strikeCount, optionType, response)
      .then((strangleOptionsChain: OptionsChain) => {
        if (!strangleOptionsChain || !strangleOptionsChain.monthlyStrategyList) {
          console.log('monthlyStrategyList not found', strangleOptionsChain);
          return {
            move: null,
            upperPrice: null,
            lowerPrice: null,
            strategyCost: null,
            strategy: null,
            optionsChain: strangleOptionsChain
          };
        }
        const strategyList = strangleOptionsChain.monthlyStrategyList.find(element => element.daysToExp >= minExpiration);
        const goal = strangleOptionsChain.underlyingPrice;

        const closestStrikeStrangle = strategyList.optionStrategyList.reduce((prev, curr) => {
          return (Math.abs(Number(curr.strategyStrike) - goal) < Math.abs(Number(prev.strategyStrike) - goal) ? curr : prev);
        });

        const strategyCost = this.getMidPrice(closestStrikeStrangle.strategyAsk, closestStrikeStrangle.strategyBid);
        const move = _.round(strategyCost / goal, 3);
        const movePrice = _.round(move * goal, 2);

        // this.saveImpliedMove(symbol, move);
        return {
          move,
          upperPrice: _.round(goal + movePrice, 2),
          lowerPrice: _.round(goal - movePrice, 2),
          strategyCost,
          strategy: closestStrikeStrangle,
          optionsChain: strangleOptionsChain
        };
      });
  }

  findPriceDivergence(
    price: number,
    options: Option[]
  ): { option: Option; divergence: number; type: 'positive' | 'negative' }[] {

    const divergences: { option: Option; divergence: number; type: 'positive' | 'negative' }[] = [];

    for (const option of options) {
      // Basic divergence calculation (you'll likely want to refine this)
      let expectedOptionPrice: number;

      // A very simplified option pricing model.  Real-world pricing is much more complex.
      // This is just an example and needs significant improvement for production use.
      if (option.putCallInd === 'C') {
        expectedOptionPrice = Math.max(0, price - option.strikePrice); // Intrinsic value only - very basic
      } else { // PUT
        expectedOptionPrice = Math.max(0, option.strikePrice - price); // Intrinsic value only - very basic
      }

      const divergence = price - expectedOptionPrice;

      if (divergence !== 0) { // Only record if there is a divergence
        divergences.push({
          option,
          divergence,
          type: divergence > 0 ? 'positive' : 'negative',
        });
      }

    }

    return divergences;
  }
  // private saveImpliedMove(symbol: string, move: number) {
  //   if (move) {
  //     axios.post(`${dataServiceUrl}backtest/update-implied-move`, {
  //       symbol,
  //       impliedMove: move
  //     });
  //   }
  // }
}

export default new OptionService();
