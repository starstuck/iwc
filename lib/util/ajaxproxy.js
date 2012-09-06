/*global define*/

/**
 * This is very mplementation of very simple responder, which treats
 * requests data as argumetns to reqwest library, makes call iwth it
 * and finally pass data back to channel.
 *
 * The responder registers on #ajax channel by default
 */
define(function (require) {
	"use strict";

	var reqwest = require('reqwest'),
		reqresp = require('../reqresp');

	reqresp.openResponder('ajax', function (req, callback) {
		console.debug('Beeing remote proxy');
		req.complete = function (resp) {
			callback(resp);
		};
		reqwest(req);
	});
});
