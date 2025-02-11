const express = require('express');
import strategyController from './strategy.controller';

const router = express.Router();

router.get('/', strategyController.getStrategy);
router.get('/', strategyController.clear);
router.post('/', strategyController.setStrategy);

module.exports = router;
