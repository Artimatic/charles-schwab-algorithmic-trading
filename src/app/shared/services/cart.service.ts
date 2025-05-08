import { Injectable } from '@angular/core';
import { PortfolioInfoHolding, PortfolioService } from './portfolio.service';
import { OrderTypes, SmartOrder } from '../models/smart-order';
import { TradeService, AlgoQueueItem } from './trade.service';
import { round } from 'lodash-es';
import { MessageService } from 'primeng/api';
import * as moment from 'moment-timezone';
import { Options } from '@shared/models/options';
import { ReportingService } from './reporting.service';

@Injectable()
export class CartService {
  sellOrders: SmartOrder[] = [];
  buyOrders: SmartOrder[] = [];
  otherOrders: SmartOrder[] = [];
  maxTradeCount = 5;
  constructor(
    private portfolioService: PortfolioService,
    private tradeService: TradeService,
    private reportingService: ReportingService,
    private messageService: MessageService) { }

  private removeDuplicates(arr: SmartOrder[]): SmartOrder[] {
    const seen = new Map();
    for (const item of arr) {
      if (!seen.has(item.holding.name)) {
        seen.set(item.holding.name, item);
      }
    }
    return Array.from(seen.values());
  }

  getBuyOrders() {
    return this.buyOrders;
  }

  getSellOrders() {
    return this.sellOrders;
  }

  getOtherOrders() {
    return this.otherOrders;
  }

  getMaxTradeCount() {
    return this.maxTradeCount;
  }

  createOrderLog(order: SmartOrder, reason: string) {
    let log = `Adding order ${order.side} ${order.quantity} ${order.holding.symbol}. Reason: ${order?.reason ? order?.reason : reason}`;
    if (order.primaryLeg) {
      log += `Primary leg: ${order.side} ${order.primaryLeg.quantity} ${order.primaryLeg.symbol} `;
    }
    if (order.secondaryLeg) {
      log += `Secondary leg: ${order.side} ${order.secondaryLeg.quantity} ${order.secondaryLeg.symbol} `;
    }
    if (order.primaryLegs) {
      order.primaryLegs.forEach(leg => {
        log += ` Primary legs ${order.side} ${leg.quantity} ${leg.symbol} `;
      });
    }
    if (order.secondaryLegs) {
      order.secondaryLegs.forEach(leg => {
        log += ` Secondary legs ${order.side} ${leg.quantity} ${leg.symbol} `;
      });
    }
    return log;
  }

  addToCart(order: SmartOrder, replaceAnyExistingOrders = false, reason = '') {
    order.createdTime = moment().format();
    order.id = `${order.holding.symbol}-${order.side}-${order.createdTime}`;
    const indices = this.searchAllLists(order);
    let noDup = true;
    for (const idx of indices) {
      if (idx > -1) {
        noDup = false;
        break;
      }
    }

    const log = this.createOrderLog(order, reason);
    this.reportingService.addAuditLog(order.holding.symbol, log, reason);

    if (!noDup && replaceAnyExistingOrders && order.quantity) {
      if (indices[0] > -1) {
        this.deleteBuy(this.buildOrder(order.holding.symbol, null, null, 'buy'));
      } else if (indices[1] > -1) {
        this.deleteSell(this.buildOrder(order.holding.symbol, null, null, 'sell'));
      } else if (indices[2] > -1) {
        this.deleteDaytrade(this.buildOrder(order.holding.symbol, null, null, 'daytrade'));
      }
      console.log('Add order', order);
      this.addOrder(order);
    }

    if (noDup && order.quantity > 0) {
      if (order.side.toLowerCase() === 'sell') {
        this.sellOrders.push(order);
      } else if (order.side.toLowerCase() === 'buy') {
        this.buyOrders.push(order);
      } else {
        this.otherOrders.push(order);
      }
      this.messageService.add({
        severity: 'success',
        summary: `Added ${order.side} ${order.holding.symbol}`
      });
    }
  }

