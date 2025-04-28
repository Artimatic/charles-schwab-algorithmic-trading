import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';
import { PriceTargetService } from '../autopilot/price-target.service';
import { BacktestService, ReportingService } from '@shared/services';
import { OrderHandlingService } from '../order-handling/order-handling.service';

@Injectable({
  providedIn: 'root'
})
export class IntradayStrategyService {
  intradayStrategyTriggered = false;
  lastVolume = 0;
  constructor(private priceTargetService: PriceTargetService,
    private backtestService: BacktestService,
    private reportingService: ReportingService,
    private orderHandlingService: OrderHandlingService
  ) { }

  async buyTqqq(currentAllocation: number, reason: string) {
    this.reportingService.addAuditLog(null, reason);

    const tqqq = {
      name: 'TQQQ',
      pl: 0,
      netLiq: 0,
      shares: 0,
      alloc: 0,
      recommendation: 'None',
      buyReasons: '',
      sellReasons: '',
      buyConfidence: 0,
      sellConfidence: 0,
      prediction: null
    }
    await this.orderHandlingService.addBuy(tqqq, currentAllocation, reason);
  }

  async buySqqq(currentAllocation: number, reason: string) {
    this.reportingService.addAuditLog(null, reason);

    const sqqq = {
      name: 'SQQQ',
      pl: 0,
      netLiq: 0,
      shares: 0,
      alloc: 0,
      recommendation: 'None',
      buyReasons: '',
      sellReasons: '',
      buyConfidence: 0,
      sellConfidence: 0,
      prediction: null
    }
    await this.orderHandlingService.addBuy(sqqq, currentAllocation, reason);
  }

  async buyDip(currentAllocation: number) {
    const isDown = await this.priceTargetService.isDownDay();
    if (isDown) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      const spyBacktest = await this.backtestService.getBacktestEvaluation('SPY', startDate, currentDate, 'daily-indicators').toPromise();
      const vxxBacktest = await this.backtestService.getBacktestEvaluation('VXX', startDate, currentDate, 'daily-indicators').toPromise();
      const spySignal = spyBacktest.signals[spyBacktest.signals.length - 1];
      const vxxSignal = vxxBacktest.signals[vxxBacktest.signals.length - 1];
      if (spySignal.mfiPrevious < spySignal.mfiLeft &&
        spySignal?.bband80[1][0] < spySignal.close &&
        spySignal?.support[0] < spySignal.close &&
        vxxSignal.mfiPrevious < vxxSignal.mfiLeft &&
        vxxSignal?.bband80[1][0] < vxxSignal.close &&
        vxxSignal?.support[0] < vxxSignal.close) {
        this.intradayStrategyTriggered = true;

        await this.buyTqqq(currentAllocation, 'Buy the dip');
      }
    }
  }

  async buyOnVolume(currentAllocation: number) {
    const symbol = 'SPY';
    const priceObj = await this.backtestService.getLastPriceTiingo({ symbol }).toPromise();
    const currentVolume = priceObj[symbol].quote.totalVolume;
    if (this.lastVolume && (currentVolume / this.lastVolume) > 10) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      const spyBacktest = await this.backtestService.getBacktestEvaluation('SPY', startDate, currentDate, 'daily-indicators').toPromise();
      const spySignal = spyBacktest.signals[spyBacktest.signals.length - 1];

      if (spySignal.mfiPrevious > spySignal.mfiLeft) {
        await this.buySqqq(currentAllocation, 'Buy on volume');
      } else {
        await this.buyTqqq(currentAllocation, 'Buy on volume');
      }
    }

    this.lastVolume = currentVolume;
  }

  async checkIntradayStrategies(currentAllocation: number) {
    if (moment().isAfter(moment().tz('America/New_York').set({ hour: 10, minute: 35 })) &&
      moment().isBefore(moment().tz('America/New_York').set({ hour: 11, minute: 15 }))) {
      if (this.intradayStrategyTriggered) {
        return;
      }
      await this.buyDip(currentAllocation);
    } else if (moment().isAfter(moment().tz('America/New_York').set({ hour: 14, minute: 45 })) &&
      moment().isBefore(moment().tz('America/New_York').set({ hour: 16, minute: 0 }))) {

      this.intradayStrategyTriggered = false;
    } else if (moment().isAfter(moment().tz('America/New_York').set({ hour: 10, minute: 0 })) &&
      moment().isBefore(moment().tz('America/New_York').set({ hour: 16, minute: 0 }))) {
      if (this.intradayStrategyTriggered) {
        return;
      }
      await this.buyOnVolume(currentAllocation);
    }
  }
}
