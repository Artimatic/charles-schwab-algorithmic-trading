import PortfolioController from './portfolio.controller';

export const portfolio = (request, response) => {
  PortfolioController.getPortfolio(request, response);
};

export const positions = (request, response) => {
  PortfolioController.getPositions(request, response);
};

export const login = (request, response) => {
  PortfolioController.login(request, response);
};

export const postLogin = (request, response) => {
  PortfolioController.postLogin(request, response);
};

export const logout = (request, response) => {
  PortfolioController.logout(request, response);
};

export const getAccessToken = (request, response) => {
  PortfolioController.getAccessToken(request, response);
};

export const getResources = (request, response) => {
  PortfolioController.getResources(request, response);
};

export const sell = (request, response) => {
  PortfolioController.sell(request, response);
};

export const buy = (request, response) => {
  PortfolioController.buy(request, response);
};

export const instruments = (request, response) => {
  PortfolioController.getInstruments(request, response);
};

export const quote = (request, response) => {
  PortfolioController.getQuote(request, response);
};

export const intraday = (request, response) => {
  PortfolioController.getIntraday(request, response);
}

export const intradayV2 = (request, response) => {
  PortfolioController.getIntradayV2(request, response);
}

export const dailyQuote = (request, response) => {
  PortfolioController.getDailyQuotes(request, response);
}

export const tdBuy = (request, response) => {
  PortfolioController.tdBuy(request, response);
}

export const twoLegOrder = (request, response) => {
  PortfolioController.twoLegOrder(request, response);
}

export const tdSell = (request, response) => {
  PortfolioController.tdSell(request, response);
}

export const tdPosition = (request, response) => {
  PortfolioController.tdPosition(request, response);
}

export const tdBalance = (request, response) => {
  PortfolioController.tdBalance(request, response);
}

export const setAccount = (request, response) => {
  PortfolioController.setCredentials(request, response);
}

export const checkAccount = (request, response) => {
  PortfolioController.checkForCredentials(request, response);
}

export const deleteCredentials = (request, response) => {
  PortfolioController.deleteCredentials(request, response);
}

export const getEquityMarketHours = (request, response) => {
  PortfolioController.getEquityMarketHours(request, response);
}

export const getInstrument = (request, response) => {
  PortfolioController.getInstrument(request, response);
}