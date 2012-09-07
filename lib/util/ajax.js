/*global define, window*/
/*jslint nomen:true*/

/**
 * Ajax use reqwest library for making actucall call.
 */
define(function (require) {
	"use strict";

	var reqwest = require('reqwest'),
		reqresp = require('../reqresp'),

		hostRe = new RegExp('([a-zA-Z]:)?//([a-zA-Z0-9-.]+)(:[0-9]+)?(/|$)'),
		successStatusRe = new RegExp('^20[0-9]$'),

		proxyByHost = {};

	// Reponse object is built from serialised message
	// TODO: consider optimising format, especially not to sent text 2 times,
	// but still have raw text and parsed jsno available
	function Response(message) {
		this.status = message.status;
		this.response = message.response;
		this.headers = message.headers;
		//this.responseText = message.responseText;
	}

	function buildReqwestOpts(method, url, data, callback) {
		// TODO: make more rocust solution ,shiwch will recognise differnent
		return {
			method: method,
			url: url,
			data: data,
			complete: callback
		};
	}

	function buildResponseHandler(opts) {
		var completeCb = opts.complete,
			successCb = opts.success,
			errorrCb = opts.error;

		// Callbacks are deleted from oryginal options. They can not be serialised.
		//delete opts.complete;
		//delete opts.success;
		//delete opts.error;

		return function (message) {
			var response = new Response(message),
				data = response.response;

			if (successStatusRe.exec(response.status)) {
				if (successCb) { successCb(data); }
			} else {
				if (errorrCb) { errorrCb(data); }
			}
			if (completeCb) { completeCb(data); }
		};
	}

	// Extract protocol and host part from url
	function extractHostFromUrl() {
	}

	/**
	 * 
	 * @param {String} url Proxy frame. It should url of frame, which includes proper ajax proxy responder.
	 * @param {String} [host] Optional host url. All urls starting with this host url will be
	 *        sent through the proxy. If ommited, host part will be extracted from proxy url
	 */
	function registerProxy(url, hostUrl) {
		// TOOD implement true proxies registry
		proxyByHost = url + '#ajax';
	}

	function getProxyForTarget(url) {
		return proxyByHost;
	}

	function ajax(method, url, data, callback) {
		var opts = buildReqwestOpts(method, url, data, callback),
			hostMatch = hostRe.exec(opts.url),
			host,
			proto,
			port,
			loc,
			peroxy;

		if (!hostMatch) {
			// If domain regexp dies not match, it means we have relative, local url
			reqwest(opts);
		} else {
			proto = hostMatch[0];
			host = hostMatch[1];
			port = hostMatch[2] || '';
			loc = window.location;
			if (host === loc.host && (!proto || proto === loc.protocol) && port === loc.port) {
				// If request it to full url, but it matches, then just 
				// fire it directly
				reqwest(opts);
			} else {
				reqresp.request(
					getProxyForTarget(opts.url),
					opts,
					buildResponseHandler(opts)
				);
			}
		}
	}

	return {
		registerProxy: registerProxy,
		ajax: ajax,
		get: function (url, callback) {
			return ajax('GET', url, '', callback);
		},
		post: function (url, data, callback) {
			return ajax('POST', url, data, callback);
		},
		put: function (url, data, callback) {
			return ajax('PUT', url, data, callback);
		},
		delete: function (url, data, callback) {
			return ajax('DELETE', url, data, callback);
		},

		// #ifdef DEBUG
		// Instarnal stuff exposed for unit testing
		_extractHost: extractHostFromUrl
		// #endif
	};
});