  deleteSell(deleteOrder: SmartOrder) {
    console.log('Deleting sell orders that match', deleteOrder.holding.symbol);
    this.sellOrders = this.sellOrders.filter(fullOrder => deleteOrder.primaryLegs && fullOrder.primaryLegs ? deleteOrder.primaryLegs[0].symbol !== fullOrder.primaryLegs[0].symbol : deleteOrder.holding.symbol !== fullOrder.holding.symbol);
  }

  deleteBuy(deleteOrder: SmartOrder) {
    console.log('Deleting buy orders that match', deleteOrder.holding.symbol);
    this.buyOrders = this.buyOrders.filter(fullOrder => deleteOrder.primaryLegs && fullOrder.primaryLegs ? deleteOrder.primaryLegs[0].symbol !== fullOrder.primaryLegs[0].symbol : deleteOrder.holding.symbol !== fullOrder.holding.symbol);
  }

  deleteDaytrade(deleteOrder: SmartOrder) {
    console.log('Deleting day trades that match', deleteOrder.holding.symbol);
    this.otherOrders = this.otherOrders.filter(fullOrder => fullOrder.holding.symbol !== deleteOrder.holding.symbol);
  }

  updateOrder(updatedOrder: SmartOrder) {
    const indices: number[] = this.searchAllLists(updatedOrder);
    const lists = [this.buyOrders, this.sellOrders, this.otherOrders];

    indices.forEach((val, idx) => {
      if (val > -1) {
        if (lists[idx][val].holding.symbol === updatedOrder.holding.symbol) {
          lists[idx][val] = updatedOrder;
        }
        const queueItem: AlgoQueueItem = {
          symbol: updatedOrder.holding.symbol,
          reset: false,
          updateOrder: true
        };

        this.tradeService.algoQueue.next(queueItem);
      }
    });
  }

  searchAllLists(targetOrder: SmartOrder) {
    const buyIndex = this.getOrderIndex(this.buyOrders, targetOrder);
    const sellIndex = this.getOrderIndex(this.sellOrders, targetOrder);
    const otherIndex = this.getOrderIndex(this.otherOrders, targetOrder);
    return [buyIndex, sellIndex, otherIndex];
  }

  deleteOrder(order: SmartOrder) {
    switch (order.side.toLowerCase()) {
      case 'sell':
        this.deleteSell(order);
        break;
      case 'buy':
        this.deleteBuy(order);
        break;
      case 'daytrade':
        this.deleteDaytrade(order);
        break;
    }
    console.log('Deleted order', order, this.sellOrders);
  }

  addOrder(order: SmartOrder) {
    switch (order.side.toLowerCase()) {
      case 'sell':
        this.sellOrders.push(order);
        break;
      case 'buy':
        this.buyOrders.push(order);
        break;
      default:
        this.otherOrders.push(order);
        break;
    }

    this.sellOrders = this.removeDuplicates(this.sellOrders);
    this.buyOrders = this.removeDuplicates(this.buyOrders);
    this.otherOrders = this.removeDuplicates(this.otherOrders);
    console.log('Added new order', order, this.sellOrders, this.buyOrders, this.otherOrders);
  }

  getOrderIndex(orderList: SmartOrder[], targetOrder: SmartOrder) {
    return orderList.findIndex((order) => order && targetOrder&& order.holding.symbol === targetOrder.holding.symbol);
  }

  deleteBySymbol(symbol: string) {
    this.sellOrders = this.sellOrders.filter(order => order.holding.symbol !== symbol);
    this.buyOrders = this.buyOrders.filter(order => order.holding.symbol !== symbol);
    this.otherOrders = this.otherOrders.filter(order => order.holding.symbol !== symbol);
  }

  deleteCart() {
    console.log('Delete cart');
    this.sellOrders = [];
    this.buyOrders = [];
    this.otherOrders = [];
  }

