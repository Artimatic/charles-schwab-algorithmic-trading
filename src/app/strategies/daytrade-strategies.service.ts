import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DaytradeStrategiesService {
  skipNextCheck = {};
  constructor() { }

  potentialBuy(analysis) {
    return (analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft < 30) ||
    analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
      analysis.data.indicator.close < (1.1 * analysis.data.indicator.bband80[0][0]));
  }

  potentialSell(analysis) {
    return (analysis.data.indicator.mfiLeft && analysis.data.indicator.mfiLeft > 65) ||
    analysis.data.indicator.bbandBreakout || (analysis.data.indicator.bband80[0][0] &&
      analysis.data.indicator.close > (0.9 * analysis.data.indicator.bband80[2][0]));
  }

  analyse(analysis) {
    if (this.potentialBuy(analysis) || this.potentialSell(analysis)) {
      this.skipNextCheck[analysis.name] = false;  
    } else {
      this.skipNextCheck[analysis.name] = true;  
    }
    return analysis
  }

  shouldSkip(name: string) {
    const skip = Boolean(this.skipNextCheck[name]);
    this.skipNextCheck[name] = false;
    return skip;
  }
}
