import * as express from 'express';
import OrderingController from './ordering.controller';

const router = express.Router();

router.post('/', OrderingController.processOrder);

module.exports = router;
