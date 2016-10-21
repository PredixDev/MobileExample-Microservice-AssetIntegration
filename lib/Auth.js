#!/usr/bin/env node
/*jslint node: true */
"use strict";

// --- imports
var request = require('request');
var pmConfig = null;
var logger;
var ACCESS_TOKEN = null;
var TOKEN_TYPE = null;

var COUNTER = 1;
var PM_UAA = null;
var isInProgress = false;


module.exports = function() {
    if (PM_UAA === null) {
        PM_UAA = {
            init: init,
            authorize: authorizeWithUAA,
            authtoken: authtoken
        };
    }
    return PM_UAA;
};

function init(options) {
    options.logger.debug('initializing Auth...');
    logger = options.logger;
    pmConfig = options.config;
}

function authorizeWithUAA() {
    return new Promise(function(resolve, reject) {

        if (isInProgress) {
            logger.error("Waiting for the older response yet. `Patience is a virtue`");
            reject("Waiting for the older response yet. `Patience is a virtue`");
            return;
        }
        isInProgress = true;
        logger.trace({
            COUNTER: COUNTER
        }, "Waiting before authorizing with UAA: " + isInProgress);
        setTimeout(function() {
            COUNTER += COUNTER * 2;

            var formData = {
                "grant_type": "password",
                "scope": "",
                "username": pmConfig.requireConfig('PM_USERNAME'),
                "password": pmConfig.requireConfig('PM_PASSWORD')
            };
            var reqOptions = {
                url: pmConfig.requireConfig('PM_UAA_URL'),
                method: 'POST',
                headers: {
                    "Authorization": "Basic " + (new Buffer("pm:").toString('base64')),
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                form: formData
            };
            logger.debug("sending auth request to: ", reqOptions.url);

            function callback(error, response, body) {
                isInProgress = false;

                if (!error && response.statusCode == 200) {
                    COUNTER = 1;
                    var info = JSON.parse(body);
                    ACCESS_TOKEN = info.access_token;
                    TOKEN_TYPE = info.token_type;
                    resolve(authtoken());
                } else {
                    reject(error || response || body);
                }
            }
            request(reqOptions, callback);
        }, COUNTER * 1000);
    });
}

function authtoken() {
    if (null === TOKEN_TYPE || null === ACCESS_TOKEN) {
        logger.warn("Please execute authorize first!");
        return "";
    }
    // logger.debug("called.....");
    return TOKEN_TYPE + " " + ACCESS_TOKEN;
}
