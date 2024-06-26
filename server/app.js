/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

process.on('unhandledRejection', (p, reason) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);  // application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', function (exception) {
  console.log('uncaughtException', exception);
});
const express = require('express');

const configurations = require('./config/environment');
const bodyParser = require('body-parser')

// Setup server
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }))
app.set('trust proxy', true);

app.set('views', __dirname + '/modules')
app.set('view engine', 'html');
const server = require('http').createServer(app);
require('./config/express')(app);
require('./routes')(app);

// Start server
const port = parseInt(process.env.PORT) || configurations.port;

server.listen(port, configurations.ip, function () {
  console.log('Express server listening on %d, in %s mode', configurations.port, app.get('env'));
});

// Expose app
exports = module.exports = app;
