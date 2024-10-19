import { Injectable } from '@angular/core';
import { PortfolioInfoHolding, PortfolioService } from './portfolio.service';
import { OrderTypes, SmartOrder } from '../models/smart-order';
import { TradeService, AlgoQueueItem } from './trade.service';
import { round } from 'lodash';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import * as moment from 'moment-timezone';
import { Options } from '@shared/models/options';
import { ReportingService } from './reporting.service';
import { MachineLearningService } from './machine-learning/machine-learning.service';
import { GlobalSettingsService } from 'src/app/settings/global-settings.service';

@Injectable()
export class CartService {
  sellOrders: SmartOrder[] = [];
  buyOrders: SmartOrder[] = [];
  otherOrders: SmartOrder[] = [];
  cartObserver: Subject<boolean> = new Subject<boolean>();

  constructor(
    private portfolioService: PortfolioService,
    private tradeService: TradeService,
    private reportingService: ReportingService,
    private machineLearningService: MachineLearningService,
    private globalSettingsService: GlobalSettingsService,
    private messageService: MessageService) { }

  addToCart(order: SmartOrder, replaceAnyExistingOrders = false, reason = '') {
    this.machineLearningService
      .trainDaytrade(order.holding.symbol.toUpperCase(),
        moment().add({ days: 1 }).format('YYYY-MM-DD'),
        moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
        1,
        this.globalSettingsService.daytradeAlgo
      ).subscribe();
    order.createdTime = moment().format();
    const indices = this.searchAllLists(order);
    let noDup = true;
    for (const idx of indices) {
      if (idx > -1) {
        noDup = false;
        break;
      }
    }

    let log = `Adding order ${order.side} ${order.quantity} ${order.holding.symbol}`;
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
    this.reportingService.addAuditLog(order.holding.symbol, log, reason);

    if (!noDup && replaceAnyExistingOrders) {
      if (indices[0] > -1) {
        this.deleteBuy(this.buildOrder(order.holding.symbol, null, null, 'buy'));
      } else if (indices[1] > -1) {
        this.deleteSell(this.buildOrder(order.holding.symbol, null, null, 'sell'));
      } else if (indices[2] > -1) {
        this.deleteDaytrade(this.buildOrder(order.holding.symbol, null, null, 'daytrade'));
      }
      this.addOrder(order);
    }

    if (noDup && order.quantity > 0) {
      if (order.side.toLowerCase() === 'sell') {
        this.sellOrders.push(order);

        this.messageService.add({
          severity: 'success',
          summary: 'Sell order added to cart'
        });
      } else if (order.side.toLowerCase() === 'buy') {
        this.buyOrders.push(order);
        this.messageService.add({
          severity: 'success',
          summary: 'Buy order added to cart'
        });
      } else {
        this.otherOrders.push(order);

        this.messageService.add({
          severity: 'success',
          summary: `Added ${order.side} ${order.holding.symbol}`
        });
      }
    }
    this.cartObserver.next(true);
  }

  deleteSell(deleteOrder: SmartOrder) {
    console.log('Deleting sell orders that match', deleteOrder.holding.symbol);
    this.sellOrders = this.sellOrders.filter(fullOrder => fullOrder.holding.symbol !== deleteOrder.holding.symbol);
    this.cartObserver.next(true);
  }

  deleteBuy(deleteOrder: SmartOrder) {
    console.log('Deleting buy orders that match', deleteOrder.holding.symbol);
    this.buyOrders = this.buyOrders.filter(fullOrder => fullOrder.holding.symbol !== deleteOrder.holding.symbol);
    this.cartObserver.next(true);

  }

  deleteDaytrade(deleteOrder: SmartOrder) {
    console.log('Deleting day trades that match', deleteOrder.holding.symbol);
    this.otherOrders = this.otherOrders.filter(fullOrder => fullOrder.holding.symbol !== deleteOrder.holding.symbol);
    this.cartObserver.next(true);
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
    this.cartObserver.next(true);
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
    this.cartObserver.next(true);
  }

  addOrder(order: SmartOrder) {
    switch (order.side.toLowerCase()) {
      case 'sell':
        this.sellOrders.push(order);
        break;
      case 'buy':
        this.buyOrders.push(order);
        break;
      case 'daytrade':
        this.otherOrders.push(order);
        break;
    }
    this.cartObserver.next(true);
  }

