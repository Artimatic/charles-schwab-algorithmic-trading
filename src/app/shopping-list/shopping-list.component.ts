import { Component, OnInit, OnDestroy } from '@angular/core';
import { CartService } from '../shared/services/cart.service';
import { SmartOrder } from '../shared/models/smart-order';
import { ScoreKeeperService, ReportingService, PortfolioService } from '../shared';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { TimerObservable } from 'rxjs/observable/TimerObservable';
import { Subscription } from 'rxjs/Subscription';

import * as moment from 'moment-timezone';
import * as _ from 'lodash';
import { Holding } from '../shared/models';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { TradeService, AlgoQueueItem } from '../shared/services/trade.service';
import { OrderRow } from '../shared/models/order-row';
import { FormControl, Validators } from '@angular/forms';
import { takeWhile } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';

@Component({
  selector: 'app-shopping-list',
  templateUrl: './shopping-list.component.html',
  styleUrls: ['./shopping-list.component.css']
})
export class ShoppingListComponent implements OnInit, OnDestroy {
  defaultInterval = 70800;
  simultaneousOrderLimit = 3;

  ordersStarted: number;
  interval: number;

  alive: boolean;
  displayOrderDialog: boolean;

  sub: Subscription;

  lastCheckedTime: string;

  simpleCardForm: FormControl;
  mlCardForm: FormControl;

  simpleCards: SmartOrder[];
  mlCards: SmartOrder[];

  multibuttonOptions: MenuItem[];
  destroy$ = new Subject();

  constructor(public cartService: CartService,
    public scoreKeeperService: ScoreKeeperService,
    public dialog: MatDialog,
    private reportingService: ReportingService,
    public snackBar: MatSnackBar,
    private portfolioService: PortfolioService,
    public globalSettingsService: GlobalSettingsService,
    private tradeService: TradeService,
    private newStockFinderService: NewStockFinderService) { }

  ngOnInit() {
    this.mlCards = [];
    this.interval = this.defaultInterval;

    this.simpleCardForm = new FormControl('', [
      Validators.required
    ]);

    this.mlCardForm = new FormControl('', [
      Validators.required
    ]);

    this.simpleCards = [{
      holding: {
        instrument: null,
        symbol: 'TLT'
      },
      quantity: 0,
      price: 0,
      submitted: false,
      pending: false,
      side: 'DayTrade',
    },
    {
      holding: {
        instrument: null,
        symbol: 'SPY'
      },
      quantity: 0,
      price: 0,
      submitted: false,
      pending: false,
      side: 'DayTrade',
    }];

    this.ordersStarted = 0;

    this.multibuttonOptions = [
      {
        label: 'Delete Orders', icon: 'pi pi-trash', command: () => {
          this.stopAndDeleteOrders();
        }
      }
    ];
  }

  ngOnDestroy() {
    this.cleanUp();
    this.destroy$.next();
    this.destroy$.complete();
  }

