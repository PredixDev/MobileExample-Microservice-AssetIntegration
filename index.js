"use strict";

// --- imports
var request       = require('request');
var express       = require('express');
var bodyParser    = require('body-parser');

var Logging       = require('./lib/bunyanLogger.js');
var logger        = Logging.logger();

var paService     = require("./lib/PAsset-Service.js")(logger, pmConfig);
var pmConfig      = require("./lib/PMConfig.js")();

var PORT          = 8080;


(function () {
  if (!pmConfig.isEnvCF()) {
    PORT = pmConfig.requireConfig('PORT');
  }
  else {
    PORT = process.env.PORT;
  }
  logger.info('using port: ' + PORT);
})();

// starts Express server -- TODO: will be used to act as cmd-processor for Asset service
function startServer()
{
    var app = express();
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    app.get('/*', simpleRequest);
    app.put('/*', simpleRequest);
    app.post('/*', simpleRequest);

    function simpleRequest(req, res) {

        logger.info("Default Request Received: Returning simple response.");
        logger.info("BODY: "+req.body);
        res.json(
            {
              TS : new Date().getTime()
            }
        );
    }

    var server = app.listen(PORT, function () {
        var host = server.address().address;
        var port = server.address().port;
        logger.info('Dev server listening at http://%s:%s', host, port);
    });

}

// starts a deamon process which runs every t1-seconds
function daemon()
{
  var interval = pmConfig.requireConfig('DATA_REFRESH_TIME') * 1000;
  setInterval(function() {
    logger.info("Starting sync process ...");
    paService.getAllAssets();
    // TODO: update CB document
  }, interval);
}

// my main
(function()
{
  // logger.info(config.get('PORT'));
  startServer();
  paService.authorize();
  daemon();


})();
