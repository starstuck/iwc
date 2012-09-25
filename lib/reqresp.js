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
		requestorCounter = 0,
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
		var me = this,
			myPipe;
		me.name = name;
		me.counter = 0;
		me.id = 'rqstr-' + (requestorCounter += 1); // we need to have unique requestor id, which will be used as cache key for response pipes
		me.respHandler = {};
		// Requests  pie can have remote name
		myPipe = me.pipe = pipe.open(name + '-req', responderContext);
		// Recipient will always use local name
		pipe.addRecipient(myPipe.name.replace('-req', '-resp'), function (resp) {
			me.handleResponse(resp);
		}, myPipe.destiny);
	}

	RequestorEndPoint.prototype = {
		// TODO: add erro handling on request timeouts
		request: function (req, handler) {
			var rId = this.counter += 1,
				reqPacket = {
					c: rId,
					d: req,
					r: this.id
				};
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
	function ResponderEndPoint(name, handler, allowedOrigins) {
		var me = this;

		me.pipes = {};
		me.name = name;
		me.handler = handler;

		pipe.addRecipient(name + '-req', function (req, event) {
			me.handleRequest(req, event);
		}, allowedOrigins);
	}

	ResponderEndPoint.prototype = {

		/**
		 * Get reposne pipe for particular event source and origin
		 *
		 * @protected
		 */
		getResponsePipe: function (cId, context, destiny) {
			var pipes = this.pipes;
			if (!pipes[cId]) {
				pipes[cId] = pipe.open(destiny + '/#' + this.name + '-resp', context);
			}
			return pipes[cId];
		},

		handleRequest: function (reqPacket, event) {
			var me = this,
				handler = me.handler,

				// We are using requestor id for cachin response pipes, because
				// access to event source window location or name may be not allowed
				respPipe = me.getResponsePipe(reqPacket.r, event.source, event.origin);

			// Lets assume, that if handler accepts 2 arguments then it 
			// support asynchronous call
			if (handler.length >= 2) {
				handler(reqPacket.d, function (resp) {
					// Callback when request is processed - sent response data to requestor
					respPipe.send({
						c: reqPacket.c,
						d: resp
					});
				});
			} else {
				respPipe.send({
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
			return requestorByName[name];
		}
		return (requestorByName[name] = new RequestorEndPoint(name, responderContext));
	};

	/**
	 * There is only one responder allowed wih any given name. If you 
	 * need more than one responder, then maybe you should consider using
	 ( publisher-subscriber pattern
	 */
	pub.openResponder = function (name, handler, allowedOrigins) {
		if (responderByName[name]) {
			throw new Error('Responder "' + name + '" already defined');
		}
		return new ResponderEndPoint(name, handler, allowedOrigins);
	};

	// TODO: prepare convinient shortcut for sharing requestors
	pub.request = function (name, data, callback) {
		var requestor = this.openRequestor(name);
		requestor.request(data, callback);
		return requestor;
	};

	return pub;
});
