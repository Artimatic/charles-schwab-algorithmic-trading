import { Component, OnChanges, Input, OnInit, SimpleChanges, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

import * as moment from 'moment-timezone';
import * as _ from 'lodash';

import { OrderPref } from '../shared/enums/order-pref.enum';
import {
  BacktestService,
  DaytradeService,
  ReportingService,
  ScoreKeeperService,
  PortfolioService
} from '../shared';
import { OrderTypes, SmartOrder } from '../shared/models/smart-order';
import { Subscription } from 'rxjs/Subscription';
import { CartService } from '../shared/services/cart.service';
import { Indicators } from '../shared/models/indicators';
import { CardOptions } from '../shared/models/card-options';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { AlgoQueueItem } from '../shared/services/trade.service';
import { OrderingService } from '@shared/services/ordering.service';
import { GlobalTaskQueueService } from '@shared/services/global-task-queue.service';
import { ClientSmsService } from '@shared/services/client-sms.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { SelectItem } from 'primeng/api';
import { DaytradeAlgorithms } from '@shared/enums/daytrade-algorithms.enum';
import { DialogService } from 'primeng/dynamicdialog';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { SimulationChartComponent } from '../simulation/simulation-chart/simulation-chart.component';

@Component({
  selector: 'app-bb-card',
  templateUrl: './bb-card.component.html',
  styleUrls: ['./bb-card.component.css']
})
export class BbCardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() order: SmartOrder;
  @Input() tearDown: boolean;
  alive: boolean;
  live: boolean;
  interval: number;
  orders: SmartOrder[] = [];
  positionCount: number;
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  sub: Subscription;
  sides: string[];
  error: string;
  color: string;
  warning: string;
  tiles;
  bbandPeriod: number;
  dataInterval: string;
  stopped: boolean;
  isBacktest: boolean;
  indicators: Indicators;
  trailingHighPrice: number;

  preferenceList: any[];

  subscriptions: Subscription[];

  multiplierPreference: FormControl;
  multiplierList: number[];

  lastTriggeredTime: string;

  smsOptions: SelectItem[];
  smsOption;

  priceLowerBound = null;
  priceUpperBound = null;

  selectedAlgorithm: FormControl;
  algorithmList: any[];

  settingsVisible = false;
  startingPrice = null;

  lastMlResult: number = null;

  sendingOrder = false;

  constructor(private _formBuilder: FormBuilder,
    private backtestService: BacktestService,
    private daytradeService: DaytradeService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService,
    public cartService: CartService,
    private globalSettingsService: GlobalSettingsService,
    private orderingService: OrderingService,
    private globalTaskQueueService: GlobalTaskQueueService,
    private clientSmsService: ClientSmsService,
    private dialogService: DialogService,
    private machineDaytradingService: MachineDaytradingService,
    private scoreKeeperService: ScoreKeeperService,
    private strategyBuilderService: StrategyBuilderService,
    private orderHandlingService: OrderHandlingService) { }

  ngOnInit() {
    this.init();
    this.subscriptions = [];

    this.smsOptions = [
      { label: 'No SMS', value: 'none' },
      { label: 'Only send SMS', value: 'only_sms' },
      { label: 'Send order and SMS', value: 'order_sms' }
    ];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (_.get(changes, 'tearDown.currentValue')) {
      this.stop();
    }
  }

  init() {
    this.alive = true;
    this.live = false;
    this.sides = ['Buy', 'Sell', 'DayTrade'];
    this.error = '';

    this.preferenceList = [
      OrderPref.TakeProfit,
      OrderPref.StopLoss,
      OrderPref.TrailingStopLoss,
      OrderPref.SellAtClose,
      OrderPref.MlBuySellAtClose
    ];

    this.algorithmList = [
      DaytradeAlgorithms.Default
    ];

    this.selectedAlgorithm = new FormControl();
    this.selectedAlgorithm.setValue(this.algorithmList[0]);
    this.bbandPeriod = 80;
    this.dataInterval = '1min';

    this.multiplierList = [
      1,
      2,
      3,
      4,
      5
    ];

    this.multiplierPreference = new FormControl();
    this.multiplierPreference.setValue(1);

    this.smsOption = new FormControl();
    this.smsOption.setValue('none');

    this.firstFormGroup = this._formBuilder.group({
      quantity: [this.order.quantity, Validators.required],
      lossThreshold: [this.order.lossThreshold || -0.005, Validators.required],
      trailingStop: [this.order.trailingStop || -0.002, Validators.required],
      profitTarget: [{ value: this.order.profitTarget || 0.01, disabled: false }, Validators.required],
      orderSize: [this.order.orderSize || this.daytradeService.getDefaultOrderSize(this.order.quantity), Validators.required],
      orderType: [this.order.side, Validators.required],
      phoneNumber: [''],
      useML: false
    });

    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required]
    });

    this.setup();
  }

  resetBuying() {
    this.sendingOrder = false;
  }

  backtest(): void {
    this.setup();
    this.stop();

    this.isBacktest = true;

    const yahooSub = this.backtestService.getYahooIntraday(this.order.holding.symbol)
      .subscribe(
        result => {
          const postIntradaySub = this.backtestService.postIntraday(result).subscribe(
            status => {
              this.runServerSideBacktest();
            }, error => {
              this.runServerSideBacktest();
            });
          this.subscriptions.push(postIntradaySub);
        }, error => {
          this.error = `Error getting quotes for ${this.order.holding.symbol}`;
        });

    this.subscriptions.push(yahooSub);
  }

  async runServerSideBacktest() {
    this.setup();
    this.stop();
    this.isBacktest = true;
    const currentDate = this.globalSettingsService.backtestDate;
    const futureDate = moment().add(1, 'days').format('YYYY-MM-DD');

    this.backtestService.getDaytradeBacktest(this.order.holding.symbol,
      futureDate, currentDate,
      {
        lossThreshold: this.order.lossThreshold,
        profitThreshold: this.order.profitTarget,
        minQuotes: 81
      }).subscribe(results => {
        if (results.returns) {
          this.scoreKeeperService.resetProfitLoss(this.order.holding.symbol);
          this.scoreKeeperService.addProfitLoss(this.order.holding.symbol, results.returns * 100);
        }

        if (results.profitableTrades && results.totalTrades) {
          this.scoreKeeperService.winlossHash[this.order.holding.symbol] = {
            wins: results.profitableTrades,
            losses: null,
            total: results.totalTrades
          };
        }
        this.isBacktest = false;
      },
        error => {
          this.error = error._body;
          this.isBacktest = false;
        }
      );

    this.tiles = this.daytradeService.buildTileList(this.orders);
  }

  stop() {
    this.alive = false;
    this.live = false;
    this.stopped = true;
    if (this.order) {
      this.order.stopped = true;
    }
    this.cartService.updateOrder(this.order);
    if (this.sub) {
      this.sub.unsubscribe();
    }
    this.subscriptions?.forEach(sub => {
      if (sub) {
        sub.unsubscribe();
      }
    });
  }

  setup() {
    this.order.buyCount = 0;
    this.order.sellCount = 0;
    this.order.positionCount = this.order.side.toLowerCase() === 'sell' ? this.firstFormGroup.value.quantity : 0;
    this.orders = [];
    this.warning = '';
    this.stopped = false;
    this.startingPrice = null;
    this.scoreKeeperService.resetScore(this.order.holding.symbol);

    switch (this.firstFormGroup.value.orderType.side) {
      case 'Buy':
        this.color = 'primary';
        break;
      case 'Sell':
        this.color = 'warn';
        break;
      default:
        this.color = 'accent';
    }
  }

  incrementBuy(order = null) {
    if (this.sendingOrder) {
      return false;
    }
    this.sendingOrder = true;
    if (order) {
      console.log('Sent buy order', order.holding.symbol, order, this.order);

      this.orders.push(order);
      this.order.buyCount += order.quantity;
      this.order.positionCount += order.quantity;
    } else {
      this.order.buyCount += this.order.orderSize;
      this.order.positionCount += 1;
    }
    this.cartService.updateOrder(this.order);
    return true;
  }

    simulate() {
    this.dialogService.open(SimulationChartComponent, {
      header: 'Simulation',
      contentStyle: { 'overflow-y': 'unset' },
      width: '100vw',
      height: '100vh',
      data: {
        symbol: this.order.holding.symbol
      }
    });
  }

  delete() {
    this.order.stopped = true;
    this.alive = false;
    this.cartService.deleteOrder(this.order);
  }

  ngOnDestroy() {
    this.order = null;
    this.stop();
  }
}
