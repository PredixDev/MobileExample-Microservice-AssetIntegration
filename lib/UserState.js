'use strict';

var Preferences = require("preferences");

// initialize default user state:
var userState = new Preferences('com.ge.predix.PM-ASSET', {
	target: {
		api: null
	}
	, uaa: {

	}
});

module.exports = userState;
