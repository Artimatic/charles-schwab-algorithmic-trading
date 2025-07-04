import { Injectable } from '@angular/core';
import { round } from 'lodash-es';
import { OptionsDataService } from '@shared/options-data.service';
import { BacktestService, CartService, PortfolioService, ReportingService } from '@shared/services';
import { Stock } from '@shared/stock.interface';
import { PotentialTrade } from './potential-trade.constant';
import * as moment from 'moment-timezone';
import { Strangle } from '@shared/models/options';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { Indicators } from '@shared/stock-backtest.interface';
import { MessageService } from 'primeng/api';
import { AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { StrategyStoreService } from './strategy-store.service';
import { AllocationService } from '../allocation/allocation.service';
import { LookBackStrategyService } from '../strategies/look-back-strategy.service';
import { ServiceStatus } from '@shared/models/service-status';

export interface ComplexStrategy {
  state: 'assembling' | 'assembled' | 'disassembling' | 'disassembled';
  trades: SmartOrder[];
  date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StrategyBuilderService {
  orderHistory = {};
  correlationThreshold = 0.55;
  sumNet = 0;
  countNet = 0;
  defaultMinExpiration = 90;
  defaultMaxImpliedMovement = 0.06;
  bullishStocks = [];
  constructor(private backtestService: BacktestService,
    private optionsDataService: OptionsDataService,
    private portfolioService: PortfolioService,
    private messageService: MessageService,
    private reportingService: ReportingService,
    private strategyStoreService: StrategyStoreService,
    private cartService: CartService,
    private allocationService: AllocationService,
    private lookBackStrategyService: LookBackStrategyService) { }

  addBullishStock(symbol: string) {
    this.bullishStocks.push(symbol);
  }
  getRecentBacktest(symbol: string = null, expiry = 1) {
    const backtestStorage = this.strategyStoreService.getStorage('backtest');
    if (!symbol) {
      return backtestStorage;
    }
    const backtestData = backtestStorage[symbol];
    if (backtestData && backtestData.backtestDate && moment().diff(moment(backtestData.backtestDate), 'days') < expiry) {
      return backtestData;
    }
    return null;
  }

  getBuySellSignals(lastSignal: Indicators) {
    const buySignals = [];
    const sellSignals = [];
    for (const indicator in lastSignal.recommendation) {
      if (lastSignal.recommendation.hasOwnProperty(indicator)) {
        if (lastSignal.recommendation[indicator] === 'Bullish') {
          buySignals.push(indicator);
        } else if (lastSignal.recommendation[indicator] === 'Bearish') {
          sellSignals.push(indicator);
        }
      }
    }
    return { buySignals, sellSignals };
  }

  mlError() {
    this.messageService.add({
      severity: 'danger',
      summary: 'Machine learning service is down.',
      sticky: true
    });
  }
  async getBacktestData(symbol: string, overwrite = false) {
    if (symbol === undefined) {
      return null;
    }
    const recentBacktest = this.getRecentBacktest(symbol);
    if (recentBacktest && !overwrite) {
      return Promise.resolve(recentBacktest);
    }
    const current = moment().format('YYYY-MM-DD');
    const start = moment().subtract(700, 'days').format('YYYY-MM-DD');
    try {
      const results = await this.backtestService.getBacktestData(symbol, start, current)
        .toPromise()
        .catch(() => {
          this.backtestService.pingArmidillo().subscribe(
            (data: ServiceStatus) => {
              if (!data || !data.status) {
                this.mlError();
              }
            },
            () => {
              this.mlError();
            });
        });
      // this.backtestAggregatorService.analyseBacktest(results);
      this.addToOrderHistoryStorage(symbol, results.orderHistory);
      const pop = this.allocationService.determineProbabilityOfProfit(results.buySignals.length,
        results.sellSignals.length,
        results.impliedMovement,
        results.ml);
      const kellyCriterion = this.allocationService.calculateKellyCriterion(pop, 1);
      const recommendation = results.recommendation === 'INDETERMINANT' ? await this.lookBackStrategyService.checkOrderHistory(symbol, results.orderHistory) : results.recommendation;
      const tableObj = {
        recommendation: recommendation,
        stock: results.symbol,
        net: results.net,
        returns: results.returns,
        total: results.total,
        invested: results.invested,
        averageMove: results.averageMove,
        profitableTrades: results.profitableTrades,
        totalTrades: results.totalTrades,
        ml: results.ml,
        mlScore: results.mlScore,
        sellMl: results.sellMl,
        sellMlScore: results.sellMlScore,
        impliedMovement: results.impliedMovement,
        buySignals: results.buySignals,
        sellSignals: results.sellSignals,
        backtestDate: results.backtestDate,
        pop: pop,
        kellyCriterion: kellyCriterion
      };

      this.addToResultStorage(tableObj);
      return results;
    } catch (error) {
      console.log(`Backtest table error ${symbol}`, new Date().toString(), error);
    }
    return null;
  }

  isWithinCallMovementRange(goal: number,
    strike: number,
    impliedMovement: number) {
    if (Number(strike) > goal) {
      const diff = ((Number(strike) - goal) / goal);
      if (diff > 0 && diff < impliedMovement + 0.01) {
        return true;
      }
    }

    return false;
  }

  isWithinPutMovementRange(goal: number, strike: number, impliedMovement: number) {
    if (Number(strike) < goal) {
      const diff = ((Number(strike) - goal) / goal);
      if (diff < 0 && diff > (impliedMovement * -1) - 0.01) {
        return true;
      }
    }

    return false;
  }

  isPutHedge(goal: number, strike: number, impliedMovement: number) {
    if (Number(strike) < goal) {
      const diff = ((Number(strike) - goal) / goal);
      if (impliedMovement && diff < (impliedMovement * -1)) {
        return true;
      }
    }

    return false;
  }

  isCallHedge(goal: number, strike: number, impliedMovement: number) {
    if (Number(strike) > goal) {
      const diff = ((Number(strike) - goal) / goal);
      if (impliedMovement && diff > impliedMovement) {
        return true;
      }
    }

    return false;
  }

  private passesVolumeCheck(openInterest, currTotalVolume, prevObj) {
    return ((!prevObj && (openInterest > 390 || currTotalVolume > 200)) || prevObj && (openInterest > prevObj.openInterest));
  }

  private passesPriceCheck(price) {
    price *= 100;
    return (price > 70 && price < 3700);
  }

  async getCallStrangleTrade(symbol: string): Promise<Strangle> {
    const optionsData = await this.optionsDataService.getImpliedMove(symbol).toPromise();
    if (!optionsData.move || optionsData.move > this.defaultMaxImpliedMovement) {
      this.reportingService.addAuditLog(null,
        `Implied movement is too high for ${symbol} at ${optionsData.move}. Max is ${this.defaultMaxImpliedMovement}`);
      this.addBullishStock(symbol);
      return { call: null, put: null };
    }
    const optionsChain = optionsData.optionsChain;
    const impliedMovement = optionsData.move;
    const goal = optionsChain?.underlyingPrice;
    let potentialStrangle = { call: null, put: null };
    let expiration = this.defaultMinExpiration;

    while (!potentialStrangle.call && !potentialStrangle.put && expiration < this.defaultMinExpiration * 6) {
      expiration++;
      let strategyList = optionsChain.monthlyStrategyList.find(element => element.daysToExp >= expiration);
      if (!strategyList || !strategyList.optionStrategyList) {
        console.log('Unable to find options chain for', optionsChain);
        this.reportingService.addAuditLog(null,
          'Unable to find options chain for ' + symbol);
        return;
      }
      potentialStrangle = strategyList.optionStrategyList.reduce((prev, curr) => {
        if (this.isWithinCallMovementRange(goal, curr.strategyStrike, impliedMovement)) {
          const currentCall = curr.secondaryLeg.putCallInd.toLowerCase() === 'c' ? curr.secondaryLeg : curr.primaryLeg;
          if (this.passesPriceCheck(currentCall.closePrice) && this.passesVolumeCheck(currentCall.openInterest, currentCall.totalVolume, prev.call)) {
            prev.call = JSON.parse(JSON.stringify(currentCall));
          }
        }

        if (this.isPutHedge(goal, curr.strategyStrike, impliedMovement)) {
          const currentPut = curr.primaryLeg.putCallInd.toLowerCase() === 'p' ? curr.primaryLeg : curr.secondaryLeg;
          if (this.passesPriceCheck(currentPut.closePrice) && this.passesVolumeCheck(currentPut.openInterest, currentPut.totalVolume, prev.call)) {
            prev.put = JSON.parse(JSON.stringify(currentPut));
          }
        }
        return prev;
      }, { call: null, put: null });
    }

    if (!potentialStrangle.call) {
      this.reportingService.addAuditLog(null,
        'Unable to find call for ' + symbol);
    }
    return potentialStrangle;
  }

  async getPutStrangleTrade(symbol: string) {
    const optionsData = await this.optionsDataService.getImpliedMove(symbol).toPromise();
    if (!optionsData.move || optionsData.move > this.defaultMaxImpliedMovement) {
      this.reportingService.addAuditLog(null,
        `Implied movement is too high for ${symbol} at ${optionsData.move}`);
      return { call: null, put: null };
    }
    const optionsChain = optionsData.optionsChain;
    const impliedMovement = optionsData.move;
    const goal = optionsChain?.underlyingPrice;

    let potentialStrangle = { call: null, put: null };
    let expiration = this.defaultMinExpiration;

    while (!potentialStrangle.call && !potentialStrangle.put && expiration < this.defaultMinExpiration * 6) {
      expiration++;
      if (optionsChain.monthlyStrategyList) {
        const strategyList = optionsChain.monthlyStrategyList.find(element => element.daysToExp >= expiration);
        if (!strategyList || !strategyList.optionStrategyList) {
          console.log('Unable to find options chain for', optionsChain);
          this.reportingService.addAuditLog(null,
            'Unable to find options chain for ' + symbol);
          return;
        }
        potentialStrangle = strategyList.optionStrategyList.reduce((prev, curr) => {
          if (this.isCallHedge(goal, curr.strategyStrike, impliedMovement)) {
            const currentCall = curr.primaryLeg.putCallInd.toLowerCase() === 'c' ? curr.primaryLeg : (curr.secondaryLeg.putCallInd.toLowerCase() === 'p' ? curr.secondaryLeg : null);
            if (this.passesPriceCheck(currentCall.closePrice) && this.passesVolumeCheck(currentCall.openInterest, currentCall.totalVolume, prev.call)) {
              prev.call = JSON.parse(JSON.stringify(currentCall));
            }
          }
          if (this.isWithinPutMovementRange(goal, curr.strategyStrike, impliedMovement)) {
            const currentPut = curr.primaryLeg.putCallInd.toLowerCase() === 'p' ? curr.primaryLeg : (curr.secondaryLeg.putCallInd.toLowerCase() === 'p' ? curr.secondaryLeg : null);
            if (this.passesPriceCheck(currentPut.closePrice) && this.passesVolumeCheck(currentPut.openInterest, currentPut.totalVolume, prev.call)) {
              prev.put = JSON.parse(JSON.stringify(currentPut));
            }
          }
          return prev;
        }, { call: null, put: null });
      }
    }
    if (!potentialStrangle.put) {
      this.reportingService.addAuditLog(null,
        'Unable to find put for ' + symbol);
    }
    return potentialStrangle;
  }

  findOptionsPrice(bid: number, ask: number): number {
    const optionsPrice = Number(((bid + ask) / 2).toFixed(1) + '0');
    return optionsPrice ? optionsPrice : bid;
  }

  addToResultStorage(result: Stock) {
    if (result.recommendation.toUpperCase() !== 'INDETERMINANT' || (result.net > 1 && result.returns > 0 && result.buySignals.length + result.sellSignals.length > 1)) {
      this.addToStorage('backtest', result.stock, result);
    } else {
      this.addToStorage('backtest', result.stock, {
        backtestDate: moment().format(),
        ml: result.ml,
        averageMove: result.averageMove,
        net: result.net,
        invested: result.invested,
        sellMl: result.sellMl,
        sellSignals: result.sellSignals,
        buySignals: result.buySignals,
        recommendation: result.recommendation,
        stock: result.stock,
        returns: result.returns,
        impliedMovement: result.impliedMovement,
        pop: result.pop,
        kellyCriterion: result.kellyCriterion
      });
    }
  }

  addToOrderHistoryStorage(symbol: string, tradingHistory: any[]) {
    this.orderHistory[symbol] = tradingHistory;
  }

  addPair(symbol: string, newPairValue: any) {
    const storage = JSON.parse(localStorage.getItem('tradingPairs'));
    if (newPairValue) {
      if (storage) {
        if (!Array.isArray(storage[symbol])) {
          storage[symbol] = [];
        }
        const findIdx = storage[symbol].findIndex(pairVal => pairVal ? pairVal.symbol === newPairValue.symbol : false);
        if (findIdx > -1) {
          storage[symbol][findIdx] = newPairValue;
        } else {
          storage[symbol].push(newPairValue)
        }
        localStorage.setItem('tradingPairs', JSON.stringify(storage));
      } else {
        const newStorageObj = {};
        newStorageObj[symbol] = [newPairValue];
        localStorage.setItem('tradingPairs', JSON.stringify(newStorageObj));
      }
    }
  }

  addToStorage(storageName: string, key: string, value: any) {
    const storage = JSON.parse(localStorage.getItem(storageName));
    if (storage) {
      storage[key] = value;
      localStorage.setItem(storageName, JSON.stringify(storage));
    } else {
      const newStorageObj = {};
      newStorageObj[key] = value;
      localStorage.setItem(storageName, JSON.stringify(newStorageObj));
    }
  }

  addToBlackList(ticker: string) {
    const backtestBlacklist = JSON.parse(localStorage.getItem('blacklist'));
    if (backtestBlacklist) {
      if (!backtestBlacklist[ticker]) {
        backtestBlacklist[ticker] = true;
        localStorage.setItem('blacklist', JSON.stringify(backtestBlacklist));
      }
    } else {
      const newStorageObj = {};
      newStorageObj[ticker] = true;
      localStorage.setItem('blacklist', JSON.stringify(newStorageObj));
    }
  }

  addToNewStocks(ticker: string) {
    const newStocks = JSON.parse(localStorage.getItem('newStockList'));
    if (newStocks) {
      if (!newStocks[ticker]) {
        newStocks[ticker] = true;
        localStorage.setItem('newStockList', JSON.stringify(newStocks));
      }
    } else {
      const newStorageObj = {};
      newStorageObj[ticker] = true;
      localStorage.setItem('newStockList', JSON.stringify(newStorageObj));
    }
  }

  findPair(symbol: string) {
    const orderHistory = this.orderHistory[symbol];
    if (orderHistory) {
      for (const h in this.orderHistory) {
        if (h !== symbol) {
          const targetHistory = this.orderHistory[h];
          this.getCorrelationAndAdd(symbol, orderHistory, h, targetHistory);
        }
      }
    }
  }

  getCorrelationAndAdd(symbol: string, orderHistory: any[], targetSymbol: string, targetHistory: any[]) {
    const corr = this.getPairCorrelation(orderHistory, targetHistory);
    if (corr && corr > this.correlationThreshold) {
      this.addPair(symbol, { symbol: targetSymbol, correlation: corr });
    }
  }

  getPairCorrelation(orderHistory, targetHistory): number {
    if (!orderHistory || !targetHistory) {
      return null;
    }
    let primaryHistoryCounter = orderHistory.length - 1;
    let targetHistoryCounter = targetHistory.length - 1;
    let correlatingOrderCounter = 0;
    while (primaryHistoryCounter > 0 && targetHistoryCounter > 0) {
      const primaryDate = orderHistory[primaryHistoryCounter].date;
      const targetDate = targetHistory[targetHistoryCounter].date;
      if (Math.abs(moment(primaryDate).diff(moment(targetDate), 'day')) < 9) {
        correlatingOrderCounter++;
        primaryHistoryCounter--;
        targetHistoryCounter--;
      } else if (moment(primaryDate).diff(moment(targetDate), 'day') > 0) {
        primaryHistoryCounter--;
      } else {
        targetHistoryCounter--;
      }
    }
    return Number((correlatingOrderCounter / ((orderHistory.length + targetHistory.length) / 2)).toFixed(2));
  }

  sanitizeData() {
    const backtestData = this.strategyStoreService.getStorage('backtest');
    const newBacktestData = {};
    for (const b in backtestData) {
      if (!backtestData[b].ml || !backtestData[b].recommendation || !backtestData[b].backtestDate || moment().diff(moment(backtestData[b].backtestDate), 'days') < 4) {
        newBacktestData[b] = backtestData[b];
        this.findPair(backtestData[b].stock);
      }
    }
    localStorage.setItem('backtest', JSON.stringify(newBacktestData));
    return newBacktestData;
  }

  createStrategy(tradeName: string, key: string, buyList: string[], sellList: string[], reason) {
    const trade = {
      name: tradeName,
      date: moment().format(),
      type: 'pairTrade',
      key: key,
      strategy: {
        buy: buyList,
        sell: sellList
      },
      reason: reason
    };
    this.portfolioService.addStrategy(trade.date, trade.type, trade.key, trade.strategy, trade.reason).subscribe();
    this.addTradingStrategy(trade);
  }

  findTrades() {
    const backtests = this.sanitizeData();
    const tradingPairs = JSON.parse(localStorage.getItem('tradingPairs'));
    for (const key in tradingPairs) {
      const pairs = tradingPairs[key];
      const bObj = backtests[key];
      if (bObj !== undefined && bObj !== null && bObj.ml !== null && bObj.buySignals) {
        if (bObj.ml > 0.4 && bObj.recommendation.toLowerCase() === 'strongbuy') {
          for (const pairVal of pairs) {
            if (pairVal !== null && backtests[pairVal.symbol] && backtests[pairVal.symbol].ml !== null) {
              if (backtests[pairVal.symbol]?.sellMl > 0.4 && (backtests[pairVal.symbol].recommendation.toLowerCase() === 'strongsell')) {
                this.createStrategy(`${bObj.stock} Pair trade`, bObj.stock, [bObj.stock], [pairVal.symbol], 'Correlated pairs');
              }
            }
          }
        }

      }
    }
  }

  getTradingStrategies() {
    return JSON.parse(localStorage.getItem('tradingStrategy')) || [];
  }

  setTradingStrategies(strats: PotentialTrade[]) {
    localStorage.setItem('tradingStrategy', JSON.stringify(strats));
  }

  addAndRemoveOldStrategies(storage) {
    storage = storage.filter(s => moment().diff(moment(s.date), 'days') < 10);
    this.setTradingStrategies(storage);
  }

  addTradingStrategy(trade: PotentialTrade) {
    let storage = this.getTradingStrategies();
    if (trade) {
      if (storage && Array.isArray(storage)) {
        const findIdx = storage.findIndex(str => str.key === trade.key && str.type === trade.type);
        if (findIdx > -1) {
          const buys = storage[findIdx].strategy.buy.reduce((acc, curr) => {
            if (!acc.buy.find(a => a === curr)) {
              acc.buy.push(curr);
            }
            return acc;
          }, { buy: trade.strategy.buy }).buy;

          const sells = storage[findIdx].strategy.sell.reduce((acc, curr) => {
            if (!acc.sell.find(a => a === curr)) {
              acc.sell.push(curr);
            }
            return acc;
          }, { sell: trade.strategy.sell }).sell;

          storage[findIdx].strategy.buy = buys;
          storage[findIdx].strategy.sell = sells;
        } else {
          storage.push(trade)
        }

        storage = storage.filter(s => moment().diff(moment(s.date), 'days') < 5);
        this.addAndRemoveOldStrategies(storage);
      } else {
        const newStorageObj = [trade];
        this.setTradingStrategies(newStorageObj);
      }
    }
  }

  removeTradingStrategy(removeTrade: PotentialTrade) {
    const storage = this.getTradingStrategies();

    if (storage && Array.isArray(storage)) {
      const newStorage = storage.filter(s => s.key !== removeTrade.key || s.name !== removeTrade.name || s.date !== removeTrade.date);
      localStorage.setItem('tradingStrategy', JSON.stringify(newStorage));
    }
  }

  async addStrangleOrder(symbol: string, price: number, optionStrategy: Strangle) {
    if (symbol === 'TQQQ') {
      return null;
    }
    if (price < 1) {
      this.messageService.add({
        severity: 'danger',
        summary: `Price is too low for ${optionStrategy.call.symbol}/${optionStrategy.put.symbol} strangle`
      });
      return null;
    }

    const cash = await this.cartService.getAvailableFunds(true);
    const proposedQuantity = Math.floor((cash * 0.1) / (price * 100));
    const quantity = proposedQuantity > 10 ? 10 : proposedQuantity;
    return {
      holding: {
        instrument: null,
        symbol: symbol.toUpperCase().match(/[A-Za-z]{1,6}/)[0],
      },
      quantity: quantity,
      price,
      submitted: false,
      pending: false,
      orderSize: 1,
      side: 'Buy',
      lossThreshold: -0.05,
      profitTarget: 0.1,
      trailingStop: -0.05,
      useStopLoss: true,
      useTrailingStopLoss: true,
      useTakeProfit: true,
      sellAtClose: false,
      allocation: 0.05,
      primaryLeg: optionStrategy.call,
      secondaryLeg: optionStrategy.put,
      type: OrderTypes.strangle
    };

  }

  async addStrangle(symbol: string, price: number, optionStrategy: Strangle) {
    const order = await this.addStrangleOrder(symbol, price, optionStrategy);
    this.cartService.addToCart(order);
  }


  async addProtectivePut(symbol: string, price: number, quantity, optionStrategy: Strangle) {
    if (symbol === 'TQQQ') {
      return null;
    }

    const order = {
      holding: {
        instrument: null,
        symbol: symbol.toUpperCase().match(/[A-Za-z]{1,6}/)[0],
      },
      quantity: quantity,
      price,
      submitted: false,
      pending: false,
      orderSize: 1,
      side: 'Buy',
      lossThreshold: -0.05,
      profitTarget: 0.1,
      trailingStop: -0.05,
      useStopLoss: true,
      useTrailingStopLoss: true,
      useTakeProfit: true,
      sellAtClose: false,
      allocation: 0.05,
      primaryLeg: optionStrategy.put,
      type: OrderTypes.strangle
    };

    this.cartService.addToCart(order);
  }

  async buyProtectivePut(symbol, quantity) {
    const putOption = await this.getCallStrangleTrade(symbol);
    const price = this.findOptionsPrice(putOption.put.bid, putOption.put.ask);
    const orderQuantity = quantity;

    this.portfolioService.sendOptionBuy(putOption.put.symbol, orderQuantity, price, false).subscribe();
  }

  getAlwaysBuyList() {
    const alwaysBuyStorage = this.strategyStoreService.getStorage('always_buy');
    if (alwaysBuyStorage && alwaysBuyStorage.length) {
      return AlwaysBuy.concat(alwaysBuyStorage);
    }
    return AlwaysBuy;
  }

  getComplexStrategy() {
    const storage = this.strategyStoreService.getStorage('complex_strategy');
    if (storage && storage.length) {
      return storage;
    }
    return [];
  }

  addComplexStrategy(strategy: ComplexStrategy) {
    const list: ComplexStrategy[] = this.getComplexStrategy();
    if (list && list.length) {
      list.push(strategy);
      localStorage.setItem('complex_strategy', JSON.stringify(list));
    } else {
      localStorage.setItem('complex_strategy', JSON.stringify([strategy]));
    }
  }

  setComplexStrategy(strategies: ComplexStrategy[]) {
    localStorage.setItem('complex_strategy', JSON.stringify(strategies));
  }

  addToBuyList(ticker: string) {
    const list = this.getAlwaysBuyList();
    if (list && list.length) {
      if (!list.find(val => val.ticker === ticker)) {
        list.push({
          ticker, start: null,
          end: null
        });
        localStorage.setItem('always_buy', JSON.stringify(list));
      }
    } else {
      localStorage.setItem('always_buy', JSON.stringify([{
        ticker, start: null,
        end: null
      }]));
    }
  }

  removeFromBuyList(ticker: string) {
    const list = this.getAlwaysBuyList();
    if (list && list.length) {
      localStorage.setItem('always_buy', JSON.stringify(list.filter(val => val.ticker !== ticker)));
    } else {
      localStorage.setItem('always_buy', JSON.stringify([]));
    }
  }

  getQuantity(stockPrice: number, allocationPct: number, cash: number) {
    const totalCost = round(cash * allocationPct, 2);
    if (!totalCost) {
      return 0;
    }
    return Math.floor(totalCost / stockPrice) | 1;
  }

  async buySnP(balance: number, totalBalance: number) {
    const bullishStrangle = await this.getCallStrangleTrade('SPY');
    const callPrice = this.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;
    const quantity = Math.floor(balance / callPrice) > 0 ? Math.floor(balance / callPrice) : (Math.floor(totalBalance / callPrice) >= 1 ? 1 : 0);
    if (quantity) {
      let currentCall = {
        call: bullishStrangle.call,
        price: callPrice,
        quantity: quantity,
        underlying: 'SPY'
      };
      const order = this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call],
        currentCall.price, currentCall.quantity,
        OrderTypes.call, 'Buy SnP strategy', 'Buy', currentCall.quantity);
      this.cartService.addToCart(order, true, 'Buy SPY');
    }
  }

  increaseStrategyRisk() {
    if (this.defaultMinExpiration > 20) {
      this.defaultMinExpiration -= 6;
    }

    if (this.defaultMaxImpliedMovement < 0.18) {
      this.defaultMaxImpliedMovement += 0.005;
    }
  }

  setStrategyRisk(riskLevel: number, maxRisk: number) {
    const riskPct = round(riskLevel / maxRisk, 1);
    console.log('Risk percent', riskPct);
    switch (riskPct) {
      case 0.1:
        this.defaultMinExpiration = 100;
        this.defaultMaxImpliedMovement = 0.065;
        break;
      case 0.2:
        this.defaultMinExpiration = 90;
        this.defaultMaxImpliedMovement = 0.075;
        break;
      case 0.3:
        this.defaultMinExpiration = 85;
        this.defaultMaxImpliedMovement = 0.085;
        break;
      case 0.4:
        this.defaultMinExpiration = 80;
        this.defaultMaxImpliedMovement = 0.095;
        break;
      case 0.5:
        this.defaultMinExpiration = 75;
        this.defaultMaxImpliedMovement = 0.105;
        break;
      case 0.6:
        this.defaultMinExpiration = 65;
        this.defaultMaxImpliedMovement = 0.115;
        break;
      case 0.7:
        this.defaultMinExpiration = 55;
        this.defaultMaxImpliedMovement = 0.135;
        break;
      case 0.8:
        this.defaultMinExpiration = 50;
        this.defaultMaxImpliedMovement = 0.145;
        break;
      case 0.9:
        this.defaultMinExpiration = 45;
        this.defaultMaxImpliedMovement = 0.155;
        break;
      case 1:
        this.defaultMinExpiration = 30;
        this.defaultMaxImpliedMovement = 0.155;
        break;
      default:
        this.defaultMinExpiration = 90;
        this.defaultMaxImpliedMovement = 0.07;
        break;
    }
  }

  resetStrategyRisk() {
    this.defaultMinExpiration = 90;
    this.defaultMaxImpliedMovement = 0.07;
  }
}
