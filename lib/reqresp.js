/*global define, window*/
/*jslint regexp:true*/

/**
 * Module provides convinience methods for hanlding bi-directional comunicaiton
 * between frames using request - response pattern
 */
define(function (require) {
	"use strict";

	var pub = {}, // Publicly exposed module
		pipe = require('./pipe'),
		requestorByName = {},
		responderByName = {};

	// Private functions
	// =================

	// Internal classes
	// ================

	// TODO: add support for closing channels

	/**
	 * Requests are queued numbered, so when we got response for each 
	 * request, then we can invoke proper handelr, wven if there is more
	 * than one requests waiting for response at the moment.
	 *
	 * @param {String} channel identifier
	 * @param {Object} responderContext responder pipe end context
	 */
	function RequestorEndPoint(name, responderContext) {
		var  me = this;
		me.name = name;
		me.counter = 0;
		me.respHandler = {};
		// Requests  pie can have remote name
		me.pipe = pipe.open(name + '-req', responderContext);
		// Recipient will always use local name
		pipe.addRecipient(me.pipe.name.replace('-req', '-resp'), function (resp) {
			me.handleResponse(resp);
		});
	}

	RequestorEndPoint.prototype = {
		// TODO: add erro handling on request timeouts
		request: function (req, handler) {
			var rId = this.counter += 1,
				reqPacket = {c: rId, d: req};

			this.respHandler[rId] = handler;
			this.pipe.send(reqPacket);
		},

		handleResponse: function (respPacket) {
			var rId = respPacket.c,
				handler = this.respHandler[rId];

			if (handler) {
				handler(respPacket.d);
				delete this.respHandler[rId];
			} else {
				return new Error('Duplicated response in ' + this.pipe.name.replace(/-req$/, '') + ' pipe: ' + JSON.stringify(respPacket));
			}
		}
	};

	/**
	 * @constructor
	 * @param {Object} [requestorContext] Context in which requestor lives. By default it will be parent window
	 */
	function ResponderEndPoint(name, handler, requestorContext) {
		var me = this;

		if (!requestorContext) {
			requestorContext = window.parent;
		}

		me.name = name
		me.handler = handler;
		me.pipe = pipe.open(name + '-resp', requestorContext);

		pipe.addRecipient(name + '-req', function (req) {
			me.handleRequest(req);
		});
	}

	ResponderEndPoint.prototype = {
		handleRequest: function (reqPacket) {
			var me = this,
				handler = me.handler;

			// Lets assume, that if handler accepts 2 arguments then it 
			// support asynchronous call
			if (handler.length >= 2) {
				handler(reqPacket.d, function (resp) {
					// Callback when request is done
					// Sent response data to requestor
					me.pipe.send({
						c: reqPacket.c,
						d: resp
					});
				});
			} else {
				me.pipe.send({
					c: reqPacket.c,
					d: handler(reqPacket.d)
				});
			}
		}
	};

	// Public functions
	// ================

	pub.openRequestor = function (name, responderContext) {
		if (requestorByName[name]) {
			return requestorByName[name]
		}
		return (requestorByName[name] = new RequestorEndPoint(name, responderContext));
	};

	/**
	 * There is only one responder allowed wih any given name. If you 
	 * need more than one responder, then maybe you should consider using
	 ( publisher-subscriber pattern
	 */
	pub.openResponder = function (name, handler, requestContext) {
		if (responderByName[name]) {
			throw new Error('Responder "' + name + '" already defined');
		}
		return new ResponderEndPoint(name, handler, requestContext);
	};

	// TODO: prepare convinient shortcut for sharing requestors
	pub.request = function (name, data, callback) {
		var requestor = this.openRequestor(name);
		requestor.request(data, callback);
		return requestor;
	};

	return pub;
});
