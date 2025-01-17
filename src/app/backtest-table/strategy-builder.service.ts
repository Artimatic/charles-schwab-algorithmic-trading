import { Injectable } from '@angular/core';
import { round } from 'lodash';
import { OptionsDataService } from '@shared/options-data.service';
import { AiPicksService, BacktestService, CartService, PortfolioService } from '@shared/services';
import { Stock } from '@shared/stock.interface';
import { PotentialTrade } from './potential-trade.constant';
import * as moment from 'moment-timezone';
import { Strangle } from '@shared/models/options';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { SwingtradeStrategiesService } from '../strategies/swingtrade-strategies.service';
import { Indicators } from '@shared/stock-backtest.interface';
import { MessageService } from 'primeng/api';
import { AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { SchedulerService } from '@shared/service/scheduler.service';
import { BacktestAggregatorService } from './backtest-aggregator.service';

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
  defaultMinExpiration = 50;

  constructor(private backtestService: BacktestService,
    private aiPicksService: AiPicksService,
    private optionsDataService: OptionsDataService,
    private portfolioService: PortfolioService,
    private messageService: MessageService,
    private swingtradeStrategiesService: SwingtradeStrategiesService,
    private schedulerService: SchedulerService,
    private cartService: CartService,
    private backtestAggregatorService: BacktestAggregatorService) { }

  getRecentBacktest(symbol: string = null, expiry = 1) {
    const backtestStorage = this.getStorage('backtest');
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
  
  async getBacktestData(symbol: string, overwrite = false) {
    const recentBacktest = this.getRecentBacktest(symbol);
    if (recentBacktest && !overwrite) {
      return Promise.resolve(recentBacktest);
    }
    const current = moment().format('YYYY-MM-DD');
    const start = moment().subtract(200, 'days').format('YYYY-MM-DD');

    try {
      const results = await this.backtestService.getBacktestEvaluation(symbol, start, current, 'daily-indicators').toPromise();
      this.backtestAggregatorService.analyseBacktest(results);
      const indicatorResults = this.swingtradeStrategiesService.processSignals(results);
      this.addToOrderHistoryStorage(symbol, indicatorResults.orderHistory);
      indicatorResults.stock = symbol;
      if (!indicatorResults.signals || !indicatorResults.signals.length) {
        return null;
      }
      let counter = indicatorResults.signals.length - 1;
      let { buySignals, sellSignals } = this.getBuySellSignals(indicatorResults.signals[counter]);

      while (counter > indicatorResults.signals.length - 6) {
        const currentSignalRecommendations = this.getBuySellSignals(indicatorResults.signals[counter]);
        buySignals = buySignals.concat(currentSignalRecommendations.buySignals.filter(indicator => !buySignals.find(sig => sig === indicator)));
        sellSignals = sellSignals.concat(currentSignalRecommendations.sellSignals.filter(indicator => !sellSignals.find(sig => sig === indicator)));
        counter--;
      }

      this.sumNet += indicatorResults.net;
      this.countNet++;
      const averageNet = (this.sumNet / this.countNet);
      const optionsData = await this.optionsDataService.getImpliedMove(symbol).toPromise();
      let optionsVolume = null;
      let optionsChain = [];
      if (optionsData.optionsChain.monthlyStrategyList) {
        optionsChain = optionsData.optionsChain.monthlyStrategyList;
        const callsCount = optionsData.optionsChain.monthlyStrategyList[0].optionStrategyList[0].secondaryLeg.totalVolume;
        const putsCount = optionsData.optionsChain.monthlyStrategyList[0].optionStrategyList[0].primaryLeg.totalVolume;
        optionsVolume = Number(callsCount) + Number(putsCount);
      }
      const instruments = await this.portfolioService.getInstrument(symbol).toPromise();

      let latestMlResult = null;
      try {
        latestMlResult = await this.aiPicksService.trainAndActivate(symbol);
      } catch (error) {
        console.log('Error training', error);
        latestMlResult = await this.aiPicksService.trainAndActivate(symbol);
      }
      this.aiPicksService.mlNeutralResults.next(latestMlResult);
      const tableObj = {
        recommendation: indicatorResults.recommendation,
        stock: indicatorResults.stock,
        net: indicatorResults.net,
        averageNet: averageNet,
        returns: indicatorResults.returns,
        total: indicatorResults.total,
        invested: indicatorResults.invested,
        averageMove: indicatorResults.averageMove,
        profitableTrades: indicatorResults.profitableTrades,
        totalTrades: indicatorResults.totalTrades,
        ml: latestMlResult ? latestMlResult.value : null,
        impliedMovement: optionsData.move,
        optionsVolume: optionsVolume,
        marketCap: instruments[symbol] ? instruments[symbol]?.fundamental.marketCap : instruments[0]?.fundamental.marketCap,
        buySignals: buySignals,
        sellSignals: sellSignals,
        high52: instruments[symbol] ? instruments[symbol]?.fundamental.high52 : instruments[0]?.fundamental.high52,
        backtestDate: moment().format()
      };

      this.addToResultStorage(tableObj);
      return tableObj;
    } catch (error) {
      console.log(`Backtest table error ${symbol}`, new Date().toString(), error);
      const lastBacktest = this.getRecentBacktest(symbol, 30); 
      if (lastBacktest && lastBacktest.net && lastBacktest.net > 10) {
        this.schedulerService.schedule(() => this.getBacktestData(symbol), 'Rebacktest');
      }
    }
    return null;
  }

  isPutHedge(goal: number, strike: number, impliedMovement: number) {
    if (strike < goal) {
      const diff = ((goal - strike) / goal);
      if (impliedMovement && diff < (impliedMovement * -1)) {
        return true;
      }
    }

    return false;
  }

  isCallHedge(goal: number, strike: number, impliedMovement: number) {
    if (strike > goal) {
      const diff = ((strike - goal) / goal);
      if (impliedMovement && diff > impliedMovement) {
        return true;
      }
    }

    return false;
  }

  passesVolumeCheck(openInterest, currTotalVolume, prevObj) {
    return (!prevObj || (currTotalVolume > prevObj.totalVolume)) && (currTotalVolume > 180 || openInterest > 500);
  }

  async getCallStrangleTrade(symbol: string, minExpiration = this.defaultMinExpiration): Promise<Strangle> {
    const optionsData = await this.optionsDataService.getImpliedMove(symbol).toPromise();
    const optionsChain = optionsData.optionsChain;
    const impliedMovement = optionsData.move;
    const goal = optionsChain?.underlyingPrice;
    let potentialStrangle = { call: null, put: null };
    let expiration = minExpiration;

    while (!potentialStrangle.call && !potentialStrangle.put && expiration < minExpiration * 6) {
      expiration++;
      let strategyList = optionsChain.monthlyStrategyList.find(element => element.daysToExp >= expiration);
      if (!strategyList) {
        console.log('Unable to find options chain for', optionsChain);
      }
      potentialStrangle = strategyList.optionStrategyList.reduce((prev, curr) => {
        if ((!prev.call || (Math.abs(Number(curr.strategyStrike) - goal) < Math.abs(Number(prev.call.strikePrice) - goal)))) {
          if (curr.secondaryLeg.putCallInd.toLowerCase() === 'c' && this.passesVolumeCheck(curr.secondaryLeg.openInterest, curr.secondaryLeg.totalVolume, prev.call)) {
            prev.call = JSON.parse(JSON.stringify(curr.secondaryLeg));
          } else if (curr.primaryLeg.putCallInd.toLowerCase() === 'c' && this.passesVolumeCheck(curr.primaryLeg.openInterest, curr.primaryLeg.totalVolume, prev.call)) {
            prev.call = JSON.parse(JSON.stringify(curr.primaryLeg));
          }
        }

        if ((!prev.put && curr.strategyStrike < goal) ||
          (this.isPutHedge(goal, curr.strategyStrike, impliedMovement))) {
          if (curr.primaryLeg.putCallInd.toLowerCase() === 'p' && this.passesVolumeCheck(curr.primaryLeg.openInterest, curr.primaryLeg.totalVolume, prev.put)) {
            prev.put = JSON.parse(JSON.stringify(curr.primaryLeg));
          } else if (curr.secondaryLeg.putCallInd.toLowerCase() === 'p' && this.passesVolumeCheck(curr.secondaryLeg.openInterest, curr.secondaryLeg.totalVolume, prev.put)) {
            prev.put = JSON.parse(JSON.stringify(curr.secondaryLeg));
          }
        }
        return prev;
      }, { call: null, put: null });
    }

    if (!potentialStrangle.call) {
      console.log('Unable to find call for', symbol, optionsData);
    }
    return potentialStrangle;
  }

  async getPutStrangleTrade(symbol: string, minExpiration = this.defaultMinExpiration) {
    const optionsData = await this.optionsDataService.getImpliedMove(symbol).toPromise();
    const optionsChain = optionsData.optionsChain;
    const impliedMovement = optionsData.move;
    const goal = optionsChain?.underlyingPrice;

    let potentialStrangle = { call: null, put: null };
    let expiration = minExpiration;
    
    while (!potentialStrangle.call && !potentialStrangle.put && expiration < minExpiration * 6) {
      expiration++;
      if (optionsChain.monthlyStrategyList) {
        const strategyList = optionsChain.monthlyStrategyList.find(element => element.daysToExp >= expiration);
        if (!strategyList) {
          console.log('Options list not found', symbol, optionsChain);
        }
        potentialStrangle = strategyList.optionStrategyList.reduce((prev, curr) => {
          if ((!prev.call && curr.strategyStrike > goal) ||
            (this.isCallHedge(goal, curr.strategyStrike, impliedMovement))) {
            if (curr.secondaryLeg.putCallInd.toLowerCase() === 'c' && this.passesVolumeCheck(curr.secondaryLeg.openInterest, curr.secondaryLeg.totalVolume, prev.call)) {
              prev.call = JSON.parse(JSON.stringify(curr.secondaryLeg));
            } else if (curr.primaryLeg.putCallInd.toLowerCase() === 'c' && this.passesVolumeCheck(curr.primaryLeg.openInterest, curr.primaryLeg.totalVolume, prev.call)) {
              prev.call = JSON.parse(JSON.stringify(curr.primaryLeg));
            }
          }
          if (!prev.put || (Math.abs(curr.strategyStrike - goal) < Math.abs(Number(prev.put.strikePrice) - goal))) {
            if (curr.primaryLeg.putCallInd.toLowerCase() === 'p' && this.passesVolumeCheck(curr.primaryLeg.openInterest, curr.primaryLeg.totalVolume, prev.put)) {
              prev.put = JSON.parse(JSON.stringify(curr.primaryLeg));
            } else if (curr.secondaryLeg.putCallInd.toLowerCase() === 'p' && this.passesVolumeCheck(curr.secondaryLeg.openInterest, curr.secondaryLeg.totalVolume, prev.put)) {
              prev.put = JSON.parse(JSON.stringify(curr.secondaryLeg));
            }
          }
          return prev;
        }, { call: null, put: null });
      }
    }
    if (!potentialStrangle.put) {
      console.log('Unable to find put for', symbol, potentialStrangle, optionsData);
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
        recommendation: result.recommendation,
        stock: result.stock,
        returns: result.returns,
        impliedMovement: result.impliedMovement
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

  getStorage(storageName: string) {
    const storage = JSON.parse(localStorage.getItem(storageName));
    return storage ? storage : {};
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
    const backtestData = this.getStorage('backtest');
    const newBacktestData = {};
    for (const b in backtestData) {
      if (!backtestData[b].backtestDate || moment().diff(moment(backtestData[b].backtestDate), 'days') < 4) {
        newBacktestData[b] = backtestData[b];
        this.findPair(backtestData[b].stock);
      }
    }
    localStorage.setItem('backtest', JSON.stringify(newBacktestData));
    return newBacktestData;
  }

  createStrategy(tradeName: string, key: string, buyList: string[], sellList: string[], reason = 'pair') {
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
    this.addTradingStrategy(trade);
  }

  findTrades() {
    const backtests = this.sanitizeData();
    const tradingPairs = JSON.parse(localStorage.getItem('tradingPairs'));
    for (const key in tradingPairs) {
      const pairs = tradingPairs[key];
      const bObj = backtests[key];
      if (bObj !== undefined && bObj !== null && bObj.ml !== null && bObj.buySignals) {
        if (bObj.buySignals.length > bObj.sellSignals.length || bObj.recommendation.toLowerCase() === 'strongbuy') {
          if (bObj.ml > 0.5) {
            for (const pairVal of pairs) {
              if (pairVal !== null && backtests[pairVal.symbol] && backtests[pairVal.symbol].ml !== null && (!backtests[pairVal.symbol].optionsChainLength || backtests[pairVal.symbol].optionsChainLength > 10)) {
                if (backtests[pairVal.symbol].ml < 0.5 && (backtests[pairVal.symbol].recommendation.toLowerCase() === 'strongsell')) {
                  this.createStrategy(`${bObj.stock} Pair trade`, bObj.stock, [bObj.stock], [pairVal.symbol]);
                }
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

        storage = storage.filter(s => moment().diff(moment(s.date), 'days') < 9);
        this.setTradingStrategies(storage);
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
    const putOption = await this.getCallStrangleTrade(symbol, 65);
    const price = this.findOptionsPrice(putOption.put.bid, putOption.put.ask);
    const orderQuantity = quantity;

    this.portfolioService.sendOptionBuy(putOption.put.symbol, orderQuantity, price, false).subscribe();
  }

  getBuyList() {
    const alwaysBuyStorage = this.getStorage('always_buy');
    if (alwaysBuyStorage && alwaysBuyStorage.length) {
      return AlwaysBuy.concat(alwaysBuyStorage);
    }
    return AlwaysBuy;
  }

  getComplexStrategy() {
    const storage = this.getStorage('complex_strategy');
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
    const list = this.getBuyList();
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
    const list = this.getBuyList();
    if (list && list.length) {
      localStorage.setItem('always_buy', JSON.stringify(list.filter(val => val.ticker !== ticker)));
    } else {
      localStorage.setItem('always_buy', JSON.stringify([]));
    }
  }

  getQuantity(stockPrice: number, allocationPct: number, total: number) {
    const totalCost = round(total * allocationPct, 2);
    if (!totalCost) {
      return 0;
    }
    return Math.floor(totalCost / stockPrice);
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
}
