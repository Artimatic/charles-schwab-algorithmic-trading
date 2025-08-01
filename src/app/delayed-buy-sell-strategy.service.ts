import { Injectable } from '@angular/core';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class DelayedBuySellStrategyService {

  constructor() { }

  addDelayedSell(stocks: string[]) {
    const delayedSells = this.getDelayedSells();
    stocks.forEach(stock => {
      const sellDate = moment().add(3, 'days').format('YYYY-MM-DD');
      delayedSells.push({ stock, date: sellDate });
    });
    localStorage.setItem(`delayedSells`, JSON.stringify(delayedSells));
  }

  getDelayedSells() {
    let delayedSells = JSON.parse(localStorage.getItem('delayedSells') || '[]');
    const today = moment();
    delayedSells = delayedSells.filter(item => {
      const sellDate = moment(item.date, 'YYYY-MM-DD');
      return sellDate.isSameOrAfter(today, 'day');
    });
    return delayedSells;
  }

  getTodaysDelayedSells(): string[] {
    const delayedSells = JSON.parse(localStorage.getItem('delayedSells') || '[]');
    const today = moment().format('YYYY-MM-DD');
    return delayedSells
      .filter(item => item.date === today)
      .map(item => item.stock);
  }
}