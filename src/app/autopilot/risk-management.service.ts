import { Injectable } from '@angular/core';
import { AutopilotService } from './autopilot.service';
import { ReportingService } from '@shared/services';
import { RiskTolerance } from './risk-tolerance.enum';

/**
 * RiskManagementService manages all risk-related operations including:
 * - Adjusting risk tolerance levels
 * - Day trading risk tolerance
 * - Martingale execution for risk increases
 * - Profit target checks
 */
@Injectable({
  providedIn: 'root'
})
export class RiskManagementService {
  private dayTradeRiskCounter = 0;

  private readonly dayTradingRiskToleranceList = [
    RiskTolerance.Low,
    RiskTolerance.ExtremeFear,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.ExtremeGreed
  ];

  constructor(
    private autopilotService: AutopilotService,
    private reportingService: ReportingService
  ) {
    this.initializeDayTradeRiskCounter();
  }

  /**
   * Initializes day trade risk counter from saved state
   */
  private initializeDayTradeRiskCounter(): void {
    const savedCounter = localStorage.getItem('dayTradeRiskCounter');
    if (savedCounter !== null) {
      this.dayTradeRiskCounter = parseInt(savedCounter, 10);
    }
  }

  /**
   * Gets the current day trading risk tolerance
   */
  getDayTradeRiskTolerance(): RiskTolerance {
    return this.dayTradingRiskToleranceList[this.dayTradeRiskCounter];
  }

  /**
   * Gets the current day trade risk counter
   */
  getDayTradeRiskCounter(): number {
    return this.dayTradeRiskCounter;
  }

  /**
   * Resets standard risk level to initial state
   * Called when profit targets are met
   */
  decreaseRiskTolerance(): void {
    this.autopilotService.resetRiskLevel();
    const msg = `Decrease risk to ${this.autopilotService.riskLevel}`;
    console.log(msg);
    this.reportingService.addAuditLog(
      this.autopilotService.strategyList[this.autopilotService.strategyCounter],
      msg
    );
    this.autopilotService.saveRisk();
  }

  /**
   * Resets day trade risk to the lowest level
   * Called when day trades underperform
   */
  decreaseDayTradeRiskTolerance(): void {
    if (this.dayTradeRiskCounter > 0) {
      this.dayTradeRiskCounter = 0;
      this.saveDayTradeRiskCounter();
    }
  }

  /**
   * Increases standard risk tolerance using martingale strategy
   * Called when profit targets are not met
   */
  async increaseRiskTolerance(): Promise<void> {
    await this.autopilotService.executeMartingale();
    const msg = `Increase risk to ${this.autopilotService.riskLevel}`;
    console.log(msg);
    this.reportingService.addAuditLog(
      this.autopilotService.strategyList[this.autopilotService.strategyCounter],
      msg
    );
  }

  /**
   * Increases day trade risk tolerance to next level
   * Called when day trades are performing well
   */
  increaseDayTradeRiskTolerance(): void {
    if (this.dayTradeRiskCounter < this.dayTradingRiskToleranceList.length - 1) {
      this.dayTradeRiskCounter++;
      this.saveDayTradeRiskCounter();
    }
  }

  /**
   * Modifies risk based on profit target achievement
   * - Increases if targets not met
   * - Decreases day trade risk if targets not met
   * - Increases day trade risk if targets are met
   */
  async modifyRisk(hasMetTarget: boolean): Promise<void> {
    try {
      if (!hasMetTarget) {
        this.decreaseDayTradeRiskTolerance();
        await this.increaseRiskTolerance();
      } else {
        this.increaseDayTradeRiskTolerance();
      }
    } catch (error) {
      console.log('Error modifying risk', error);
      await this.increaseRiskTolerance();
    }
  }

  /**
   * Resets all risk to default state
   */
  resetAllRisk(): void {
    this.dayTradeRiskCounter = 0;
    this.saveDayTradeRiskCounter();
    this.autopilotService.resetRiskLevel();
  }

  /**
   * Saves day trade risk counter to local storage
   */
  private saveDayTradeRiskCounter(): void {
    localStorage.setItem('dayTradeRiskCounter', this.dayTradeRiskCounter.toString());
  }

  /**
   * Gets all day trading risk tolerance options
   */
  getAllDayTradingRiskTolerances(): RiskTolerance[] {
    return this.dayTradingRiskToleranceList.slice();
  }
}