  submitOrders() {
    this.sellOrders.forEach((sell) => {
      sell.pending = true;
      if (!sell.submitted && sell.quantity > 0) {
        this.portfolioService.sell(sell.holding, sell.quantity, sell.price, 'limit').subscribe(
          response => {
            this.messageService.add({
              severity: 'success',
              summary: 'Sell order sent'
            });
            sell.pending = false;
            sell.submitted = true;
          },
          error => {
            console.log(error);
            this.messageService.add({
              severity: 'danger',
              summary: `Sell error for ${sell.holding.symbol}`
            });

            sell.pending = false;
            sell.submitted = false;
          });
      }
    });

    this.buyOrders.forEach((buy) => {
      buy.pending = true;
      if (!buy.submitted && buy.quantity > 0) {
        this.portfolioService.buy(buy.holding, buy.quantity, buy.price, 'limit').subscribe(
          response => {
            this.messageService.add({
              severity: 'success',
              summary: 'Buy order sent'
            });
            buy.pending = false;
            buy.submitted = true;
          },
          error => {
            console.log(error);
            this.messageService.add({
              severity: 'danger',
              summary: `Buy error for ${buy.holding.symbol}`
            });

            buy.pending = false;
            buy.submitted = false;
          });
      }
    });
  }

  buildOrder(symbol: string, quantity = 0, price = 0, side = 'DayTrade', id = null): SmartOrder {
    return {
      holding: {
        instrument: null,
        symbol,
      },
      quantity,
      price,
      positionCount: side.toLowerCase() === 'sell' ? quantity : 0,
      submitted: false,
      pending: false,
      orderSize: quantity || 1,
      side,
      lossThreshold: -0.01,
      profitTarget: 0.05,
      trailingStop: -0.003,
      useStopLoss: false,
      useTrailingStopLoss: false,
      useTakeProfit: false,
      sellAtClose: (side === 'DayTrade' || side === 'Sell') ? true : false,
      id,
      sellCount: 0,
      buyCount: 0
    };
  }

  buildOrderWithAllocation(symbol: string,
    quantity = 0,
    price = 0,
    side = 'DayTrade',
    orderSizePct = 0.3,
    lossThreshold = -0.004,
    profitTarget = 0.008,
    trailingStop = -0.003,
    allocation = null,
    executeImmediately = false,
    reason = ''): SmartOrder {
    return {
      holding: {
        instrument: null,
        symbol,
      },
      quantity,
      price,
      submitted: false,
      pending: false,
      positionCount: side.toLowerCase() === 'sell' ? quantity : 0,
      orderSize: side.toLowerCase() === 'sell' ? quantity : Math.floor(quantity * orderSizePct) || quantity,
      side,
      lossThreshold: lossThreshold,
      profitTarget: profitTarget,
      trailingStop: trailingStop,
      useStopLoss: side.toLowerCase() === 'daytrade' ? true : false,
      useTrailingStopLoss: side.toLowerCase() === 'daytrade' ? true : false,
      useTakeProfit: side.toLowerCase() === 'daytrade' ? true : false,
      sellAtClose: (side.toLowerCase() === 'sell' || side.toLowerCase() === 'daytrade') ? true : false,
      // sellAtClose: false,
      allocation,
      forImmediateExecution: executeImmediately,
      reason,
      sellCount: 0,
      buyCount: 0
    };
  }

  addSellStrangleOrder(symbol: string,
    primaryLegs: Options[],
    secondaryLegs: Options[],
    price: number,
    quantity: number) {
    const order: SmartOrder = {
      holding: {
        instrument: null,
        symbol,
      },
      positionCount: quantity,
      quantity: quantity,
      price,
      submitted: false,
      pending: false,
      orderSize: quantity,
      side: 'Sell',
      lossThreshold: -0.05,
      profitTarget: 0.1,
      trailingStop: -0.05,
      useStopLoss: true,
      useTrailingStopLoss: true,
      useTakeProfit: true,
      sellAtClose: false,
      allocation: 0.05,
      primaryLegs,
      secondaryLegs,
      type: OrderTypes.strangle,
      sellCount: 0,
      buyCount: 0
    };

    this.addToCart(order);
  }

