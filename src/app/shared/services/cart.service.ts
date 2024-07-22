import { Injectable } from '@angular/core';
import { PortfolioService } from './portfolio.service';
import { OrderTypes, SmartOrder } from '../models/smart-order';
import { TradeService, AlgoQueueItem } from './trade.service';
import * as _ from 'lodash';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import * as moment from 'moment-timezone';
import { Options } from '@shared/models/options';
import { ReportingService } from './reporting.service';

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
    private messageService: MessageService) { }

  addToCart(order: SmartOrder, replaceAnyExistingOrders = false) {
    order.createdTime = moment().format();
    const indices = this.searchAllLists(order);
    let noDup = true;
    for (const idx of indices) {
      if (idx > -1) {
        const msg = `Order for ${order.holding.symbol} already exists`;
        console.log(msg);

        this.messageService.add({
          severity: 'danger',
          summary: msg
        });
        noDup = false;
        break;
      }
    }

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
    return orderList.findIndex((order) => order.holding.symbol === targetOrder.holding.symbol);
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
      orderSize: 1,
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

  async addOptionOrder(symbol: string,
    primaryLegs: Options[],
    price: number,
    quantity: number,
    optionType,
    side = 'Buy') {
    if ((price * 100) < 100) {
      console.log('Options price too low.', primaryLegs[0], price);
      return;
    }
    const order: SmartOrder = {
      holding: {
        instrument: null,
        symbol,
      },
      quantity: quantity,
      price,
      submitted: false,
      pending: false,
      orderSize: 1,
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

    this.addToCart(order);
  }

  removeCompletedOrders() {
    this.buyOrders = this.buyOrders.filter(order => {
      const keep = !order.stopped && order.buyCount < order.quantity;
      if (!keep) {
        this.reportingService.addAuditLog(order.holding.symbol, `Removing finished buy order ${order.holding.symbol}`);
      }
      return keep;
    });
    this.sellOrders = this.sellOrders.filter(order => {
      const keep = !order.stopped && order.sellCount < order.quantity;
      if (!keep) {
        this.reportingService.addAuditLog(order.holding.symbol, `Removing finished sell order ${order.holding.symbol}`);
      }
      return keep;
    });
    this.otherOrders = this.otherOrders.filter(order => {
      const keep = !order.stopped && order.buyCount + order.sellCount < (order.quantity * 2);
      if (!keep) {
        this.reportingService.addAuditLog(order.holding.symbol, `Removing finished order ${order.holding.symbol}`);
      }
      return keep;
    });
    this.cartObserver.next(true);
  }
}
