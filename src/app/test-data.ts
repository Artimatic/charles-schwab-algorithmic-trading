export const TRAINING_DATA = [
  {
    "symbol": "NFLX",
    "algorithm": "daily_10_0.001",
    "guesses": 122,
    "correct": 72,
    "score": 0.5901639344262295,
    "predictionHistory": [
      {
        "date": "2023-05-15T05:00:00.000Z",
        "prediction": 0.19536209650137099
      }
    ],
    "nextOutput": 0.028
  }
];

export const SIGNAL = {
  "symbol": "UNH",
  "date": "2024-09-20T05:00:00.000Z",
  "open": 571.695,
  "high": 578.84,
  "low": 569.65,
  "close": 575,
  "volume": 5398749,
  "bband80": [
      [
          458.16215455425447,
          459.2522347840001
      ],
      [
          543.6492499999999,
          544.54075
      ],
      [
          629.1363454457454,
          629.8292652159998
      ]
  ],
  "roc10": -0.0046,
  "roc10Previous": -0.0044,
  "roc70": 0.1588,
  "roc70Previous": 0.1658,
  "mfiLeft": 33.658,
  "vwma": 545.055,
  "macd": [],
  "macdPrevious": [],
  "rsi": [
      [
          39.58618799671137
      ]
  ],
  "demark9": {
      "perfectSell": false,
      "perfectBuy": false
  },
  "mfiLow": 30,
  "mfiPrevious": 42.624,
  "bbandBreakout": false,
  "recommendation": {
      "recommendation": "None",
      "mfi": "Neutral",
      "mfiLow": "Neutral",
      "vwma": "Neutral",
      "mfiTrade": "Neutral",
      "macd": "Neutral",
      "demark9": "Neutral",
      "mfiDivergence": "Neutral",
      "mfiDivergence2": "Neutral",
      "bband": "Neutral",
      "roc": "Neutral"
  },
  "action": "INDETERMINANT"
};

export const ORDER_HISTORY = {
  "symbol": "UNH",
  "date": "2024-06-04T05:00:00.000Z",
  "open": 498.56,
  "high": 508.27,
  "low": 494.59,
  "close": 505.49,
  "volume": 3178436,
  "bband80": [
    [
      450.59826735642264,
      450.73830903571104
    ],
    [
      493.8446250000003,
      493.6621250000003
    ],
    [
      537.090982643578,
      536.5859409642895
    ]
  ],
  "roc10": 0.045,
  "roc10Previous": 0.0172,
  "roc70": -0.0413,
  "roc70Previous": -0.0552,
  "mfiLeft": 53.712,
  "vwma": 485.273,
  "rsi": [
    [
      45.34973949672986
    ]
  ],
  "demark9": {
    "perfectSell": false,
    "perfectBuy": false
  },
  "mfiLow": 30,
  "mfiPrevious": 53.554,
  "bbandBreakout": false,
  "recommendation": {
    "recommendation": "Buy",
    "mfi": "Neutral",
    "mfiLow": "Neutral",
    "vwma": "Neutral",
    "mfiTrade": "Neutral",
    "macd": "Neutral",
    "demark9": "Neutral",
    "mfiDivergence": "Bullish",
    "mfiDivergence2": "Neutral",
    "bband": "Neutral",
    "roc": "Neutral"
  },
  "signal": "buy",
  "action": "STRONGBUY"
};

export const BACKTEST_DATA = {
  algo: "All indicators",
  invested: 1067.62,
  net: 35.,
  profitableTrades: 1,
  recommendation: "STRONGBUY",
  symbol: "UNH",
  total: 1067.62,
  totalTrades: 2,
  orderHistory: [
    ORDER_HISTORY
  ],
  signals: [
    SIGNAL
  ]
};
