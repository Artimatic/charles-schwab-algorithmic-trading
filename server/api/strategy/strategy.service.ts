import DatabaseService from '../mongodb/database.service';


class StrategyService {

  constructor() {}

  async get() {
    return await DatabaseService.getRecords('stock_portfolio', 'strategies');
  }

  set(key, strategy) {
    DatabaseService.update(strategy, 'stock_portfolio', 'strategies',  { key });
  }

  deleteOldRecords() {
    DatabaseService.deleteOldRecords('stock_portfolio', 'strategies');
  }
}

export default new StrategyService();
