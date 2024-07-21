import { Injectable } from '@angular/core';
import { MachineLearningService, ReportingService, SmartOrder } from '@shared/index';
import { Recommendation } from '@shared/stock-backtest.interface';
import { PricingService } from '../pricing/pricing.service';
import * as moment from 'moment-timezone';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { BacktestService, CartService, PortfolioService, TradeService } from '@shared/services';
import { Options } from '@shared/models/options';
import { AlgoQueueItem } from '@shared/services/trade.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';

@Injectable({
  providedIn: 'root'
})
export class OrderHandlingService {

  constructor(
    private reportingService: ReportingService,
    private pricingService: PricingService,
    private machineLearningService: MachineLearningService,
    private globalSettingsService: GlobalSettingsService,
    private cartService: CartService,
    private portfolioService: PortfolioService,
    private tradeService: TradeService,
    private daytradeStrategiesService: DaytradeStrategiesService,
    private backtestService: BacktestService,
    private strategyBuilderService: StrategyBuilderService
  ) { }

  async hasPositions(symbols: string[]) {
    const portfolioHolding = await this.portfolioService.getTdPortfolio().toPromise();
    return Boolean(portfolioHolding.find((pos) => {
      return Boolean(symbols.find(sym => sym === pos.instrument.symbol));
    }));
  }

  incrementSell(order) {
    order.sellCount += order.quantity;
    order.positionCount -= order.quantity;

    this.cartService.updateOrder(order);
  }

  incrementBuy(order) {
    order.buyCount += order.quantity;
    order.positionCount += order.quantity;

    this.cartService.updateOrder(order);
  }

  async passMlCheck(symbol: string, predicate: (val: number) => boolean) {
    const mlResult = await this.machineLearningService
      .trainDaytrade(symbol.toUpperCase(),
        moment().add({ days: 1 }).format('YYYY-MM-DD'),
        moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
        1,
        this.globalSettingsService.daytradeAlgo
      ).toPromise();
    if (mlResult) {
      if (!predicate(mlResult[0].nextOutput)) {
        return false;
      }
    }
    return true;
  }

  async sendSellStrangle(order: SmartOrder, calls: Options[], puts: Options[], callsTotalPrice, putsTotalPrice) {
    const callsStrArr = calls.map(c => c.symbol);
    const putsStrArr = puts.map(c => c.symbol);
    const hasPosition = await this.hasPositions(callsStrArr.concat(putsStrArr));
    if (hasPosition) {
      this.portfolioService.sendMultiOrderSell(calls,
        puts, callsTotalPrice + putsTotalPrice).subscribe();
      this.incrementSell(order);
    }
  }

  async sellStrangle(order: SmartOrder, analysis: Recommendation) {
    const calls = order.primaryLegs;
    const puts = order.secondaryLegs;
    const { callsTotalPrice, putsTotalPrice } = await this.pricingService.getPricing(calls, puts);
    const strangleOrderDescription = calls.concat(puts).map(v => v.description).join(',');
    this.reportingService.addAuditLog(order.holding.symbol, `Selling ${strangleOrderDescription}`);
    if (callsTotalPrice > putsTotalPrice) {
      if (analysis.recommendation.toLowerCase() === 'sell') {
        const passed = await this.passMlCheck(order.holding.symbol, (val: number) => val < 0.5);
        if (passed) {
          this.sendSellStrangle(order, calls, puts, callsTotalPrice, putsTotalPrice);
        }
      }
    } else {
      if (analysis.recommendation.toLowerCase() === 'buy') {
        const passed = await this.passMlCheck(order.holding.symbol, (val: number) => val > 0.5);
        if (passed) {
          this.sendSellStrangle(order, calls, puts, callsTotalPrice, putsTotalPrice);
        }
      }
    }
  }

  async intradayStep(symbol: string) {
    if (!this.daytradeStrategiesService.shouldSkip(symbol)) {
      let mlResult;
      try {
        mlResult = await this.machineLearningService.activate(symbol,
          this.globalSettingsService.daytradeAlgo).toPromise();
      } catch {
        mlResult = await this.machineLearningService
          .trainDaytrade(symbol.toUpperCase(),
            moment().add({ days: 1 }).format('YYYY-MM-DD'),
            moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
            1,
            this.globalSettingsService.daytradeAlgo
          ).toPromise()[0];
      }
      this.backtestService.getDaytradeRecommendation(symbol.toUpperCase(), null, null, { minQuotes: 81 })
        .subscribe(
          async (analysis) => {
            const queueItem: AlgoQueueItem = {
              symbol: symbol,
              reset: false,
              analysis: analysis,
              ml: mlResult ? mlResult : null
            };
            this.tradeService.algoQueue.next(queueItem);
          }
        );
    }
  }

  sellOption(symbol: string, quantity: number) {
    this.backtestService.getLastPriceTiingo({ symbol: symbol })
      .subscribe(tiingoQuote => {
        const estPrice = this.strategyBuilderService.findOptionsPrice(tiingoQuote[symbol].quote.bidPrice, tiingoQuote[symbol].quote.askPrice);
        this.portfolioService.sendOptionSell(symbol, quantity, estPrice, false).subscribe();
      });
  }

  buyOption(symbol: string, quantity: number) {
    this.backtestService.getLastPriceTiingo({ symbol: symbol })
      .subscribe(tiingoQuote => {
        const estPrice = this.strategyBuilderService.findOptionsPrice(tiingoQuote[symbol].quote.bidPrice, tiingoQuote[symbol].quote.askPrice);
        this.portfolioService.sendOptionBuy(symbol, quantity, estPrice, false).subscribe();
      });
  }
}
