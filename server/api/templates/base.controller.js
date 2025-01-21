const _ = require('lodash');
const Ajv = require('ajv');
const Boom = require('boom');
const errors = require('errors');

const ajv = new Ajv({
  v5: true,
  allErrors: true,
  jsonPointers: true
});

export default class BaseController {

  static requestGetSuccessHandler(reply, data) {
    reply.setHeader('Access-Control-Allow-Origin', ['*']);
    reply.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    reply.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.status(200).send(data);
  }

  static requestErrorHandler(reply, error) {
    console.log('Base error: ', error);
    if (error && error.error && (error.statusCode || error.code)) {
      reply.status(error.statusCode || error.code ).send(error.error);
    } else {
      reply.status(Boom.badImplementation().output.statusCode).send(error);
    }
    reply.end();
  }

  static notFoundErrorHandler(reply, error) {
    console.log('Not found Error: ', error);
    reply.status(Boom.notFound().output.statusCode).send(Boom.notFound.output);
  }

  static UnhandledErrorHandler(error) {
    console.log('Unhandled error: ', error);
  }

  addSchema(schemaKey, schemaObject) {
    ajv.addSchema(schemaObject, schemaKey);
  }

  validate(schemaKey, data) {
    ajv.validate(schemaKey, data);
    return ajv.errors;
  }
}
