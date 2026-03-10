import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';
import { PortfolioService, ReportingService, ScoreKeeperService } from '@shared/services';
import { AutopilotService, ProfitLossRecord } from './autopilot.service';
import { RiskManagementService } from './risk-management.service';
import { StrategyManagementService } from './strategy-management.service';
import { PriceTargetService } from './price-target.service';

/** Context for session reporting (component provides lastPrintFinalResults get/set). */
export interface ISessionReportingContext {
  getLastPrintFinalResults(): moment.Moment | null;
  setLastPrintFinalResults(value: moment.Moment | null): void;
}

/**
 * Handles end-of-session reporting: print final results, persist profit/loss, and reset cart.
 * Used by the orchestration loop and component to avoid duplicating score/reporting/portfolio deps in the component.
 */
@Injectable({
  providedIn: 'root'
})
export class AutopilotSessionReportingService {
  constructor(
    private strategyManagementService: StrategyManagementService,
    private scoreKeeperService: ScoreKeeperService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService,
    private autopilotService: AutopilotService,
    private riskManagementService: RiskManagementService,
    private priceTargetService: PriceTargetService
  ) {}

  async printFinalResults(context: ISessionReportingContext): Promise<void> {
    this.strategyManagementService.addCurrentHoldingsToAuditLog();
    const profitLog = `Profit ${this.scoreKeeperService.total}`;
    this.reportingService.addAuditLog(null, profitLog);
    this.reportingService.exportAuditHistory();
    await this.setProfitLoss();
    this.scoreKeeperService.resetTotal();
    this.strategyManagementService.resetCart();
    const now = moment();
    context.setLastPrintFinalResults(now);
    localStorage.setItem('lastPrintFinalResults', now.format());
    setTimeout(async () => {
      await this.autopilotService.handleStrategy();
    }, 10800000);
  }

  calculatePl(records: { [key: string]: number }): number {
    return Object.values(records)
      .filter(value => value)
      .reduce((sum, value) => sum + Number(value.toFixed(2)), 0);
  }

  async setProfitLoss(): Promise<void> {
    const hasMetTarget = await this.priceTargetService.hasMetPriceTarget(0.001);
    await this.riskManagementService.modifyRisk(hasMetTarget);

    const tempProfitRecord = this.scoreKeeperService.profitLossHash;
    let profit = 0;
    if (tempProfitRecord) {
      profit = this.calculatePl(tempProfitRecord);
    }
    const profitObj: ProfitLossRecord = {
      date: moment().format(),
      profit,
      lastStrategy: this.autopilotService.strategyList[this.autopilotService.strategyCounter],
      lastRiskTolerance: this.autopilotService.riskCounter,
      profitRecord: tempProfitRecord
    };
    localStorage.setItem('profitLoss', JSON.stringify(profitObj));
    const accountId = sessionStorage.getItem('accountId');
    this.portfolioService.updatePortfolioProfitLoss(
      accountId || null,
      profitObj.date,
      profitObj.lastRiskTolerance,
      profitObj.lastStrategy,
      profitObj.profit
    ).subscribe();
  }
}
