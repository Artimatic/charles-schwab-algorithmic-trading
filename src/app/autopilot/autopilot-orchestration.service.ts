import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';
import { of, Subject, Subscription, timer } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { PortfolioService, ReportingService } from '@shared/services';
import { AiPicksService } from '@shared/services/ai-picks.service';
import { AutopilotService } from './autopilot.service';
import { PriceTargetService } from './price-target.service';
import { RiskManagementService } from './risk-management.service';
import { SignalsStateService } from '../strategies/signals-state.service';
import { StrategyManagementService } from './strategy-management.service';

/** Context provided by the component for orchestration callbacks and mutable state. */
export interface IAutopilotOrchestrationContext {
  getLastPrintFinalResults(): moment.Moment | null;
  setLastPrintFinalResults(value: moment.Moment | null): void;
  getIsOpenMarket(): boolean;
  setIsOpenMarket(value: boolean): void;
  printFinalResults(): Promise<void>;
  setupStrategy(): Promise<void>;
  backtestOneStock(overwrite: boolean, addTrade: boolean): Promise<void>;
  buySellAtCloseOrOpen(): Promise<void>;
  addCurrentHoldingsToAuditLog(): void;
  decreaseRiskTolerance(): void;
}

/**
 * Runs the autopilot timer loop and branches (credentials, buy-at-close, session end,
 * intraday, strategy setup, default backtest). Delegates actions to context and services.
 */
@Injectable({
  providedIn: 'root'
})
export class AutopilotOrchestrationService {
  private timerSubscription: Subscription | null = null;
  private intervalMs = 60000;

  constructor(
    private autopilotService: AutopilotService,
    private signalsStateService: SignalsStateService,
    private reportingService: ReportingService,
    private messageService: MessageService,
    private portfolioService: PortfolioService,
    private aiPicksService: AiPicksService,
    private priceTargetService: PriceTargetService,
    private strategyManagementService: StrategyManagementService,
    private riskManagementService: RiskManagementService
  ) {}

  /**
   * Starts the orchestration loop. Caller must have already run setup (setupStrategy, handleStrategy, reset).
   * Returns the subscription so the caller can assign it for cleanup.
   */
  start(
    context: IAutopilotOrchestrationContext,
    intervalMs: number,
    destroy$: Subject<void>
  ): Subscription {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    this.intervalMs = intervalMs;

    this.timerSubscription = timer(1000, intervalMs)
      .pipe(takeUntil(destroy$))
      .subscribe(async () => this.onTick(context));

    return this.timerSubscription;
  }

