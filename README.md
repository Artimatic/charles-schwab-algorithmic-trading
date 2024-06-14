# charles-schwab-algorithmic-trading

## Install
* Create optional file 'credentials.js' in '\server\config\environment\credentials.js'
```
export default {
    port: 9000,
    goliathUrl: 'http://localhost:8100/', // Database service local address https://github.com/Artimatic/station-data-service
    armadilloUrl: 'http://localhost:3000/', // Machine Learning service local address https://github.com/Artimatic/station-analysis-service
    twilio: { // For SMS functionality
      key: 'KEY',
      id: 'ID'
    }
};

```

Run `npm install`

## Build

Run `npm run build `.

## Start Server

Run `npm run start`

## Local Address

http://127.0.0.1:9000/

#### Research Backtest Screener

Requires station-data-service to be set up and running. https://github.com/Artimatic/station-data-service

#### Machine Learning functionalities

Requires station-analysis-service to be set up and running. https://github.com/Artimatic/station-analysis-service