  cleanUp() {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = undefined;
    }
  }

  deleteSellOrder(deleteOrder: SmartOrder) {
    this.cartService.deleteSell(deleteOrder);
  }

  deleteBuyOrder(deleteOrder: SmartOrder) {
    this.cartService.deleteBuy(deleteOrder);
  }

  confirmStart(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '250px',
      data: { title: 'Confirm', message: 'Are you sure you want to execute all orders?' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (this.sub) {
          this.sub.unsubscribe();
        }
        this.triggerStart();
      }
    });
  }

  triggerStart() {
    const concat = this.cartService.sellOrders.concat(this.cartService.buyOrders);
    this.queueAlgos(concat.concat(this.cartService.otherOrders));
  }

  saveToStorage(templateOrders: SmartOrder[]) {
    sessionStorage.removeItem('daytradeList');
    const ordersToSave = templateOrders.reduce((acc, val: SmartOrder) => {
      if (!acc.uniqueSymbols[val.holding.symbol]) {
        acc.uniqueSymbols[val.holding.symbol] = true;
        acc.list.push(val);
      }
      return acc;
    }, { uniqueSymbols: {}, list: [] }).list;
    sessionStorage.setItem('daytradeList', JSON.stringify(ordersToSave));
  }

  queueAlgos(orders: SmartOrder[]) {
    this.saveToStorage(orders);
    this.globalSettingsService.setStartTimes();
    const mlStartTime = moment.tz(`${this.globalSettingsService.getTradeDate().format('YYYY-MM-DD')} 15:55`, 'America/New_York');
    let mlStopTime = moment.tz(`${this.globalSettingsService.getTradeDate().format('YYYY-MM-DD')} 16:00`, 'America/New_York');
    const log = `New queue set to start at ${moment(this.globalSettingsService.startTime).format()}`;
    const report = this.reportingService.addAuditLog('', log);
    console.log(report);
    this.alive = true;
    let lastIndex = 0;
    const limit = this.simultaneousOrderLimit > orders.length ? orders.length : this.simultaneousOrderLimit;

    _.forEach(orders, (order: SmartOrder) => {
      order.stopped = false;
      const queueItem: AlgoQueueItem = {
        symbol: order.holding.symbol,
        reset: true
      };

      this.tradeService.algoQueue.next(queueItem);
    });

    this.sub = TimerObservable.create(0, this.interval)
      .pipe(
        takeWhile(() => this.alive))
      .subscribe(() => {
        this.lastCheckedTime = moment().format('hh:mm');
        if (this.interval !== this.defaultInterval) {
          this.interval = this.defaultInterval;
        }

        if (moment().isAfter(moment(this.globalSettingsService.startTime)) &&
          moment().isBefore(moment(this.globalSettingsService.stopTime))) {
          let executed = 0;
          while (executed < limit && lastIndex < orders.length) {
            const queueItem: AlgoQueueItem = {
              symbol: orders[lastIndex].holding.symbol,
              reset: false
            };

            setTimeout(() => {
              this.tradeService.algoQueue.next(queueItem);
            }, 500 * lastIndex);
            lastIndex++;
            executed++;
          }
          if (lastIndex >= orders.length) {
            lastIndex = 0;
          }
        }
        if (moment().isAfter(moment(this.globalSettingsService.stopTime)) &&
          moment().isBefore(moment(this.globalSettingsService.stopTime).add(2, 'minutes'))) {
          this.interval = moment().subtract(5, 'minutes').diff(moment(this.globalSettingsService.startTime), 'milliseconds');
          console.log('new interval: ', this.interval);
        }

        if ((moment().isAfter(moment(mlStartTime)) &&
          moment().isBefore(moment(mlStopTime)))) {
          orders.forEach((order: SmartOrder) => {
            if (order.side.toLowerCase() !== 'daytrade') {
              const queueItem: AlgoQueueItem = {
                symbol: order.holding.symbol,
                reset: false,
                triggerMlBuySell: true
              };
              this.tradeService.algoQueue.next(queueItem);
            }
          });
          mlStopTime = mlStartTime;
        }
      });
  }

  stop() {
    this.alive = false;
  }

  stopAndDeleteOrders() {
    this.stop();
    this.cleanUp();
    const buySells = this.cartService.sellOrders.concat(this.cartService.buyOrders);

    _.forEach(buySells.concat(this.cartService.otherOrders), (order: SmartOrder) => {
      order.stopped = true;
    });

    this.cartService.deleteCart();
  }

  handleStockListImport(file: any) {
    file.forEach((row) => {
      const ticker = row.__EMPTY;
      if (ticker !== 'Ticker') {
        this.newStockFinderService.addStock(ticker);
      }
    });
  }
  
  importFile(file) {
    if (file.length && file[0]['Goldman Sachs Hedge Industry VIP ETF']) {
      this.handleStockListImport(file);
      return;
    }
    file.forEach((row: OrderRow) => {
      this.portfolioService.getInstruments(row.symbol).subscribe((response) => {
        const instruments = response.results[0];
        const newHolding: Holding = {
          instrument: instruments.url,
          symbol: instruments.symbol
        };

        const order: SmartOrder = {
          holding: newHolding,
          quantity: row.quantity * 1,
          price: row.price,
          submitted: false,
          pending: false,
          side: row.side,
          lossThreshold: row.Stop * 1 || null,
          profitTarget: row.Target * 1 || null,
          trailingStop: row.TrailingStop || null,
          useStopLoss: row.StopLoss || null,
          useTrailingStopLoss: row.TrailingStopLoss || null,
          useTakeProfit: row.TakeProfit || null,
          sellAtClose: row.SellAtClose || null,
          orderSize: row.OrderSize * 1 || null
        };
        this.cartService.addToCart(order);
      },
        (error) => {
          this.snackBar.open('Error getting instruments', 'Dismiss', {
            duration: 2000,
          });
        });
    });
  }

  addSimpleCard() {
    this.portfolioService.getInstruments(this.simpleCardForm.value).subscribe((response) => {
      const instruments = response.results[0];
      const newHolding: Holding = {
        instrument: null,
        symbol: instruments.symbol
      };

      const order: SmartOrder = {
        holding: newHolding,
        quantity: 0,
        price: 0,
        submitted: false,
        pending: false,
        side: 'DayTrade',
      };
      this.simpleCards.push(order);
    },
      (error) => {
        this.snackBar.open(`Error getting instruments for ${this.simpleCardForm.value}`, 'Dismiss', {
          duration: 2000,
        });
      });
  }

  addMlCard() {
    this.portfolioService.getInstruments(this.mlCardForm.value).subscribe((response) => {
      const instruments = response.results[0];
      const newHolding: Holding = {
        instrument: null,
        symbol: instruments.symbol
      };

      const order: SmartOrder = {
        holding: newHolding,
        quantity: 0,
        price: 0,
        submitted: false,
        pending: false,
        side: 'DayTrade',
      };
      this.mlCards.push(order);
    },
      (error) => {
        this.snackBar.open(`Error getting instruments for ${this.simpleCardForm.value}`, 'Dismiss', {
          duration: 2000,
        });
      });
  }

  showOrderDialog() {
    this.displayOrderDialog = true;
  }
}
