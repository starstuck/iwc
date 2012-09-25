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

	return {
		init: function (allowedOrigins) {
			reqresp.openResponder('ajax', function (req, callback) {
				var xhr,
					data;

				function completeHandler(resp) {
					callback({
						status: xhr.status,
						response: resp
						//headers: xhr.getAllResponseHeaders(),
						//responseText: xhr.responseText
					});
				}

				// Apparently reqwest on IE will use activex xhr request, which
				// is called synchronously, to en extend in which req.complete
				// will not have xhr available. IN IE <= 8 the code after
				// reqwest cll will have all data.
				req.complete = function (resp) {
					if (xhr) {
						completeHandler(resp);
					} else {
						data = resp;
					}
				};
				xhr = reqwest(req).request;
				if (data) {
					completeHandler(data);
				}
			}, allowedOrigins);
		}
	};
});
