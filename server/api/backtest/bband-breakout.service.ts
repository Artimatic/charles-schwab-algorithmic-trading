import * as _ from 'lodash';
import * as tulind from 'tulind';

class BBandBreakoutService {
  async isBreakout(quotes, previousMfi: number, currentMfi: number, currentBBand, bbandPeriod) {
    if (previousMfi < 16 && currentMfi > previousMfi){
        return this.getBBands(quotes.slice(1, -1), bbandPeriod, 2)
        .then(previousBband => {
          console.log('previousBband', previousBband);
          console.log('currentBBand', currentBBand);
          console.log('currentMfi', currentMfi);
          console.log('previousMfi', previousMfi);
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
    return false;
  }

  getBBands(real, period, stddev) {
    return tulind.indicators.bbands.indicator([real], [period, stddev]);
  }
}

export default new BBandBreakoutService();
