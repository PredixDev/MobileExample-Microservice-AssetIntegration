# MOBILE-ASSET-MICROSERVICE(v0.1)
A sample micro-service which communicates with Predix-Assets service instance and pushes data to Predix-Mobile service instance which gets synced on devices running Predix mobile app.

## Configuration

When run on a development system, the configuration found in `config/default.json` is used to configure whereas `manifest.yml` will be used when pushed to cf.
A simple configuration document is outlined below:

```
{
  "PORT": 8086,

  "ASSET": {
    "PA_PREDIX_ZONE_ID"   : "43bf717f-86a5-45da-9053-6651c00d1a99",
    "PA_URL_ASSET"        : "https://predix_asset.run.aws-usw02-pr.ice.predix.io/locomotives",
    "PA_URL_UAA"          : "https://predix-uaa.run.aws-usw02-pr.ice.predix.io/oauth/token",
    "PA_USERNAME"         : "asset_user",
    "PA_PASSWORD"         : "********",
    "DATA_REFRESH_TIME"   : 5
  },

  "MOBILE_UP": {
    "PM_EP_URL"           : "https://Mobile_up.run.aws-usw02-pr.ice.predix.io/",
    "PM_USERNAME"         : "mobileup_user@ge.com",
    "PM_PASSWORD"         : "********",
    "PM_UAA_URL"          : "https://predix-uaa.run.aws-usw02-pr.ice.predix.io",
    "WEB-APP-NAME"        : "pa-basic-app",
    "WEB-APP-VERSION"     : "0.0.1"
  }
}
```

## Installation

Checkout this repository, open the folder in a terminal window, and execute:

```
npm install
```

## Running

A common workflow is outlined below:

```
node index.js
OR
node index.js | ./node_modules/.bin/bunyan # outputs nice looking logs in terminal window
```

The above command will:

* Fetch data from asset service every 5 second and pushes it to a document(`docid = username+'_predix_asset_'+PA_PREDIX_ZONE_ID`) in mobile-up service.
* Starts an Express server {TODO: accept commands to make changes in asset service data}
