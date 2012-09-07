/*global define*/
define(function (require) {
	"use strict";
	var pipe = require('../lib/pipe');

	// Tweak iwc for better test setup
	try {
		pipe.ignoreMessagePrefix('mocha-');
	} catch(err) {}

	require('./pipe_test');
	require('./reqresp_test');
	require('./ajax_test');
});