  getOrderIndex(orderList: SmartOrder[], targetOrder: SmartOrder) {
    return orderList.findIndex((order) => order && targetOrder && order.holding.symbol === targetOrder.holding.symbol);
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
      id
    };
  }

  buildOrderWithAllocation(symbol: string, quantity = 0, price = 0,
    side = 'DayTrade', orderSizePct = 0.5, lossThreshold = -0.004,
    profitTarget = 0.008, trailingStop = -0.003, allocation = null): SmartOrder {
    return {
      holding: {
        instrument: null,
        symbol,
      },
      quantity,
      price,
      submitted: false,
      pending: false,
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
      allocation
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
      type: OrderTypes.strangle
    };

    this.addToCart(order);
  }

  createOptionOrder(symbol: string,
    primaryLegs: Options[],
    price: number,
    quantity: number,
    optionType,
    side = 'Buy',
    orderSize = 1) {
    const foundExistingOrder = this.buyOrders.find(order => order.primaryLegs && order.holding.symbol === symbol && order.primaryLegs[0].symbol === primaryLegs[0].symbol && !order.secondaryLegs);
    if (foundExistingOrder) {
      foundExistingOrder.primaryLegs[0].quantity += quantity
      this.updateOrder(foundExistingOrder);
    } if (this.sellOrders.find(order => order.primaryLegs && order.holding.symbol === symbol && order.primaryLegs[0].symbol === primaryLegs[0].symbol && !order.secondaryLegs)) {
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
        side: side,
        lossThreshold: -0.05,
        profitTarget: 0.1,
        trailingStop: -0.05,
        useStopLoss: false,
        useTrailingStopLoss: false,
        useTakeProfit: false,
        sellAtClose: false,
        allocation: 0.05,
        primaryLegs,
        type: optionType
      };

      return order;
    }
  }

  async addOptionOrder(symbol: string,
    primaryLegs: Options[], price: number,
    quantity: number, optionType,
    side = 'Buy', reason: string) {
    const order = this.createOptionOrder(symbol, primaryLegs, price, quantity, optionType, side);
    if (order) {
      console.log('Adding option order for', symbol);
      this.addToCart(order, true, reason);
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
    this.cartObserver.next(true);
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
          const pl = holding.marketValue - (holding.averagePrice * holding.longQuantity) * 100;
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
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'c' &&
                  holding.instrument.putCall.toLowerCase() === 'put') {
                  if (!holdingInfo.secondaryLegs) {
                    holdingInfo.secondaryLegs = [];
                  }
                  holdingInfo.secondaryLegs.push(this.createOptionObj(holding));
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
              holdingInfo.pl = holdingInfo.pl + (holding.marketValue - (holding.averagePrice * holding.longQuantity) * 100);
            }

            return holdingInfo;
          });
          if (!found) {
            const tempHoldingObj: PortfolioInfoHolding = {
              name: symbol,
              pl,
              cost: (holding.averagePrice * holding.longQuantity) * 100,
              netLiq: holding.marketValue,
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

          const pl = holding.marketValue - (holding.averagePrice * holding.longQuantity);
          let found = false;
          currentHoldings = currentHoldings.map(holdingInfo => {
            if (holdingInfo.name === symbol) {
              found = true;
              holdingInfo.cost = holdingInfo.cost ? (holdingInfo.cost + (holding.averagePrice * holding.longQuantity) * 100) : (holding.averagePrice * holding.longQuantity) * 100;
              holdingInfo.pl = holdingInfo.pl + (holding.marketValue - (holding.averagePrice * holding.longQuantity) * 100);
              holdingInfo.netLiq = holdingInfo.netLiq ? (holdingInfo.netLiq + holding.marketValue) : holding.marketValue;
            }

            return holdingInfo;
          });
          if (found) {
            const tempHoldingObj = {
              name: symbol,
              pl,
              netLiq: holding.marketValue,
              shares: holding.longQuantity,
              cost: (holding.averagePrice * holding.longQuantity) * 100,
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
    let usableBalance = useCashBalance ? Number(balance.cashBalance) : Number(balance.availableFunds);
    const currentHoldings = await this.findCurrentPositions();
    const vtiHolding = currentHoldings.find(holding => holding.name === 'VTI');
    if (vtiHolding) {
      usableBalance += Number(vtiHolding.netLiq);
    }
    return usableBalance;
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
    stopLossThreshold: number = null) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const cash = await this.getAvailableFunds(false);
    const quantity = this.getQuantity(price, allocation, cash);
    const orderSizePct = 0.1;
    const order = this.buildOrderWithAllocation(holding.name, quantity, price, 'Buy',
      orderSizePct, stopLossThreshold, profitThreshold,
      stopLossThreshold, allocation);
    return order;
  }

  async portfolioSell(holding: PortfolioInfoHolding, reason) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const orderSizePct = 0.5;
    const order = this.buildOrderWithAllocation(holding.name, holding.shares, price, 'Sell',
      orderSizePct, null, null, null);
    this.addToCart(order, true, reason);
    this.initializeOrder(order);
  }

  async portfolioBuy(holding: PortfolioInfoHolding,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null, reason: string) {
    const order = await this.buildBuyOrder(holding, allocation, profitThreshold, stopLossThreshold);
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
