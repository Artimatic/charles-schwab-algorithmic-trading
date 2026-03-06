import { Injectable } from '@angular/core';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { PortfolioInfoHolding, PortfolioService } from '@shared/services';
import { CartService } from '@shared/services/cart.service';
import { PricingService } from '../pricing/pricing.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { PriceTargetService } from './price-target.service';
import { AutopilotService } from './autopilot.service';
import { ReportingService } from '@shared/services';
import * as moment from 'moment-timezone';

/**
 * StrategyManagementService handles all strategy-related business logic including:
 * - Setting up daily trading strategies
 * - Backtesting individual stocks
 * - Modifying holdings based on backtest results
 * - Managing trading patterns
 * - Handling buy/sell signals at close/open
 */
@Injectable({
  providedIn: 'root'
})
export class StrategyManagementService {
  private isBacktestInProgress = false;

  constructor(
    private strategyBuilderService: StrategyBuilderService,
    private machineDaytradingService: MachineDaytradingService,
    private findPatternService: FindPatternService,
    private portfolioService: PortfolioService,
    private cartService: CartService,
    private pricingService: PricingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService,
    private autopilotService: AutopilotService,
    private reportingService: ReportingService
  ) {}

  /**
   * Sets up the daily trading strategy by initializing SPY ML, volatility, and price targets
   */
  async setupStrategy(): Promise<void> {
    try {
      const backtestData = await this.strategyBuilderService.getBacktestData('SPY');
      if (!backtestData || backtestData.ml === null || backtestData.ml === undefined) {
        throw new Error('Failed to fetch backtest data for SPY');
      }
      this.autopilotService.setLastSpyMl(backtestData.ml);
      this.autopilotService.updateVolatility();

      await this.autopilotService.updateBtcPrediction();
      await this.autopilotService.updateGldPrediction();
      await this.priceTargetService.setTargetDiff();
    } catch (error) {
      console.log('Error setting up strategy', error);
      // Set conservative defaults, then rethrow to abort initialization
      this.autopilotService.setLastSpyMl(0.5);
      this.autopilotService.setVolatilityMl(0.5);
      throw error;
    }
  }

  /**
   * Backtests the next available stock not currently held
   * @param overwrite - Whether to overwrite cached backtest data
   * @param addTrade - Whether to add the trade (currently unused)
   */
  async backtestOneStock(overwrite = false, addTrade = true): Promise<void> {
    if (this.isBacktestInProgress) {
      return;
    }

    this.isBacktestInProgress = true;
    try {
      const currentHoldings = this.autopilotService.getCurrentHoldings();
      let stock = this.machineDaytradingService.getNextStock();
      while (currentHoldings.find((value) => value.name === stock)) {
        stock = this.machineDaytradingService.getNextStock();
      }
      await this.strategyBuilderService.getBacktestData(stock, overwrite);
    } catch (error) {
      console.log('Error finding new trade', error);
    } finally {
      this.isBacktestInProgress = false;
    }
  }

  /**
   * Evaluates current holdings and modifies based on backtest results
   * - Sells options positions based on pricing and ML scores
   * - Sells stocks with strong sell signals
   * - Adds bullish stocks to the watch list
   */
  async modifyCurrentHoldings(): Promise<void> {
    const holdings = this.autopilotService.getCurrentHoldings();
    for (const holding of holdings) {
      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
        if (holding.primaryLegs) {
          if (this.cartService.isStrangle(holding)) {
            const { callsTotalPrice, putsTotalPrice } = await this.pricingService.getPricing(
              holding.primaryLegs,
              holding.secondaryLegs
            );
            if (
              putsTotalPrice > callsTotalPrice &&
              backtestResults &&
              backtestResults.sellMl !== null &&
              backtestResults.sellMl > 0.6
            ) {
              this.optionsOrderBuilderService.sellStrangle(holding);
            } else if (
              callsTotalPrice > putsTotalPrice &&
              backtestResults &&
              backtestResults.ml !== null &&
              backtestResults.ml > 0.7
            ) {
              this.optionsOrderBuilderService.sellStrangle(holding);
            }
          }
        } else if (
          backtestResults &&
          (backtestResults.recommendation === 'STRONGSELL' ||
            backtestResults.recommendation === 'SELL' ||
            holding.name === 'TQQQ')
        ) {
          console.log('Backtest indicates sell', backtestResults);
          await this.cartService.portfolioSell(holding, 'Backtest indicates sell');
        } else if (
          backtestResults &&
          backtestResults.ml !== null &&
          backtestResults.ml > 0.7 &&
          (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY')
        ) {
          console.log('Backtest indicates buying', backtestResults);
          this.strategyBuilderService.addBullishStock(holding.name);
        }
      } catch (error) {
        console.log('Backtest error', error);
      }
    }
  }

