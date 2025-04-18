import * as express from 'express';
import MachineLearningController from './machine-learning.controller';

const router = express.Router();

router.get('/train', MachineLearningController.getTrainingDataSetV2);
router.get('/get-training-data', MachineLearningController.getTrainingData);
router.get('/guess-activate', MachineLearningController.activateWithIntradayData);
router.get('/test-model', MachineLearningController.testV2Model);
router.get('/activate', MachineLearningController.activateV2Model);
router.post('/activate-at-close-model', MachineLearningController.activateBuyAtCloseModel);
router.get('/activation-data', MachineLearningController.getDailyActivationData);
router.get('/current-activation-data', MachineLearningController.getCurrentIntradayActivationData);
router.get('/v3/train-intraday', MachineLearningController.trainV3);
router.get('/v3/train-daily', MachineLearningController.trainDailyV3);
router.get('/v3/activate', MachineLearningController.activateV3);
router.get('/v3/quotes', MachineLearningController.getQuotes);
router.post('/v3/indicators', MachineLearningController.getIndicators);
router.post('/v3/activate-model', MachineLearningController.activateModel);
router.get('/v3/activate-daily', MachineLearningController.activateDailyV3);
router.get('/v4/activate-daily', MachineLearningController.activateDailyV4);
router.get('/v4/train-daily', MachineLearningController.trainDailyV4);
router.get('/train/pair-trade', MachineLearningController.trainDailyTradingPair);
router.get('/train/sell-model', MachineLearningController.trainDailyBear);
router.get('/activate/sell-model', MachineLearningController.activateDailyBear);
router.get('/train/buy-model', MachineLearningController.trainDailyBull);
router.get('/activate/buy-model', MachineLearningController.activateDailyBull);
router.get('/train/volatility-model', MachineLearningController.trainVolitility);
router.get('/train/mfi-model', MachineLearningController.trainMfi);
router.get('/v4/get-data', MachineLearningController.getTrainingDataDailyV4);
router.get('/v4/score-daily', MachineLearningController.scoreDailyV4);
router.get('/v4/get-patterns', MachineLearningController.getFoundPatterns);

module.exports = router;
