import BaseController from '../templates/base.controller';
import orderingService from './ordering.service';

class OrderingController extends BaseController {

  constructor() {
    super();
  }

  processOrder(request, response) {
    orderingService.processStockRecommendation(request.body.order)
      .then((data) => BaseController.requestGetSuccessHandler(response, data))
      .catch((err) => BaseController.requestErrorHandler(response, err));
  }
}

export default new OrderingController();
