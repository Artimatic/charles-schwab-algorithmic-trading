import { Injectable } from '@angular/core';
import { MachineLearningService, ReportingService, SmartOrder } from '@shared/index';
import { Recommendation } from '@shared/stock-backtest.interface';
import { PricingService } from '../pricing/pricing.service';
import * as moment from 'moment-timezone';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService, TradeService } from '@shared/services';
import { Options } from '@shared/models/options';
import { AlgoQueueItem } from '@shared/services/trade.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';

@Injectable({
  providedIn: 'root'
})
export class OrderHandlingService {
  skipMl = false;
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
        this.sendSellStrangle(order, calls, puts, callsTotalPrice, putsTotalPrice);
      }
    } else {
      if (analysis.recommendation.toLowerCase() === 'buy') {
        this.sendSellStrangle(order, calls, puts, callsTotalPrice, putsTotalPrice);
      }
    }
  }

  async intradayStep(symbol: string) {
    if (!this.daytradeStrategiesService.shouldSkip(symbol)) {
      const analysis = await this.backtestService.getDaytradeRecommendation(symbol.toUpperCase(), null, null, { minQuotes: 81 }).toPromise();
      const hasBuyPotential = this.daytradeStrategiesService.isPotentialBuy(analysis);
      const hasSellPotential = this.daytradeStrategiesService.isPotentialSell(analysis);
      if (hasBuyPotential || hasSellPotential) {
        // const startTime = new Date().valueOf();
        // if (!this.skipMl || symbol === 'SPY' || symbol === 'QQQ') {
        //   try {
        //     await this.trainIntradayModel(analysis, symbol);

        //     const currentMil = new Date().valueOf();
        //     if (currentMil - startTime > 180000) {
        //       this.skipMl = true;
        //     } else {
        //       this.skipMl = false;
        //     }
        //   } catch (error) {
        //     console.log(error);
        //   }
        // }
        const queueItem: AlgoQueueItem = {
          symbol: symbol,
          reset: false,
          analysis: analysis,
          ml: null
        };
        this.tradeService.algoQueue.next(queueItem);
      }
    }
  }

  async trainIntradayModel(analysis, symbol: string) {
    const ml = await this.machineLearningService
      .trainDaytrade(symbol.toUpperCase(),
        moment().add({ days: 1 }).format('YYYY-MM-DD'),
        moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
        0.8,
        this.globalSettingsService.daytradeAlgo
      ).toPromise()[0];

    const queueItem: AlgoQueueItem = {
      symbol: symbol,
      reset: false,
      analysis: analysis,
      ml: ml.nextOutput[0]
    };
    this.tradeService.algoQueue.next(queueItem);
  }

  async getEstimatedPrice(symbol: string) {
    try {
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const askPrice = Number(price[symbol].quote.askPrice);
      const bidPrice = Number(price[symbol].quote.bidPrice);
      return this.strategyBuilderService.findOptionsPrice(bidPrice, askPrice);
    } catch (error) {
      console.log('Error getting estimated price', error);
      return null;
    }
  }

  async buyOption(symbol: string, quantity: number, estimatedPrice = null, cb = () => { }) {
    const estPrice = estimatedPrice ? estimatedPrice : await this.getEstimatedPrice(symbol);
    this.portfolioService.sendOptionBuy(symbol, quantity, estPrice, false).subscribe(data => {
      console.log('Bought option', symbol, data);
      cb();
    });
  }
}