  stop(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  private async onTick(context: IAutopilotOrchestrationContext): Promise<void> {
    const state = this.signalsStateService.getState();
    const currentTime = moment();

    await this.maybeRunPeriodicPrintFinalResults(context);
    const branch = this.selectBranch(state, currentTime);
    if (branch === 'credential_check') {
      await this.handleCredentialCheck(context);
    } else if (branch === 'buy_at_close') {
      await this.handleBuyAtClose(context);
    } else if (branch === 'session_end') {
      await this.handleSessionEnd(context);
    } else if (branch === 'intraday') {
      await this.handleIntraday(context);
    } else if (branch === 'strategy_setup') {
      await this.handleStrategySetup(context);
    } else {
      await this.handleDefault(context);
    }
  }

  private async maybeRunPeriodicPrintFinalResults(context: IAutopilotOrchestrationContext): Promise<void> {
    const currentTime = moment();
    const lastPrint = context.getLastPrintFinalResults();
    if (lastPrint && currentTime.diff(lastPrint, 'hours') < 24) {
      return;
    }
    console.log('More than 24 hours since last printFinalResults run — running it again now.');
    context.setLastPrintFinalResults(moment());
    try {
      if (this.reportingService.logs.length > 15) {
        await context.printFinalResults();
      }
    } catch (err) {
      console.log('Error running periodic printFinalResults', err);
    }
  }

  private selectBranch(
    state: { lastCredentialCheck?: Date | null; boughtAtClose: boolean; developedStrategy: boolean; lastProfitCheck: Date },
    currentTime: moment.Moment
  ): 'credential_check' | 'buy_at_close' | 'session_end' | 'intraday' | 'strategy_setup' | 'default' {
    if (!state.lastCredentialCheck || Math.abs(moment(state.lastCredentialCheck).diff(currentTime, 'minutes')) > 10) {
      return 'credential_check';
    }
    const sessionEnd = moment(this.autopilotService.sessionEnd);
    if (currentTime.isAfter(sessionEnd.clone().subtract(25, 'minutes')) && currentTime.isBefore(sessionEnd.clone().subtract(20, 'minutes'))) {
      return 'buy_at_close';
    }
    if (currentTime.isAfter(sessionEnd) && currentTime.isBefore(moment(this.autopilotService.sessionEnd).add(15, 'minute'))) {
      return 'session_end';
    }
    if (this.autopilotService.isIntradayTrading()) {
      return 'intraday';
    }
    const sessionStart = moment(this.autopilotService.sessionStart);
    const preSessionWindow = this.intervalMs * 2 / 60000; // minutes
    if (!state.developedStrategy && currentTime.isAfter(sessionStart.clone().subtract(preSessionWindow, 'minutes')) && currentTime.isBefore(sessionStart)) {
      return 'strategy_setup';
    }
    return 'default';
  }

  private async handleCredentialCheck(context: IAutopilotOrchestrationContext): Promise<void> {
    this.autopilotService.isMarketOpened().pipe(
      catchError(err => {
        console.log('Error getting market status', err);
        this.messageService.add({ severity: 'error', summary: 'Error getting market status', life: 3600000 });
        this.signalsStateService.update({ type: 'ERROR', payload: 'Error getting market status' });
        return of('Error getting market status');
      })
    ).subscribe(marketStatus => {
      if (marketStatus) {
        this.signalsStateService.update({ type: 'MARKET_STATUS', payload: marketStatus });
      }
    });

    try {
      const holdings = await this.autopilotService.setCurrentHoldings();
      this.signalsStateService.update({ type: 'HOLDINGS', payload: holdings });
      await this.portfolioService.getTdBalance().toPromise();
    } catch (err) {
      console.log('Error positions', err);
      this.messageService.add({ severity: 'error', summary: 'Error getting positions' });
      this.signalsStateService.update({ type: 'ERROR', payload: 'Error getting positions' });
      setTimeout(async () => {
        try {
          const retryHoldings = await this.autopilotService.setCurrentHoldings();
          this.signalsStateService.update({ type: 'HOLDINGS', payload: retryHoldings });
        } catch (retryErr) {
          this.messageService.add({ severity: 'error', summary: 'Please sign in again', life: 900000 });
          this.signalsStateService.update({ type: 'ERROR', payload: 'Authentication failed' });
        }
      }, 25000);
    }

    this.signalsStateService.update({ type: 'CREDENTIALS', payload: null });
    await context.backtestOneStock(true, false);
  }

  private async handleBuyAtClose(context: IAutopilotOrchestrationContext): Promise<void> {
    const state = this.signalsStateService.getState();
    console.log('Buy on close');
    if (!state.boughtAtClose) {
      await context.buySellAtCloseOrOpen();
    }
    this.signalsStateService.update({ type: 'CLOSE_TRADE', payload: true });
  }

  private async handleSessionEnd(context: IAutopilotOrchestrationContext): Promise<void> {
    if (this.reportingService.logs.length > 15) {
      await context.printFinalResults();
    }
    context.setIsOpenMarket(false);
  }

  private async handleIntraday(context: IAutopilotOrchestrationContext): Promise<void> {
    const state = this.signalsStateService.getState();
    context.setIsOpenMarket(true);
    if (moment().diff(state.lastProfitCheck, 'minutes') > 7) {
      this.signalsStateService.update({ type: 'PROFIT', payload: null });
      const metTarget = await this.priceTargetService.checkProfitTarget(state.currentHoldings);
      if (metTarget) {
        context.addCurrentHoldingsToAuditLog();
        context.decreaseRiskTolerance();
      }
    } else {
      this.signalsStateService.update({ type: 'INTRADAY_CHECK', payload: true });
    }
  }

  private async handleStrategySetup(context: IAutopilotOrchestrationContext): Promise<void> {
    await context.setupStrategy();
    this.signalsStateService.update({ type: 'STRATEGY', payload: true });
    context.setIsOpenMarket(false);
  }

  private async handleDefault(context: IAutopilotOrchestrationContext): Promise<void> {
    const state = this.signalsStateService.getState();
    const currentTime = moment();
    if (state.lastCredentialCheck && Math.abs(moment(state.lastCredentialCheck).diff(currentTime, 'minutes')) > 50) {
      this.aiPicksService.mlNeutralResults.next(null);
    }
    await context.backtestOneStock(false, false);
    context.setIsOpenMarket(false);
  }
}
