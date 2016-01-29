"use strict";

// --- imports
var request     = require('request');

var logger;
var pmConfig      = require("./PMConfig.js")();
var pmService;

module.exports  = function(log, config)
{
  logger        = log;
  pmService     = require("./PM-SG-Service.js")(logger);
  return {
          authorize       : getAuthorization,
          getAllAssets    : callAsset
  };
}


var ACCESS_TOKEN    = null;
var PREDIX_ZONE_ID  = null;
var URL_ASSET       = null;
var URL_UAA         = null;
var USERNAME        = null;
var PASSWORD        = null;
var ARR_ASSET_URL   = null;
(function () {
  readConfig();
})();


function readConfig()
{
  PREDIX_ZONE_ID  = pmConfig.requireConfig('PA_PREDIX_ZONE_ID');
  URL_ASSET       = pmConfig.requireConfig('PA_URL_ASSET');//'https://predix-asset.run.aws-usw02-pr.ice.predix.io/locomotives?filter=model=3GS21B:serial_no=0019'; //
  URL_UAA         = pmConfig.requireConfig('PA_URL_UAA');
  USERNAME        = pmConfig.requireConfig('PA_USERNAME');
  PASSWORD        = pmConfig.requireConfig('PA_PASSWORD');

  ARR_ASSET_URL   = [URL_ASSET,
                    URL_ASSET+'?pageSize=5',
                    URL_ASSET+'/1?fields=uri,type,manufacturer',
                    URL_ASSET+'?filter=model=3GS21B:serial_no=0019',
                    URL_ASSET+'?filter=type=Diesel-electric',
                    URL_ASSET+'?filter=serial_no=0080'];
}

function getRandomAssetURL()
{
  return ARR_ASSET_URL[ Math.floor(Math.random() * (ARR_ASSET_URL.length-1)) ];
}

function getBasic()
{
  // logger.info(new Buffer("asset_client_3:abc123").toString('base64'));
  // logger.info(new Buffer("YXNzZXRfY2xpZW50XzM6YWJjMTIz", 'base64').toString('ascii'))
  return new Buffer(USERNAME+':'+PASSWORD).toString('base64')
}


// gets auth token for Assets service instance
function getAuthorization()
{
  var options = {
    url: URL_UAA,
    method: 'POST',
    headers: {
      'Authorization': 'Basic '+getBasic(),/*'Basic YXNzZXRfY2xpZW50XzM6YWJjMTIz'*/
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'client_id='+USERNAME+'&grant_type=client_credentials&client_secret='+PASSWORD
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      ACCESS_TOKEN = info.access_token;
      logger.trace("PA access_token: ", ACCESS_TOKEN);
      logger.trace("PA token_type: ", info.token_type);


      pmService.pmAuthorize()
      .then(function(arr){
        logger.trace('arrrrrrr: ',arr);
        // return pmService.checDoc('test_kamal_0_0_2');
      })
      /*.then(function(document){
        logger.info("document:->> ",document);
      })*/
      .catch(function(err){
        logger.error(err);
      });

    }
  }
   request(options, callback);
}

// gets data from assest service
function callAsset()
{
  var authToken = 'bearer ' + ACCESS_TOKEN;
  var assetUrlSelected = getRandomAssetURL();
  logger.trace('Calling assets with authToken: ',authToken);
  logger.trace('Calling assets with URL: ',assetUrlSelected);
  var assets_Options = {
    url: assetUrlSelected,
    method: 'GET',
    headers: {
      'Content-Type':'application/json;charSet=utf-8',
      'Authorization': authToken,
      'Cache-Control': 'no-cache',
      'Predix-Zone-Id': PREDIX_ZONE_ID
    }
  };

  function assets_callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var assetsResults = JSON.parse(body);
      logger.info('received predix-asset service data successfully.');
      logger.debug("ASSET DATA: ", assetsResults);

      pmService.updateDoc((assetsResults))
      .then(function(document){
        logger.debug("put document result: ",document);
      })
      .catch(function(err){
        logger.error(err);
        pmService.pmAuthorize();
      });
    }
  }
  logger.debug('Calling asset service instance now...');
  request(assets_Options, assets_callback);
}
