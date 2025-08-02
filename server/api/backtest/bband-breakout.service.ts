import * as _ from 'lodash';
import * as tulind from 'tulind';

class BBandBreakoutService {
  async isBreakout(quotes, currentBBand, bbandPeriod) {
      return this.getBBands(quotes.slice(0, -1), bbandPeriod, 2)
        .then(previousBband => {
          if (previousBband.length && previousBband[0].length) {
            if (quotes[quotes.length - 2] < previousBband[0][0] && quotes[quotes.length - 1] > currentBBand[0][0]) {
              return true;
            }
          } else if (quotes[quotes.length - 2] < currentBBand[0][0] && quotes[quotes.length - 1] > currentBBand[0][0]) {
            return true;
          }
          return false;
        }); 
  }

  getBBands(real, period, stddev) {
    return tulind.indicators.bbands.indicator([real], [period, stddev]);
  }
}

export default new BBandBreakoutService();
