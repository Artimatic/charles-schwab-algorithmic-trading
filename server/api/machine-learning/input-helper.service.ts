import AlgoService from "../backtest/algo.service";
import { Indicators } from "../backtest/backtest.constants";

class InputHelperService {

    convertMfiToInput(mfi: number): number[] {
        const arr = [];
        let counter = 0;
        while (counter < 10) {
            if (Math.floor(mfi / 10) === counter) {
                arr.push(1);
            } else {
                arr.push(0);
            }
            counter++;
        }

        return arr;
    }

    convertBBandToInput(price: number, bband): number[] {
        const lower = AlgoService.getLowerBBand(bband);
        const ma = AlgoService.getBBandMA(bband);
        const upper = AlgoService.getUpperBBand(bband);

        return [
            price > upper ? 1 : 0,
            price < lower ? 1 : 0,
            price > ma ? 1 : 0,
            price < ma ? 1 : 0
        ];
    }

    convertRsiToInput(rsi): number[] {
        const arr = [];
        let counter = 0;
        while (counter < 10) {
            if (Math.floor(rsi[0][0] / 10) === counter) {
                arr.push(1);
            } else {
                arr.push(0);
            }
            counter++;
        }

        return arr;
    }

    convertVwmaToInput(vwma: number, price: number): number[] {
        return [
            price > vwma ? 1 : 0,
            price < vwma ? 1 : 0
        ];
    }

    roc(roc10: number, roc10Previous: number): number[] {
        return [
            roc10 > 0 ? 1 : 0,
            roc10Previous > 0 ? 1 : 0,
            roc10 > roc10Previous ? 1 : 0
        ];
    }

  checkMacd(macd1, macdPrevious): number[] {
    if (macd1 && macdPrevious) {
      const macd = macd1[2];
      const prevMacd = macdPrevious[2];

      if (macd[macd.length - 1] >= prevMacd[prevMacd.length - 1]) {
        return [1, 0];
      } else if (macd[macd.length - 1] < prevMacd[prevMacd.length - 1]) {
        return [0, 1];
      }
    }
    return [0, 0];
  }
}

export default new InputHelperService();