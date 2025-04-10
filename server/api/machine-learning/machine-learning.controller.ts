import * as _ from 'lodash';
import * as moment from 'moment';

import BaseController from '../templates/base.controller';
import TrainingService from './training.service';
import IntradayPredicationService from './intraday-prediction.service';
import DailyPredicationService from './daily-prediction.service';
import VariableDailyPredicationService from './variable-daily-prediction.service';
import PairTradingPrediction from './pair-trading-prediction.service';
import BearPredictionService from './bear-prediction.service';
import BullPredictionService from './bull-prediction.service';
import VolatilityPredictionService from './volatility-prediction.service';
import MfiPredictionService from './mfi-prediction.service';

class MachineLearningController extends BaseController {

  constructor() {
    super();
  }

  getTrainingDataSetV2(request, response) {
    TrainingService.train(request.query.symbol, request.query.startDate, request.query.endDate)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => {
        console.log('Error getTrainingDataSetV2: ', err);
        return BaseController.requestErrorHandler(response, err);
      });
  }

  activateWithIntradayData(request, response) {
    TrainingService.trainWithIntraday(request.query.symbol)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getDailyActivationData(request, response) {
    TrainingService.getDailyActivationData(request.query.symbol)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getCurrentIntradayActivationData(request, response) {
    TrainingService.getCurrentIntradayActivationData(request.query.symbol)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  testV2Model(request, response) {
    TrainingService.testModel(request.query.symbol, request.query.startDate, request.query.endDate, request.query.trainingSize)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  activateBuyAtCloseModel(request, response) {
    TrainingService.activateBuyAtCloseModel(request.body.symbol, request.body.startDate, request.body.inputData)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  async activateV2Model(request, response) {
    const result = await TrainingService.activateModel(request.query.symbol, request.query.startDate);
    response.status(200).send(result);
  }

  trainV3(request, response) {
    const features = request.query.features ? request.query.features.split(',') : null;

    IntradayPredicationService.train(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainDailyV3(request, response) {
    const features = request.query.features ? request.query.features.split(',') : null;

    DailyPredicationService.train(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data));
  }

  activateV3(request, response) {
    const features = request.query.features ? request.query.features.split(',') : null;

    IntradayPredicationService.activate(request.query.symbol, features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getQuotes(request, response) {
    const start = moment(request.query.startDate).valueOf();
    const end = moment(request.query.endDate).valueOf();

    IntradayPredicationService.getQuotes(request.query.symbol, start, end)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getIndicators(request, response) {
    IntradayPredicationService.getIndicators(request.body.quotes)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }


  activateModel(request, response) {
    console.log('activate model controller: ', request.body);
    IntradayPredicationService.activateModel(request.body.symbol, request.body.indicatorData, request.body.features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  activateDailyV3(request, response) {
    const features = request.query.features ? request.query.features.split(',') : null;

    DailyPredicationService.activate(request.query.symbol, features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainDailyV4(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    VariableDailyPredicationService.setOutputLimit(Number(request.query.limit));
    VariableDailyPredicationService.setOutputRange(Number(request.query.range));
    VariableDailyPredicationService.train(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainDailyTradingPair(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    PairTradingPrediction.setOutputLimit(Number(request.query.limit));
    PairTradingPrediction.setOutputRange(Number(request.query.range));
    PairTradingPrediction.train(request.query.symbol1,
      request.query.symbol2,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainDailyBear(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    BearPredictionService.setOutputLimit(Number(request.query.limit));
    BearPredictionService.setOutputRange(Number(request.query.range));
    BearPredictionService.train(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainDailyBull(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    BullPredictionService.setOutputLimit(Number(request.query.limit));
    BullPredictionService.setOutputRange(Number(request.query.range));
    BullPredictionService.train(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  activateDailyBull(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    BullPredictionService.setOutputLimit(Number(request.query.limit));
    BullPredictionService.setOutputRange(Number(request.query.range));
    BullPredictionService.activate(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  activateDailyBear(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    BearPredictionService.setOutputLimit(Number(request.query.limit));
    BearPredictionService.setOutputRange(Number(request.query.range));
    BearPredictionService.activate(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainVolitility(request, response) {
    VolatilityPredictionService.setOutputLimit(Number(request.query.limit));
    VolatilityPredictionService.setOutputRange(Number(request.query.range));
    VolatilityPredictionService.train(request.query.startDate,
      request.query.endDate,
      request.query.trainingSize)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  trainMfi(request, response) {
    MfiPredictionService.setOutputLimit(Number(request.query.limit));
    MfiPredictionService.setOutputRange(Number(request.query.range));
    MfiPredictionService.train(request.query.symbol, 
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getTrainingDataDailyV4(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    VariableDailyPredicationService.setOutputLimit(Number(request.query.limit));
    VariableDailyPredicationService.setOutputRange(Number(request.query.range));
    VariableDailyPredicationService.getDataSet(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      request.query.trainingSize,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  scoreDailyV4(request, response) {
    const features = request.query.features && request.query.features !== 'null' ? request.query.features.split(',') : null;

    VariableDailyPredicationService.scoreV4(request.query.symbol,
      request.query.startDate,
      request.query.endDate,
      features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  activateDailyV4(request, response) {
    const features = request.query.features ? request.query.features.split(',') : null;
    VariableDailyPredicationService.setOutputLimit(request.query.limit);
    VariableDailyPredicationService.setOutputRange(request.query.range);
    VariableDailyPredicationService.activate(request.query.symbol, features)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getTrainingData(request, response) {
    TrainingService.getTrainingData(request.query.symbol, request.query.startData, request.query.endData)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  getFoundPatterns(request, response) {
    BaseController.requestGetSuccessHandler(response, VariableDailyPredicationService.getFoundPatterns());
  }

}

export default new MachineLearningController();
