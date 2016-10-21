#!/usr/bin/env node
/*jslint node: true */
"use strict";

// This file communicates with Mobile service and pushes data received from Asset Service to Mobile service
// --- imports
var request     = require('request');

var UserState   = require("./UserState.js");
var UAAConfig   = require("./cf-api/UAA-Auth.js").UAAConfig.valueOf();
var UAA         = require("./cf-api/UAA-Auth.js").UAA.valueOf();
var HttpUtil    = require("./http/HTTP-Util.js");
var RequestUtil = require("./http/RequestUtil.js");


var logger;
var pmConfig      = require("./PMConfig.js")();
var COUNTER       = 1;
var PMSERVICE     = null;
var isInProgress  = false;

module.exports  = function(log)
{
  logger = log;
  if (null === PMSERVICE) {
    PMSERVICE = {
         pmAuthorize       : testOAuthTokenNew,
         checDoc           : checkDocExisitsNew,
         updateDoc         : updateAssetsDoc
   };
  }
  return PMSERVICE;
};

var PM_OAUTH_TOKEN  = null;
var URL_PM_EP       = null;//"https://778517.run.aws-usw02-pr.ice.predix.io/";
var PM_UAA_URL      = null;
var USERNAME        = null;
var PASSWORD        = null;

(function () {
  readConfig();
})();


function readConfig()
{
  URL_PM_EP  = pmConfig.requireConfig('PM_EP_URL');
  USERNAME   = pmConfig.requireConfig('PM_USERNAME');
  PASSWORD   = pmConfig.requireConfig('PM_PASSWORD');
  PM_UAA_URL = pmConfig.requireConfig('PM_UAA_URL');
}

// gets Oauth token for Mobile server.
function testOAuthTokenNew()
{
  return new Promise(function(resolve, reject){
    if (isInProgress) {
      logger.error("Waiting for the older response yet. `Patience is a virtue`");
      reject("Waiting for the older response yet. `Patience is a virtue`");
      return;
    }
    isInProgress = true;
    logger.trace({COUNTER:COUNTER}, "Waiting before authorizing with UAA: "+ isInProgress);
    setTimeout(function () {

      COUNTER += COUNTER*2;
      logger.trace({COUNTER:COUNTER},"Running PM authorization sequence now... ");
      var _username = USERNAME;
      var _password = PASSWORD;

      if (!_username) { logger.error("Username argument not specified."); return; }
      if (!_password) { logger.error("Password argument not specified."); return; }
      if (!UserState.target.api)
      {
        UserState.target.api = URL_PM_EP ;
      }


      // check UAA endpoint known:
      var uaaConfig = new UAAConfig(UserState);
      if (!uaaConfig.AuthenticationEndpoint()) {
        // var authorization_endpoint = UserState.target.config.authorization_endpoint.valueOf();
        uaaConfig.SetAuthenticationEndpoint(PM_UAA_URL);
      }
      //setting it anyhow
      UserState.target.api = URL_PM_EP;
      uaaConfig.SetAuthenticationEndpoint(PM_UAA_URL);


      // attempt authenticate user:
      var uaaInstance = new UAA(uaaConfig);

      	uaaConfig.ClearSession();

      	return uaaInstance.GetLoginPromptsAndSaveUAAServerURL()
      	.then(function (prompts) {
      		logger.info("API endpoint: ", uaaConfig.AuthenticationEndpoint());
      		logger.info("Authenticating with PM service instance...");

      		return uaaInstance.Authenticate({"username": _username, "password": _password})
      		.spread(function (response, body) {
      			logger.info("Received PM oAuth-Token. Resetting counter to default.");
            isInProgress = false;
            COUNTER=1;
            logger.trace("oauth-TOKEN:", uaaConfig.AccessToken());
            PM_OAUTH_TOKEN = uaaConfig.AccessToken();
            resolve(uaaConfig.AccessToken());
      		}, function (response, body) {
            reject(body);
      		});
      	});
    }, COUNTER*1000);

  });
}

