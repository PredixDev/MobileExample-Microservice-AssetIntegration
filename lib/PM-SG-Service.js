"use strict";

// --- imports
var request     = require('request');

var UserState   = require("./UserState.js");
var UAAConfig   = require("./cf-api/UAA-Auth.js").UAAConfig.valueOf();
var UAA         = require("./cf-api/UAA-Auth.js").UAA.valueOf();
var HttpUtil    = require("./http/HTTP-Util.js");
var RequestUtil = require("./http/RequestUtil.js");


var logger;
var pmConfig      = require("./PMConfig.js")();

module.exports  = function(log)
{
  logger = log;
    return {
          pmAuthorize       : testOAuthTokenNew,
          checDoc           : checkDocExisitsNew,
          updateDoc         : updateAssetsDoc
    };
}

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

// gets Oauth token for Mobile server which will be utilized to talk to CB.
function testOAuthTokenNew()
{
  return new Promise(function(resolve, reject){


  var _username = USERNAME;//"kamal.mann@ge.com";//"admin";//
  var _password = PASSWORD;//"abc123"; //"Pr3dixMob1l3";//

  if (!_username) { logger.error("Username argument not specified."); return; }
  if (!_password) { logger.error("Password argument not specified."); return; }
  if (!UserState.target.api) { UserState.target.api = URL_PM_EP }


  // execute input:

  // check UAA endpoint known:
  var uaaConfig = new UAAConfig(UserState);
  if (!uaaConfig.AuthenticationEndpoint()) {
    // var authorization_endpoint = UserState.target.config.authorization_endpoint.valueOf();
    uaaConfig.SetAuthenticationEndpoint(PM_UAA_URL);
  }
  // kkkkkkkkkkkkk
  UserState.target.api = URL_PM_EP
  uaaConfig.SetAuthenticationEndpoint(PM_UAA_URL);
  // kkkkkkkkkkkkk

  // attempt authenticate user:
  var uaaInstance = new UAA(uaaConfig);
  // Execute();

  // function Execute(username, password) {
  	uaaConfig.ClearSession();

  	return uaaInstance.GetLoginPromptsAndSaveUAAServerURL()
  	.then(function (prompts) {
  		logger.info("API endpoint: ", uaaConfig.AuthenticationEndpoint());
  		logger.info("Authenticating with PM service instance...");

  		return uaaInstance.Authenticate({"username": _username, "password": _password})
  		.spread(function (response, body) {
  			logger.info("Received PM oAuth-Token.");
        logger.trace("oauth-TOKEN:", uaaConfig.AccessToken());
        PM_OAUTH_TOKEN = uaaConfig.AccessToken();
        resolve(uaaConfig.AccessToken());
  		}, function (response, body) {
        reject(body);
  		});
  	});
  });
  // }
}

// Checks if a doc exists in CB
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

// push a doc to CB
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
      //get rev ID and add to doc
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

function createJsonDoc()
{
  return new Promise(function(resolve, reject){

    getWebAppChannels()
    .then(function (webAppDoc){
      webAppDoc = JSON.parse(webAppDoc);
      var webAppChannels = webAppDoc.channels;
      // webAppChannels.push('entity_'+USERNAME.replace(/[@#\.]/g, '_'));
      var assetDoc = {};
      var assetDocID = USERNAME.replace(/[@#\.]/g, '_');
      assetDocID = assetDocID + '_' + 'predix_asset' + '_' + pmConfig.requireConfig('PA_PREDIX_ZONE_ID')
      logger.debug('assetDocID:-->', assetDocID);
      assetDoc._id = assetDocID;
      assetDoc.channels = webAppChannels;
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

function getWebAppChannels()
{
  return new Promise(function(resolve, reject){
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
