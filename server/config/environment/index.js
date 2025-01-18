const path = require('path');
const _ = require('lodash');
let credentials;
try {
  credentials = require('./credentials.js');
} catch(error) {
  console.log('Credentials are missing. Continuing without credentials.');
}

// All configurations will extend these options
// ============================================

const defaultPort = _.get(credentials, 'default.port', _.get(credentials, 'port', null)) || 9000;
module.exports = {
  env: process.env.NODE_ENV,

  // Root path of server
  root: path.normalize(__dirname + '/../../..'),

  // Server port
  port: process.env.PORT || defaultPort,
  yahoo: {
    key: _.get(credentials, 'default.yahoo.key', _.get(credentials, 'yahoo.key', null)),
    secret: _.get(credentials, 'default.yahoo.secret', _.get(credentials, 'yahoo.secret', null))
  },
  alpha: {
    key: _.get(credentials, 'default.alpha.key', _.get(credentials, 'alpha.key', null)),
  },
  tiingo: {
    key: _.get(credentials, 'default.tiingo.key', _.get(credentials, 'tiingo.key', null)),
  },
  robinhood: {
    deviceId: _.get(credentials, 'default.robinhood.deviceId', _.get(credentials, 'robinhood.deviceId', null)),
  },
  iex: {
    key: _.get(credentials, 'default.iex.key', _.get(credentials, 'iex.key', null)),
  },
  charles: {
    accountId: _.get(credentials, 'default.accountId', _.get(credentials, 'accountId', null)),
    refresh_token: _.get(credentials, 'default.refreshToken', _.get(credentials, 'refreshToken', null))
  },
  apps: {
    goliath: _.get(credentials, 'default.goliathUrl', _.get(credentials, 'goliathUrl', 'http://localhost:8100/')),
    armadillo: _.get(credentials, 'default.armadilloUrl', _.get(credentials, 'armadilloUrl', 'http://localhost:3000/')),
    tiingo: 'https://api.tiingo.com/'
  },
  twilio: {
    key: _.get(credentials, 'default.twilio.key', _.get(credentials, 'twilio.key', null)),
    id: _.get(credentials, 'default.twilio.id', _.get(credentials, 'twilio.id', null)),
    num: _.get(credentials, 'default.twilio.num', _.get(credentials, 'twilio.num', null)),
  },
  mongodb: {
    username: _.get(credentials, 'default.mongodb.username', _.get(credentials, 'mongodb.username', process.env.mongodbUsername)),
    password: _.get(credentials, 'default.mongodb.password', _.get(credentials, 'mongodb.password', process.env.mongodbPassword))
  }
};
