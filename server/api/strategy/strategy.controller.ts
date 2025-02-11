import * as _ from 'lodash';

import BaseController from '../templates/base.controller';

import StrategyService from './strategy.service';

class StrategyController extends BaseController {

  constructor() {
    super();
  }

  getStrategy(request, response) {
    StrategyService.get()
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }

  setStrategy(request, response) {
    StrategyService.set(request.body.key, request.body.strategies)
    BaseController.requestGetSuccessHandler(response, {});
  }

  clear(request, response) {
    StrategyService.deleteOldRecords()
    BaseController.requestGetSuccessHandler(response, {});
  }
}

export default new StrategyController();