  private existingOptionsCheck(order, underlyingSymbol: string, optionSymbol: string) {
    return order.primaryLegs && (order.holding.symbol === underlyingSymbol || order.primaryLegs[0].symbol === optionSymbol) ||
      (order.secondaryLegs && order.secondaryLegs[0].symbol === optionSymbol);
  }

  optionsOrderExists(symbol, leg) {
    if (!leg || !leg.length) {
      return false;
    }
    return this.buyOrders.find(order => this.existingOptionsCheck(order, symbol, leg[0].symbol)) ||
      this.sellOrders.find(order => this.existingOptionsCheck(order, symbol, leg[0].symbol));
  }

  createOptionOrder(symbol: string,
    primaryLegs: Options[],
    price: number,
    quantity: number,
    optionType,
    reason,
    side = 'Buy',
    orderSize = 1,
    executeImmediately = false,
  ) {
    if (this.optionsOrderExists(symbol, primaryLegs)) {
      const log = `Found existing order ${symbol} ${primaryLegs[0].symbol}`;
      console.log(log);
      this.reportingService.addAuditLog(symbol, log);

      return null;
    } else {
      
      const order: SmartOrder = {
        holding: {
          instrument: null,
          symbol,
        },
        quantity: quantity,
        price,
        submitted: false,
        pending: false,
        orderSize: side.toLowerCase() === 'sell' ? quantity : (!orderSize ? (Math.floor(quantity / 2) || 1) : orderSize),
        positionCount: side.toLowerCase() === 'sell' ? quantity : 0,
        side: side,
        lossThreshold: -0.05,
        profitTarget: 0.1,
        trailingStop: -0.05,
        useStopLoss: false,
        useTrailingStopLoss: false,
        useTakeProfit: false,
        sellAtClose: false,
        allocation: 0.05,
        primaryLegs: primaryLegs.map(leg => {
          leg.quantity = leg.quantity ? leg.quantity : quantity;
          return leg;
        }),
        type: optionType,
        forImmediateExecution: executeImmediately,
        reason,
        sellCount: 0,
        buyCount: 0
      };

      return order;
    }
  }

  async addSingleLegOptionOrder(symbol: string,
    primaryLegs: Options[], price: number,
    quantity: number, optionType,
    side = 'Buy', reason: string = '', executeImmediately = false) {
    this.reportingService.addAuditLog(symbol, `${side} option ${primaryLegs[0].symbol}. Reason ${reason}`);

    if (primaryLegs.find(leg => !leg.quantity)) {
      console.log('Legs missing quantity', primaryLegs);
      primaryLegs.forEach(leg => {
        leg.quantity = quantity;
      });
    }

    let order = this.createOptionOrder(symbol, primaryLegs,
      price, quantity,
      optionType, reason, side,
      null, executeImmediately);
    if (order && order.primaryLegs) {
      this.addToCart(order, side.toLowerCase() === 'sell', reason);
    }
  }

  removeCompletedOrders() {
    this.buyOrders = this.buyOrders.filter(order => {
      const keep = !order.stopped && order.buyCount < order.quantity;
      return keep;
    });
    this.sellOrders = this.sellOrders.filter(order => {
      const keep = !order.stopped && order.sellCount < order.quantity;
      return keep;
    });
    this.otherOrders = this.otherOrders.filter(order => {
      const keep = !order.stopped && order.buyCount + order.sellCount < (order.quantity * 2);
      return keep;
    });
  }

  createOptionObj(holding): Options {
    return {
      symbol: holding.instrument.symbol,
      putCall: holding.instrument.putCall,
      putCallInd: (holding.instrument.putCall.toLowerCase() === 'call' ? 'C' : (holding.instrument.putCall.toLowerCase() === 'put' ? 'P' : null)),
      quantity: holding.longQuantity,
      description: holding.instrument.description,
      averagePrice: holding.averagePrice * 100,
      underlyingSymbol: holding.instrument.underlyingSymbol
    };
  }