  /**
   * Evaluates if a prediction indicates a buy signal
   * Returns true if average prediction > 0.7, false if < 0.3, null if unclear
   */
  isBuyPrediction(prediction: { label: string; value: any[] }): boolean | null {
    if (prediction) {
      let predictionSum = 0;
      for (const p of prediction.value) {
        predictionSum += p.prediction;
      }

      const avgPrediction = predictionSum / prediction.value.length;
      if (avgPrediction > 0.7) {
        return true;
      } else if (avgPrediction < 0.3) {
        return false;
      }
    }
    return null;
  }

  /**
   * Clears the current cart and resets strategy state
   */
  resetCart(): void {
    this.optionsOrderBuilderService.clearTradingPairs();
    this.cartService.removeCompletedOrders();
    this.cartService.otherOrders = [];
    this.cartService.buyOrders = [];
    this.strategyBuilderService.sanitizeData();
  }

  /**
   * Runs pattern discovery algorithm
   */
  runFindPattern(): void {
    this.findPatternService.developPattern();
  }

  /**
   * Removes a trading strategy from the system
   */
  removeStrategy(item: any): void {
    console.log('TODO remove', item);
    this.autopilotService.strategies = this.autopilotService.strategies.filter(
      (s) => s.key !== item.key || s.name !== item.name || s.date !== item.date
    );
    this.strategyBuilderService.removeTradingStrategy(item);
  }

  /**
   * Handles buy/sell at market close or open
   * Gets SPY ML prediction and may trigger buy signal
   */
  async buySellAtCloseOrOpen(): Promise<void> {
    const overBalance = await this.autopilotService.handleBalanceUtilization(
      this.autopilotService.getCurrentHoldings()
    );
    if (overBalance) {
      return;
    }

    const backtestData = await this.strategyBuilderService.getBacktestData('SPY');
    this.autopilotService.setLastSpyMl(backtestData.ml);
  }

  /**
   * Sells all current stock holdings
   */
  async sellAll(): Promise<void> {
    await this.autopilotService.setCurrentHoldings();
    const holdings = this.autopilotService.getCurrentHoldings();
    for (const holding of holdings) {
      if (!this.cartService.isStrangle(holding)) {
        if (!holding?.primaryLegs?.length) {
          await this.cartService.portfolioSell(holding, 'Sell all command');
        }
      }
    }
  }

  /**
   * Adds final results to audit log and resets profit tracking
   */
  addCurrentHoldingsToAuditLog(): void {
    if (this.autopilotService.currentHoldings && this.autopilotService.currentHoldings.length > 0) {
      const holdingsSummary = this.autopilotService.currentHoldings.map((h) => ({
        name: h.name,
        pl: h.pl,
        netLiq: h.netLiq,
        shares: h.shares,
        alloc: h.alloc,
        recommendation: h.recommendation
      }));
      this.reportingService.addAuditLog(
        null,
        `Current Holdings: ${JSON.stringify(holdingsSummary)}`
      );
    } else {
      this.reportingService.addAuditLog(null, 'No current holdings to log.');
    }
  }
}