// Checks if a doc exists in Mobile service
function checkDocExisitsNew(docID)
{
  return new Promise(function(resolve, reject){
    var url     = URL_PM_EP + "pg/api/admin/data/pm/" + docID;
    var options = {
      url: url,
      method: 'GET',
      headers: {
        'Authorization': PM_OAUTH_TOKEN,
        'Content-Type': 'application/json'
      }

    };
   request(options, function(err, res){
       if (err) {
         reject(err);
       }
       else {
         resolve(res.body);
       }
     });
  }

  );
}

// pushes a doc to Mobile service
function putDocument(doc)
{
  return new Promise(function(resolve, reject){
    var url     = URL_PM_EP + "pg/api/admin/data/pm/" + doc._id;
    var options = {
      url: url,
      method: 'PUT',
      headers: {
        'Authorization': PM_OAUTH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(doc)
    };
   request(options, function(err, res){
       if (err) {
         reject(err);
       }
       else {
         resolve(res.body);
       }
     });
  });
}

//Creates/Updates document containing Asset service results and push this to Mobile service
function updateAssetsDoc(results)
{
  return new Promise(function(resolve, reject){
  var doc = null;;
  createJsonDoc()
  .then(function(createdDoc){
    doc = createdDoc;
    return checkDocExisitsNew(doc._id);
  })
  .then(function(document){
    var exisitingDoc = JSON.parse(document);
    logger.debug("exisiting document in PM service:->> ",exisitingDoc);

    if (exisitingDoc && exisitingDoc.hasOwnProperty('_id') && exisitingDoc.hasOwnProperty('_rev')) {
      //get revision ID and add to document
      doc._rev = exisitingDoc['_rev'];
    }

    doc.asset_results = results;
    logger.debug('about to push:-->',doc);

    return putDocument(doc)
    // .then(function(putDoc){
    //   logger.info('Updated document in PM service.');
    //   logger.debug('PUT success:',putDoc);
    //   resolve(putDoc);
    // })
    // .catch(function(err){
    //   logger.error(err);
    //   reject(err);
    // })

  })
  .then(function(putDoc){
    logger.info('Updated document in PM service.');
    logger.debug('PUT success:',putDoc);
    resolve(putDoc);
  })
  .catch(function(err){
    logger.error(err);
    reject(err);
  });

});


}

//Creates a document which will hold asset service results.
function createJsonDoc()
{
  return new Promise(function(resolve, reject){

    getWebAppChannels()
    .then(function (webAppDoc){
      webAppDoc = JSON.parse(webAppDoc);
      var webAppChannels = webAppDoc.channels; // will assign document to these channles
      // webAppChannels.push('entity_'+USERNAME.replace(/[@#\.]/g, '_'));
      var assetDoc = {};
      var assetDocID = USERNAME.replace(/[@#\.]/g, '_'); // as of now we have to replace '.' & '@' with '_'

      //generating document id as a combination of username+tag+asset zone id
      assetDocID = assetDocID + '_' + 'predix_asset' + '_' + pmConfig.requireConfig('PA_PREDIX_ZONE_ID')
      logger.debug('assetDocID:-->', assetDocID);
      assetDoc._id = assetDocID;
      assetDoc.channels = webAppChannels; // assigining channels to document.
      // assetDoc.channels.push("user-user1");
      // assetDoc.channels.push("entity_user1");
      // assetDoc.channels.push("role-user");

      assetDoc.title = "assets document";
      assetDoc.type = "asset";
      resolve(assetDoc);
    })
    .catch(function(err){
      reject(err);
    });

  });
}

//I'll get webapp document (created by `pm publish` command)
function getWebAppChannels()
{
  return new Promise(function(resolve, reject){
    // webapps documents are combination of webapp tag + web app name + web app version
    var webappID = 'webapp-' + pmConfig.requireConfig('WEB_APP_NAME') + '_' + pmConfig.requireConfig('WEB_APP_VERSION').replace(/\./g, '_');
    checkDocExisitsNew(webappID)
    .then(function(webAppDoc){
      logger.debug('webapp Document:', webAppDoc);
      resolve(webAppDoc);
    })
    .catch(function(err){
      logger.error(err);
      reject(err);
    });
  });
}
