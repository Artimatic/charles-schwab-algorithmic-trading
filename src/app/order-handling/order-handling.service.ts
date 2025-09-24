import { Injectable } from '@angular/core';
import { MachineLearningService, ReportingService, SmartOrder } from '@shared/index';
import { Recommendation } from '@shared/stock-backtest.interface';
import { PricingService } from '../pricing/pricing.service';
import * as moment from 'moment-timezone';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { BacktestService, CartService, DaytradeService, PortfolioInfoHolding, PortfolioService } from '@shared/services';
import { Options } from '@shared/models/options';
import { AlgoQueueItem } from '@shared/services/trade.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { round } from 'lodash-es';
import { OrderTypes } from '@shared/models/smart-order';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { HighriskSpecialPrefixInstance } from 'twilio/lib/rest/voice/v1/dialingPermissions/country/highriskSpecialPrefix';

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
    private daytradeStrategiesService: DaytradeStrategiesService,
    private backtestService: BacktestService,
    private strategyBuilderService: StrategyBuilderService,
    private daytradeService: DaytradeService,
    private machineDaytradingService: MachineDaytradingService,
  ) { }

  getStopLoss(low: number, high: number) {
    if (!low || !high) {
      return {
        profitTakingThreshold: 10000,
        stopLoss: -10000
      }
    }
    const profitTakingThreshold = round(((high / low) - 1) / 2, 4);
    const stopLoss = profitTakingThreshold * -1;
    return {
      profitTakingThreshold,
      stopLoss
    }
  }

  getTechnicalIndicators(stock: string, startDate: string, currentDate: string) {
    return this.backtestService.getBacktestEvaluation(stock, startDate, currentDate, 'daily-indicators');
  }

  async addBuy(holding: PortfolioInfoHolding, allocation, reason) {
    if (!holding.name) {
      throw Error('Ticker is missing')
    }
    if ((this.cartService.getBuyOrders().length + this.cartService.getOtherOrders().length) < this.cartService.getMaxTradeCount()) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicator = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicator.low, indicator.high);
        await this.cartService.portfolioBuy(holding,
          allocation || 0.01,
          thresholds.profitTakingThreshold,
          thresholds.stopLoss, reason);
      } catch (error) {
        console.log('Error getting backtest data for ', holding.name, error);
      }
    }
  }

  async hasPositions(symbols: string[]) {
    const portfolioHolding = await this.portfolioService.getTdPortfolio().toPromise();
    return Boolean(portfolioHolding.find((pos) => {
      return Boolean(symbols.find(sym => sym === pos.instrument.symbol));
    }));
  }

  initializeOrder(order: SmartOrder): SmartOrder {
    order.previousOrders = [];
    order.errors = [];
    order.warnings = [];
    return order;
  }

  sendSell(order: SmartOrder, lastPrice: number): SmartOrder {
    if (order) {
      order.price = round(lastPrice, 2);
      const log = `SELL ORDER SENT ${order.side} ${order.quantity} ${order.holding.symbol}@${order.price}`;
      order = this.incrementSell(order);

      const resolve = () => {
        console.log(`${moment().format('hh:mm')} - ${log}`);
        this.reportingService.addAuditLog(order.holding.symbol, log);
      };

      const reject = (error) => {
        if (!order.errors) {
          order.errors = [];
        }
        order.errors.push(error._body);
        order.stopped = true;
        this.reportingService.addAuditLog(order.holding.symbol, JSON.stringify(error._body));
      };

      const handleNotFound = () => {
        if (!order.warnings) {
          order.warnings = [];
        }
        order.stopped = true;
        const notFoundMsg = `Trying to sell position that doesn\'t exists ${order.holding.name}`;
        order.warnings.push(notFoundMsg);
        this.reportingService.addAuditLog(order.holding.symbol, notFoundMsg);
      };

      this.daytradeService.sendSell(order, 'limit', resolve, reject, handleNotFound);
    }
    return order;
  }

  hasReachedOrderLimit(order: SmartOrder) {
    const tradeType = order.side.toLowerCase();
    if (tradeType === 'daytrade') {
      return (order.buyCount >= order.quantity) &&
        (order.sellCount >= order.quantity);
    } else if (tradeType === 'buy') {
      return (order.buyCount >= order.quantity);
    } else if (tradeType === 'sell') {
      return order.sellCount >= order.quantity;
    }
  }

  async buyOptions(order: SmartOrder) {
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    const cashBalance = balance.cashBalance;
    const primaryLegPrice = await this.getEstimatedPrice(order.primaryLegs[0].symbol);
    if (order.secondaryLegs && order.secondaryLegs.length > 0) {
      const secondaryLegPrice = await this.getEstimatedPrice(order.secondaryLegs[0].symbol);
      const totalPrice = ((primaryLegPrice * order.primaryLegs[0].quantity) + (secondaryLegPrice * order.secondaryLegs[0].quantity) * 100);
      this.reportingService.addAuditLog(order.holding.symbol, `Total Price with secondary leg ${totalPrice}, balance: ${cashBalance}`);
      if (totalPrice < cashBalance) {
        order = this.incrementBuy(order);
        this.reportingService.addAuditLog(order.holding.symbol, `Buying ${order.primaryLegs[0].quantity} ${order.primaryLegs[0].symbol}@$${primaryLegPrice}`);
        this.reportingService.addAuditLog(order.holding.symbol, `Buying ${order.secondaryLegs[0].quantity} ${order.secondaryLegs[0].symbol}@$${secondaryLegPrice}`);

        await this.buyOption(order.primaryLegs[0].symbol, order.primaryLegs[0].quantity || 1, primaryLegPrice, () => { });
        await this.buyOption(order.secondaryLegs[0].symbol, order.secondaryLegs[0].quantity || 1, secondaryLegPrice, () => { });
      }
    } else {
      const totalPrice = primaryLegPrice * order.primaryLegs[0].quantity * 100;

      if (totalPrice < cashBalance) {
        order = this.incrementBuy(order);
        this.reportingService.addAuditLog(order.holding.symbol, `Buying ${order.quantity} ${order.primaryLegs[0].symbol}@$${primaryLegPrice}`);
        await this.buyOption(order.primaryLegs[0].symbol, order.quantity || 1);
      } else {
        this.reportingService.addAuditLog(order.holding.symbol, 'Balance is too low.');
      }
    }
    return order;
  }

  async sellOptions(order: SmartOrder) {
    const symbol = order.primaryLegs[0].symbol;
    order = this.incrementSell(order);
    const resolve = () => {
      const log = `Sell option sent ${order.quantity} ${symbol}`;
      console.log(`${moment().format('hh:mm')} ${log}`);
      this.reportingService.addAuditLog(symbol, log);
    };

    const reject = (error) => {
      if (!order.errors) {
        order.errors = [];
      }
      order.errors.push(error._body);
      order.stopped = true;
      this.reportingService.addAuditLog(symbol, JSON.stringify(error._body));
    };

    const handleNotFound = () => {
      if (!order.errors) {
        order.errors = [];
      }
      const error = `Trying to sell position that doesn\'t exists ${symbol}`;
      order.errors.push(error);
      order.stopped = true;
      this.reportingService.addAuditLog(symbol, error);
    };
    const price = await this.getEstimatedPrice(symbol);

    await this.daytradeService.sendOptionSell(symbol, order.quantity, price, resolve, reject, handleNotFound);
    return order;
  }

  async handleIntradayRecommendation(order: SmartOrder, analysis: Recommendation) {
    if (order.stopped) {
      return order;
    }
    const price = await this.backtestService.getLastPriceTiingo({ symbol: order.holding.symbol }).toPromise();
    order.price = round(price[order.holding.symbol].quote.lastPrice, 2);

    if (analysis.recommendation.toLowerCase() === 'none') {
      return order;
    } else if (this.hasReachedOrderLimit(order)) {
      order.stopped = true;
    } else if (order.type === OrderTypes.call) {
      if (order.side.toLowerCase() === 'buy' && (analysis.recommendation.toLowerCase() === 'buy')) {
        if (!order.priceLowerBound) {
          order.priceLowerBound = order.price;
          return order;
        }

        if (Number(order.price) > Number(order.priceLowerBound)) {
          order = await this.buyOptions(order);
        } else {
          const log = 'Price too low. Current:' + Number(order.price) + ' Expected:' + Number(order.priceLowerBound);
          this.reportingService.addAuditLog(order.holding.symbol, log);
        }
      } else if (order.side.toLowerCase() === 'sell' && (analysis.recommendation.toLowerCase() === 'sell')) {
        order = await this.sellOptions(order);
      }
    } else if (order.type === OrderTypes.put) {
      if (order.side.toLowerCase() === 'buy' && (analysis.recommendation.toLowerCase() === 'sell')) {
        if (!order.priceLowerBound) {
          order.priceLowerBound = order.price;
          return order;
        }

        if (Number(order.price) < Number(order.priceLowerBound)) {
          order = await this.buyOptions(order);
        } else {
          const log = 'Price too low. Current:' + Number(order.price) + ' Expected' + Number(order.priceLowerBound);
          this.reportingService.addAuditLog(order.holding.symbol, log);
        }
      } else if (order.side.toLowerCase() === 'sell' && (analysis.recommendation.toLowerCase() === 'buy')) {
        order = await this.sellOptions(order);
      }
    } else if (order.type === OrderTypes.strangle && order.side.toLowerCase() == 'sell') {
      await this.sellStrangle(order, analysis);
    } else if (order.side.toLowerCase() === 'buy' && analysis.recommendation.toLowerCase() === 'buy') {
      if (!order.priceLowerBound) {
        order.priceLowerBound = order.price;
        return order;
      }
      const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
      const currentBalance = balance.cashBalance;
      if (order.quantity * order.price > currentBalance) {
          const adjustedQty = Math.floor(currentBalance / order.price);
          order.quantity = adjustedQty;
          const log = `Not enough balance. Adjusted quantity to ${adjustedQty}`;
          this.reportingService.addAuditLog(order.holding.symbol, log);
      }
      if (order.quantity > 0) {
        const log = `${moment().format()} Received buy recommendation`;
        this.reportingService.addAuditLog(order.holding.symbol, log);

        if (Number(order.price) > Number(order.priceLowerBound)) {
          order = this.incrementBuy(order);
          this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
        } else {
          const log = 'Price too low. Current:' + Number(order.price) + ' Expected:' + Number(order.priceLowerBound);
          this.reportingService.addAuditLog(order.holding.symbol, log);
        }
      }
    } else if (order.side.toLowerCase() === 'sell' && (analysis.recommendation.toLowerCase() === 'sell')) {
      const sellLog = 'Received sell recommendation';
      this.reportingService.addAuditLog(order.holding.symbol, sellLog);
      if (order.side.toLowerCase() === 'sell') {
        this.sendSell(order, order.price)
      }
    }
    return order;
  }

  incrementSell(order: SmartOrder) {
    order.sellCount += order.quantity;
    order.positionCount -= order.quantity;

    this.cartService.updateOrder(order);
    return order;
  }

  incrementBuy(order: SmartOrder) {
    console.log('Sent buy order', order.holding.symbol, order);
    order.buyCount += order.quantity;
    order.positionCount += order.quantity;
    this.cartService.updateOrder(order);
    return order;
  }

  async sendSellStrangle(order: SmartOrder, calls: Options[], puts: Options[], callsTotalPrice, putsTotalPrice) {
    const callsStrArr = calls.map(c => c.symbol);
    const putsStrArr = puts.map(c => c.symbol);
    const hasPosition = await this.hasPositions(callsStrArr.concat(putsStrArr));
    if (hasPosition) {
      this.portfolioService.sendMultiOrderSell(calls,
        puts, callsTotalPrice + putsTotalPrice).subscribe();
      order = this.incrementSell(order);
    }
    return order;
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

  async intradayStep(order: SmartOrder) {
    if (!this.daytradeStrategiesService.shouldSkip(order.holding.symbol)) {
      const analysis = await this.backtestService.getDaytradeRecommendation(order.holding.symbol.toUpperCase(), null, null, { minQuotes: 81 }).toPromise();
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
        this.handleIntradayRecommendation(order, analysis);
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
  }

  async getEstimatedPrice(symbol: string) {
    try {
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const askPrice = Number(price[symbol].quote.askPrice);
      const bidPrice = Number(price[symbol].quote.bidPrice);
      console.log(`Getting estimated price for ${symbol}, bidPrice: ${bidPrice}, askPrice: ${askPrice}`)

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
