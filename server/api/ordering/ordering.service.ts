
import * as _ from 'lodash';

import PortfolioService from '../portfolio/portfolio.service';

class OrderingService {
  getRecommendationAndOrderStock(stock, quantity, 
    stopLoss, trailingStop, 
    takeProfit, orderSize, 
    orderType) {
    return PortfolioService.getPortfolio()
      .then((portfolio) => {
        return this.getRecommendation(portfolio);
      })
      .then((recommendation) => {
        return this.createOrder(recommendation);
      });
  }
}

export default new OrderingService();
