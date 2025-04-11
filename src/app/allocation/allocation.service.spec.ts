import { TestBed } from '@angular/core/testing';
import { round } from 'lodash'; // Import round from lodash directly if needed for comparison

import { AllocationService } from './allocation.service';

describe('AllocationService', () => {
  let service: AllocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AllocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('determineProbabilityOfProfit', () => {
    it('should calculate probability correctly with positive inputs', () => {
      const buySignalCount = 10;
      const sellSignalCount = 5;
      const impliedMovement = 0.1;
      const ml = 0.6;
      // Calculation:
      // ceil((10 * (1 / 0.1) * 0.07) + 0.6) = ceil((10 * 10 * 0.07) + 0.6) = ceil(7 + 0.6) = ceil(7.6) = 8
      // 8 / (10 + 5) = 8 / 15 = 0.53333...
      // round(0.53333..., 4) = 0.5333
      const expectedProbability = 0.5333;
      expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBeCloseTo(expectedProbability, 4);
    });

    it('should handle zero sell signals', () => {
      const buySignalCount = 8;
      const sellSignalCount = 0;
      const impliedMovement = 0.05;
      const ml = 0.7;
      // Calculation:
      // ceil((8 * (1 / 0.05) * 0.07) + 0.7) = ceil((8 * 20 * 0.07) + 0.7) = ceil(11.2 + 0.7) = ceil(11.9) = 12
      // 12 / (8 + 0) = 12 / 8 = 1.5
      // round(1.5, 4) = 1.5
      const expectedProbability = 1.5; // Note: Probability > 1 is possible with this formula
      expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBeCloseTo(expectedProbability, 4);
    });

    it('should handle zero buy signals', () => {
      const buySignalCount = 0;
      const sellSignalCount = 10;
      const impliedMovement = 0.15;
      const ml = 0.4;
      // Calculation:
      // ceil((0 * (1 / 0.15) * 0.07) + 0.4) = ceil(0 + 0.4) = ceil(0.4) = 1
      // 1 / (0 + 10) = 1 / 10 = 0.1
      // round(0.1, 4) = 0.1
      const expectedProbability = 0.1;
      expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBeCloseTo(expectedProbability, 4);
    });

    it('should handle zero buy and sell signals (division by zero)', () => {
      const buySignalCount = 0;
      const sellSignalCount = 0;
      const impliedMovement = 0.1;
      const ml = 0.5;
      // Calculation leads to division by zero (buySignalCount + sellSignalCount = 0)
      // ceil((0 * (1/0.1) * 0.07) + 0.5) = ceil(0.5) = 1
      // 1 / 0 = Infinity
      expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBe(Infinity);
    });

    it('should handle very small implied movement (approaching division by zero in term)', () => {
        const buySignalCount = 1;
        const sellSignalCount = 1;
        const impliedMovement = 0.00001; // Very small
        const ml = 0.5;
        // Calculation:
        // ceil((1 * (1 / 0.00001) * 0.07) + 0.5) = ceil((1 * 100000 * 0.07) + 0.5) = ceil(7000 + 0.5) = 7001
        // 7001 / (1 + 1) = 7001 / 2 = 3500.5
        // round(3500.5, 4) = 3500.5
        const expectedProbability = 3500.5;
        expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBeCloseTo(expectedProbability, 4);
      });

    // Note: The formula uses 1/impliedMovement. If impliedMovement is 0, this results in Infinity.
    it('should handle zero implied movement', () => {
        const buySignalCount = 5;
        const sellSignalCount = 5;
        const impliedMovement = 0;
        const ml = 0.5;
        // Calculation:
        // ceil((5 * (1 / 0) * 0.07) + 0.5) = ceil(Infinity * 0.07 + 0.5) = ceil(Infinity) = Infinity
        // Infinity / (5 + 5) = Infinity / 10 = Infinity
        expect(service.determineProbabilityOfProfit(buySignalCount, sellSignalCount, impliedMovement, ml)).toBe(Infinity);
    });
  });

  describe('calculateKellyCriterion', () => {
    it('should calculate Kelly fraction correctly when profitable', () => {
      const probabilityOfProfit = 0.6; // 60% chance to win
      const betGain = 1; // Win amount equals bet amount (1:1 odds)
      // Calculation: 0.6 - ((1 - 0.6) / 1) = 0.6 - (0.4 / 1) = 0.6 - 0.4 = 0.2
      const expectedFraction = 0.2; // Bet 20% of capital
      expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBeCloseTo(expectedFraction, 4);
    });

    it('should calculate Kelly fraction correctly with different bet gain', () => {
        const probabilityOfProfit = 0.7; // 70% chance to win
        const betGain = 0.5; // Win amount is half the bet amount (win $0.50 for every $1 bet)
        // Calculation: 0.7 - ((1 - 0.7) / 0.5) = 0.7 - (0.3 / 0.5) = 0.7 - 0.6 = 0.1
        const expectedFraction = 0.1; // Bet 10% of capital
        expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBeCloseTo(expectedFraction, 4);
      });

    it('should return 0 when the bet is not favorable (p <= q/b)', () => {
      const probabilityOfProfit = 0.5; // 50% chance to win
      const betGain = 1; // 1:1 odds
      // Calculation: 0.5 - ((1 - 0.5) / 1) = 0.5 - 0.5 = 0
      const expectedFraction = 0; // Bet 0%
      expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBe(expectedFraction);
    });

    it('should return 0 when probability is low', () => {
        const probabilityOfProfit = 0.2; // 20% chance to win
        const betGain = 2; // Win double the bet amount (2:1 odds)
        // Calculation: 0.2 - ((1 - 0.2) / 2) = 0.2 - (0.8 / 2) = 0.2 - 0.4 = -0.2
        // Math.max(0, -0.2) = 0
        const expectedFraction = 0; // Bet 0%
        expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBe(expectedFraction);
      });

    it('should throw error if probabilityOfProfit is less than 0', () => {
      expect(() => service.calculateKellyCriterion(-0.1, 1))
        .toThrowError("Probability of profit must be between 0 and 1.");
    });

    it('should throw error if probabilityOfProfit is greater than 1', () => {
      expect(() => service.calculateKellyCriterion(1.1, 1))
        .toThrowError("Probability of profit must be between 0 and 1.");
    });

    it('should throw error if betGain is zero', () => {
      expect(() => service.calculateKellyCriterion(0.6, 0))
        .toThrowError("Bet gain must be a positive number.");
    });

    it('should throw error if betGain is negative', () => {
      expect(() => service.calculateKellyCriterion(0.6, -1))
        .toThrowError("Bet gain must be a positive number.");
    });

    it('should handle probabilityOfProfit = 1', () => {
        const probabilityOfProfit = 1; // 100% chance to win
        const betGain = 1;
        // Calculation: 1 - ((1 - 1) / 1) = 1 - (0 / 1) = 1 - 0 = 1
        const expectedFraction = 1; // Bet 100%
        expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBe(expectedFraction);
      });

      it('should handle probabilityOfProfit = 0', () => {
        const probabilityOfProfit = 0; // 0% chance to win
        const betGain = 1;
        // Calculation: 0 - ((1 - 0) / 1) = 0 - (1 / 1) = -1
        // Math.max(0, -1) = 0
        const expectedFraction = 0; // Bet 0%
        expect(service.calculateKellyCriterion(probabilityOfProfit, betGain)).toBe(expectedFraction);
      });
  });
});
