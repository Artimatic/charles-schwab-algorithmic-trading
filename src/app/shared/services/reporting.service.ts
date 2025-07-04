import { Injectable } from '@angular/core';
import { Stock } from '@shared/stock.interface';
import * as moment from 'moment';
import { ExcelService } from './excel-service.service';

@Injectable()
export class ReportingService {
  public logs = [];
  public backtestResults = [];

  constructor(private excelService: ExcelService) { }

  addAuditLog(symbol, message, reason = '') {
    const currentTime = moment().format('DD.MM.YYYY HH:MM:SS');
    const log = { time: currentTime, symbol: symbol, message: message, reason: reason };
    this.logs.push(log);
    return log;
  }

  exportAuditHistory() {
    const today = moment().format('MM-DD-YY');
    console.log('printing logs: ', this.logs);
    const accountId = sessionStorage.getItem('accountId');
    this.excelService.exportAsExcelFile(this.logs, `${accountId || 'default'}_logs_${today}`);
    this.clearLogs();
  }

  clearLogs() {
    this.logs = [];
  }

  addBacktestResults(results: Stock, selectedColumns = []) {
    const buySignals = results.buySignals.reduce((previousValue, currentValue, currentIndex) => {
      return previousValue + currentValue + (currentIndex < results.buySignals.length - 1 ? ',' : '');
    }, '');

    const sellSignals = results.sellSignals.reduce((previousValue, currentValue, currentIndex) => {
      return previousValue + currentValue + (currentIndex < results.sellSignals.length - 1 ? ',' : '');
    }, '');

    let log = {
      'Stock': results.stock,
      'Buy': buySignals,
      'Sell': sellSignals,
      'Returns': results.returns,
      'Implied Movement': results.impliedMovement,
      'Previous Implied Move': results.previousImpliedMovement,
      'AI Prediction': JSON.stringify(results.ml),
      'Options Volume': results.optionsVolume,
      'Market Cap': results.marketCap,
      '52 Week High': results.high52,
      'Options Chain Length': results.optionsChainLength
    };
    if (selectedColumns.length > 0) {
      selectedColumns.forEach((column: {field: string, header: string}) => {
        if (!log[column.header]) {
          log[column.header] = results[column.field];
        }
      });
    }

    this.backtestResults.push(log);
    return log;
  }

  exportBacktestResults() {
    const today = moment().format('MM-DD-YY');

    this.excelService.exportAsExcelFile(this.backtestResults, `recommendation_${today}`);
    this.clearBacktestResults();
  }

  clearBacktestResults() {
    this.backtestResults = [];
  }
}
