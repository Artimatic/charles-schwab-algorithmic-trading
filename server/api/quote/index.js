const express = require('express');
const handler = require('./quote.router');

const router = express.Router();

router.post('/', handler.quote);
router.post('/current', handler.getCurrentQuote);
router.post('/raw', handler.rawQuote);
router.post('/historical-intraday', handler.postIntraday);
router.get('/historical-intraday', handler.findIntraday);
router.post('/optionchain', handler.optionChain);
router.post('/intraday-tiingo', handler.intradayTiingo);

module.exports = router;
