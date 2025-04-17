import { Injectable } from '@angular/core';
import { round } from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class AllocationService {

  constructor() { }

  determineProbabilityOfProfit(buySignalCount: number, sellSignalCount: number,
    impliedMovement: number, ml: number) {
      const pop = round((buySignalCount) / (buySignalCount + sellSignalCount + (impliedMovement * 100)), 4);
    return pop;
  }

  calculateKellyCriterion(probabilityOfProfit: number, betGain: number): number {
    /**
     * Calculates the Kelly Criterion for a bet.
     *
     * @param probabilityOfProfit The probability (between 0 and 1) of winning the bet.
     * @param betGain The fractional amount gained relative to your wager if the bet is won (e.g., if you bet $1 and win $1, betGain is 1; if you win $0.50, betGain is 0.5).
     * @returns The fraction of your capital to bet according to the Kelly Criterion.
     * @throws Error if probabilityOfProfit is not between 0 and 1 or if betGain is not positive.
     */
    if (probabilityOfProfit < 0 || probabilityOfProfit > 1) {
      throw new Error("Probability of profit must be between 0 and 1.");
    }
    if (betGain <= 0) {
      throw new Error("Bet gain must be a positive number.");
    }

    const probabilityOfLoss = 1 - probabilityOfProfit;

    // Kelly Criterion formula: f* = p - q / b
    // where:
    // f* = fraction of capital to bet
    // p = probability of winning
    // q = probability of losing (1 - p)
    // b = fractional bet gain (odds as a decimal)

    const kellyFraction = probabilityOfProfit - (probabilityOfLoss / betGain);

    return Math.max(0, kellyFraction); // Kelly fraction cannot be negative
  }
}
