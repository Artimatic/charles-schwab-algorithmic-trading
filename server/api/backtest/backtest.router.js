const BacktestController = require('./backtest.controller').default;

const backtest = (request, response) => {
  BacktestController.backtest(request, response);
};

const getMeanReversionChart = (request, response) => {
  BacktestController.getMeanReversionChart(request, response);
};

const indicator = (request, response) => {
  BacktestController.getIndicator(request, response);
};

const infoV2 = (request, response) => {
  BacktestController.getInfoV2(request, response);
};

const infoV2Chart = (request, response) => {
  BacktestController.getInfoV2Chart(request, response);
};

const timeline = (request, response) => {
  BacktestController.getHistoricalMatches(request, response);
};

const sma = (request, response) => {
  BacktestController.getSMA(request, response);
};

const roc = (request, response) => {
  BacktestController.getRateOfChange(request, response);
};

const mfi = (request, response) => {
  BacktestController.getMfi(request, response);
};

const vwma = (request, response) => {
  BacktestController.getVwma(request, response);
};

module.exports = {
  backtest,
  getMeanReversionChart,
  indicator,
  infoV2,
  infoV2Chart,
  timeline,
  sma,
  roc,
  mfi,
  vwma
};
