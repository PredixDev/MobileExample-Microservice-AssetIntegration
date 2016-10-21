#!/usr/bin/env node
/*jslint node: true */
'use strict';

// Not in use
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