  async findCurrentPositions() {
    let currentHoldings = [];
    const data = await this.portfolioService.getTdPortfolio().toPromise();
    if (data) {
      for (const holding of data) {
        if (holding.instrument.assetType.toLowerCase() === 'option') {
          const symbol = holding.instrument.underlyingSymbol;
          const pl = holding.longOpenProfitLoss;
          let found = false;
          currentHoldings = currentHoldings.map(holdingInfo => {
            if (holdingInfo.name === symbol) {
              found = true;
              if (!holdingInfo.primaryLegs) {
                holdingInfo.primaryLegs = [];
                holdingInfo.primaryLegs.push(this.createOptionObj(holding));
              } else {
                if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'c' &&
                  holding.instrument.putCall.toLowerCase() === 'call') {
                  holdingInfo.primaryLegs.push(this.createOptionObj(holding));
                  holdingInfo.primaryLegs.sort((a, b) => b.quantity - a.quantity);
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'c' &&
                  holding.instrument.putCall.toLowerCase() === 'put') {
                  if (!holdingInfo.secondaryLegs) {
                    holdingInfo.secondaryLegs = [];
                  }
                  holdingInfo.secondaryLegs.push(this.createOptionObj(holding));
                  holdingInfo.secondaryLegs.sort((a, b) => b.quantity - a.quantity);
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'p' &&
                  holding.instrument.putCall.toLowerCase() === 'put') {
                  holdingInfo.primaryLegs.push(this.createOptionObj(holding));
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'p' &&
                  holding.instrument.putCall.toLowerCase() === 'call') {
                  if (!holdingInfo.secondaryLegs) {
                    holdingInfo.secondaryLegs = [];
                  }
                  holdingInfo.secondaryLegs.push(this.createOptionObj(holding));
                }
              }
              holdingInfo.cost = holdingInfo.cost ? (holdingInfo.cost + (holding.averagePrice * holding.longQuantity) * 100) : (holding.averagePrice * holding.longQuantity) * 100;
              holdingInfo.netLiq = holdingInfo.netLiq ? (holdingInfo.netLiq + holding.marketValue) : holding.marketValue;
              holdingInfo.pl = holdingInfo.pl + holding.longOpenProfitLoss;
              holdingInfo.pnlPercentage = ((holdingInfo.cost + holdingInfo.pl) - holdingInfo.cost) / holdingInfo.cost;
            }

            return holdingInfo;
          });
          if (!found) {
            const cost = (holding.averagePrice * holding.longQuantity) * 100;
            const tempHoldingObj: PortfolioInfoHolding = {
              name: symbol,
              pl,
              cost: cost,
              netLiq: holding.marketValue,
              pnlPercentage: ((cost + pl) - cost) / cost,
              shares: 0,
              alloc: 0,
              recommendation: null,
              buyReasons: '',
              sellReasons: '',
              buyConfidence: 0,
              sellConfidence: 0,
              prediction: null,
              primaryLegs: [this.createOptionObj(holding)],
              assetType: holding.instrument.assetType.toLowerCase()
            };
            currentHoldings.push(tempHoldingObj);
          }
        } else if (holding.instrument.assetType.toLowerCase() === 'equity' || holding.instrument.assetType === 'COLLECTIVE_INVESTMENT') {
          const symbol = holding.instrument.symbol;

          const pl = holding.longOpenProfitLoss;
          let found = false;
          currentHoldings = currentHoldings.map(holdingInfo => {
            if (holdingInfo.name === symbol) {
              found = true;
              holdingInfo.cost = holdingInfo.cost ? (holdingInfo.cost + (holding.averagePrice * holding.longQuantity)) : (holding.averagePrice * holding.longQuantity);
              holdingInfo.pl = holdingInfo.pl + holding.longOpenProfitLoss;
              holdingInfo.netLiq = holdingInfo.netLiq ? (holdingInfo.netLiq + holding.marketValue) : holding.marketValue;
              holdingInfo.pnlPercentage = ((holdingInfo.cost + holdingInfo.pl) - holdingInfo.cost) / holdingInfo.cost;
            }

            return holdingInfo;
          });
          if (!found) {
            const cost = (holding.averagePrice * holding.longQuantity);
            const tempHoldingObj = {
              name: symbol,
              pl,
              assetType: holding.instrument.assetType.toLowerCase(),
              netLiq: holding.marketValue,
              shares: holding.longQuantity,
              cost: cost,
              pnlPercentage: ((cost + pl) - cost) / cost,
              alloc: 0,
              recommendation: null,
              buyReasons: '',
              sellReasons: '',
              buyConfidence: 0,
              sellConfidence: 0,
              prediction: null
            };

            currentHoldings.push(tempHoldingObj);
          }
        }
      }
    }

