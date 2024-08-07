import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import * as _ from 'lodash';
import { BacktestService, PortfolioService, MachineLearningService } from '@shared/services';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ClientSmsService } from '@shared/services/client-sms.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { TimerObservable } from 'rxjs/observable/TimerObservable';
import * as moment from 'moment-timezone';
import { Subscription } from 'rxjs';
import { take, takeWhile } from 'rxjs/operators';
import { MessageService, SelectItem } from 'primeng/api';
import { SchedulerService } from '@shared/service/scheduler.service';

@Component({
  selector: 'app-sms-card',
  templateUrl: './sms-card.component.html',
  styleUrls: ['./sms-card.component.css']
})
export class SmsCardComponent implements OnInit, OnDestroy {
  alive = false;

  firstFormGroup: FormGroup;
  stockFormControl: FormControl;
  maxMessages: FormControl;
  phoneNumber: FormControl;
  testing: FormControl;
  toastOnly = new FormControl();
  buySellOptions: SelectItem[];
  buySellOption;

  stockList = [];
  subscriptions: Subscription[] = [];

  interval = 60000;
  defaultInterval = 70800;
  tiles;
  error: string;
  startTime;
  stopTime;
  sub;
  messagesSent = 0;
  lastSentSms: any = {};
  lastTrainedTime: any = {};
  activeIndex = 0;
  stepMenuItems = [{
    label: 'Edit',
    command: () => {
      this.activeIndex = 0;
    }
  },
  {
    label: 'Submit',
    command: () => {
      this.activeIndex = 1;
    }
  }];

  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private clientSmsService: ClientSmsService,
    private globalSettingsService: GlobalSettingsService,
    private machineLearningService: MachineLearningService,
    private messageService: MessageService,
    private schedulerService: SchedulerService,
    public dialog: MatDialog) { }

  ngOnInit() {
    this.buySellOption = new FormControl();
    this.buySellOption.setValue('none');

    this.phoneNumber = new FormControl();

    this.maxMessages = new FormControl(10, [
      Validators.required
    ]);

    this.stockFormControl = new FormControl('', [
      Validators.required
    ]);

    this.testing = new FormControl();
    this.toastOnly = new FormControl();

    this.buySellOptions = [
      { label: 'Buy and Sell', value: 'buy_sell' },
      { label: 'Sell Only', value: 'sell_only' },
      { label: 'Buy Only', value: 'buy_only' }
    ];

    this.initializeStartTime();
    this.setup();
  }

  goLive() {
    this.alive = true;
    this.activeIndex = 1;
    this.setup();
    this.interval = this.defaultInterval;
    this.messagesSent = 0;
    this.sub = TimerObservable.create(0, this.interval)
      .pipe(
        takeWhile(() => this.alive))
      .subscribe(async () => {
        this.interval = 900000;
        if (this.testing.value || (moment().isAfter(moment(this.startTime)) &&
          moment().isBefore(moment(this.stopTime)))) {
          this.interval = this.defaultInterval;
          this.stockList.forEach((listItem, idx) => {
            setTimeout(() => {
              this.schedulerService.schedule(() => {
                if (this.alive) {
                  const stockTicker = listItem.label;

                  this.portfolioService.getPrice(stockTicker)
                    .pipe(take(1))
                    .subscribe((lastQuote) => {
                      this.runStrategy(stockTicker, 1 * lastQuote);
                    });
                }
              }, `${listItem.label}_smscard`, this.stopTime);
            }, 1000 * idx);
          });
        }

        if (!this.testing.value && (moment().isAfter(moment(this.stopTime)) &&
          moment().isBefore(moment(this.stopTime).add(2, 'minutes')))) {
          this.stop();
        }
      });
  }

  async runStrategy(ticker: string, lastPrice: number) {
    const getRecommendationSub = this.backtestService.getDaytradeRecommendation(ticker, lastPrice, lastPrice,
      { minQuotes: 81 }).subscribe(
        analysis => {
          this.processAnalysis(ticker, analysis, lastPrice, moment().valueOf());
          return null;
        },
        error => {
          this.error = 'Issue getting analysis.';
        }
      );

    this.subscriptions.push(getRecommendationSub);
  }

  sendBuy(ticker, message, price) {
    if (!this.lastSentSms[ticker] || moment().isAfter(moment(this.lastSentSms[ticker]).add(10, 'minutes'))) {
      this.lastSentSms[ticker] = moment().valueOf();
      this.messageService.add({ severity: 'success', life: 100000, summary: `Buy ${ticker}`, detail: `Time: ${moment().format('hh:mm')} ${message}` });
      if (!this.toastOnly.value) {
        this.clientSmsService.sendBuySms(ticker, this.phoneNumber.value, price, 1, message).subscribe(() => {
          this.messagesSent++;
        });
      }
    }
  }

  sendSell(ticker, message, price) {
    if (!this.lastSentSms[ticker] || moment().isAfter(moment(this.lastSentSms[ticker]).add(10, 'minutes'))) {
      this.lastSentSms[ticker] = moment().valueOf();

      this.messageService.add({ severity: 'error', life: 100000, summary: `Buy ${ticker}`, detail: `Time: ${moment().format('hh:mm')} ${message}` });
      if (!this.toastOnly.value) {
        this.clientSmsService.sendSellSms(ticker, this.phoneNumber.value, price, 1, message).subscribe(() => {
          this.messagesSent++;
        });
      }
    }
  }

  async processAnalysis(ticker: string, analysis, price, time) {
    if (this.buySellOption.value === 'buy_sell' || this.buySellOption.value === 'buy_only') {
      if (analysis.recommendation.toLowerCase() === 'buy') {
        this.machineLearningService.activate(ticker,
          this.globalSettingsService.daytradeAlgo)
          .subscribe((machineResult: { nextOutput: number }) => {
            const mlLog = `${ticker} @ ${moment().format('hh:mm')} RNN model result(${machineResult.nextOutput})`;
            console.log(mlLog);
            if (machineResult.nextOutput > 0.7) {
              console.log('Last sms sent: ', this.lastSentSms, moment(this.lastSentSms[ticker]).format());
              this.sendBuy(ticker, 'ml buy', price);
            }
          });
        setTimeout(() => {
          this.sendBuy(ticker, 'buy', price);
        }, 1000);
      }
    }
    if (this.buySellOption.value === 'buy_sell' || this.buySellOption.value === 'sell_only') {
      if (analysis.recommendation.toLowerCase() === 'sell') {
        this.sendSell(ticker, 'sell', price);
      }
    }

    if (this.messagesSent >= this.maxMessages.value) {
      this.stop();
    }
  }

  train(ticker) {
    this.machineLearningService
      .trainDaytrade(ticker.toUpperCase(),
        moment().add({ days: 1 }).format('YYYY-MM-DD'),
        moment().subtract({ days: 5 }).format('YYYY-MM-DD'),
        1,
        this.globalSettingsService.daytradeAlgo
      )
      .pipe(take(1))
      .subscribe((data: any[]) => {
      }, error => {
        console.log('daytrade ml error: ', error);
      });
    this.lastTrainedTime[ticker] = moment().valueOf();
  }

  runTraining() {
    this.stockList.forEach((listItem) => {
      this.schedulerService.schedule(() => {
        this.train(listItem.label);
      }, `smscard_training`);
    });
  }

  resetStepper() {
    this.activeIndex = 0;
    this.stop();
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '250px',
      data: { title: 'Confirm', message: 'Are you sure you want to execute this order?' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (this.sub) {
          this.sub.unsubscribe();
        }
        this.goLive();
      }
    });
  }

  setTest() {
    if (this.testing.value) {
      this.interval = 1000;
    }
  }

  initializeStartTime() {
    this.startTime = moment.tz(this.globalSettingsService.startTime, 'America/New_York').toDate();
    this.stopTime = moment.tz(this.globalSettingsService.stopTime, 'America/New_York').toDate();
  }

  setup() {
    this.interval = this.defaultInterval;
    this.messagesSent = 0;
    this.setDates();
  }

  stop() {
    this.alive = false;
    this.sub = null;
    this.setup();
  }

  setDates() {
    this.globalSettingsService.setStartTimes();

    const currentStartTime = moment.tz(this.startTime, 'America/New_York').format('HH:mm');
    const currentStopTime = moment.tz(this.stopTime, 'America/New_York').format('HH:mm');

    this.startTime = moment.tz(`${moment.tz(this.globalSettingsService.startTime, 'America/New_York').format('YYYY-MM-DD')} ${currentStartTime}`, 'America/New_York').toDate();
    this.stopTime = moment.tz(`${moment.tz(this.globalSettingsService.stopTime, 'America/New_York').format('YYYY-MM-DD')} ${currentStopTime}`, 'America/New_York').toDate();
  }

  addToList() {
    const tickers = this.stockFormControl.value.split(',');
    tickers.forEach(ticker => {
      this.stockList.push({ label: ticker.toUpperCase() });
    });
    if (this.stockFormControl.hasError('stock') || this.stockFormControl.hasError('required') || this.stockList.length === 0) {
      this.messageService.add({ severity: 'error', life: 1000, summary: 'Failed to add stock' });
    } else {
      this.setDates();
    }
  }

  removeFromList(name) {
    const idx = this.stockList.findIndex(element => element.label === name);
    this.stockList.splice(idx, 1);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub) {
        sub.unsubscribe();
      }
    });
  }
}
