import BacktestController from './backtest.controller';

export const backtest = (request, response) => {
  BacktestController.backtest(request, response);
};

export const getMeanReversionChart = (request, response) => {
  BacktestController.getMeanReversionChart(request, response);
};

export const indicator = (request, response) => {
  BacktestController.getIndicator(request, response);
};

export const infoV2 = (request, response) => {
  BacktestController.getInfoV2(request, response);
};

export const infoV2Chart = (request, response) => {
  BacktestController.getInfoV2Chart(request, response);
};

export const timeline = (request, response) => {
  BacktestController.getHistoricalMatches(request, response);
};

export const sma = (request, response) => {
  BacktestController.getSMA(request, response);
};

export const roc = (request, response) => {
  BacktestController.getRateOfChange(request, response);
};

export const mfi = (request, response) => {
  BacktestController.getMfi(request, response);
};

export const vwma = (request, response) => {
  BacktestController.getVwma(request, response);
};