    return currentHoldings;
  }

  async getAvailableFunds(useCashBalance: boolean) {
    const balance = await this.portfolioService.getTdBalance().toPromise();
    return useCashBalance ? Number(balance.cashBalance) : Number(balance.availableFunds);
  }

  isStrangle(holding: PortfolioInfoHolding) {
    return (holding.primaryLegs && holding.secondaryLegs) &&
      (holding.primaryLegs.length === holding.secondaryLegs.length) &&
      (holding.primaryLegs[0].putCallInd !== holding.secondaryLegs[0].putCallInd);
  }

  initializeOrder(order: SmartOrder) {
    order.stopped = false;
    const queueItem: AlgoQueueItem = {
      symbol: order.holding.symbol,
      reset: true
    };

    this.tradeService.algoQueue.next(queueItem);
  }

  getQuantity(stockPrice: number, allocationPct: number, total: number) {
    const totalCost = round(total * allocationPct, 2);
    if (!totalCost) {
      return 0;
    }
    return Math.floor(totalCost / stockPrice);
  }

  async buildBuyOrder(holding: PortfolioInfoHolding,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null,
    reason: string) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const cash = await this.getAvailableFunds(false);
    const quantity = this.getQuantity(price, allocation, cash);
    if (!quantity) {
      this.reportingService.addAuditLog(holding.name, `Insufficient funds: Available: ${cash} Cost: ${round(cash * allocation, 2)} Share price: ${price}`, '');
    }
    const orderSizePct = 0.1;
    const order = this.buildOrderWithAllocation(holding.name, quantity, price, 'Buy',
      orderSizePct, stopLossThreshold, profitThreshold,
      stopLossThreshold, allocation, false, reason);
    return order;
  }

  async portfolioSell(holding: PortfolioInfoHolding, reason = '', executeImmediately = false, replaceExistingOrder = true) {
    const price = await this.portfolioService.getPrice(holding.name, false).toPromise();
    const orderSizePct = 0.5;
    const order = this.buildOrderWithAllocation(holding.name,
      holding.shares,
      price,
      'Sell',
      orderSizePct, -0.005, 0.01, -0.003, null, executeImmediately, reason);
    this.addToCart(order, replaceExistingOrder, reason);
    this.initializeOrder(order);
  }

  async portfolioBuy(holding: PortfolioInfoHolding,
    allocation: number = 0.05,
    profitThreshold: number = null,
    stopLossThreshold: number = null, reason: string) {
    const order = await this.buildBuyOrder(holding, allocation, profitThreshold, stopLossThreshold, reason);
    console.log('Portfolio buy', order);

    if (order.quantity) {
      this.addToCart(order, false, reason);
      this.initializeOrder(order);
    }
  }


  async portfolioDaytrade(symbol: string,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null) {
    const price = await this.portfolioService.getPrice(symbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const quantity = this.getQuantity(price, allocation, balance.buyingPower);
    const orderSizePct = 0.5;
    const order = this.buildOrderWithAllocation(symbol,
      quantity,
      price,
      'DayTrade',
      orderSizePct,
      stopLossThreshold,
      profitThreshold,
      stopLossThreshold,
      allocation);
    this.addToCart(order, false, 'Day trading');
    this.initializeOrder(order);
  }
}
