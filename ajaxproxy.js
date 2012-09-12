/*!
 * iwc 0.1.0 - A Inter-Window/Worker Communication suite.
 * Available via MIT license.
 * See http://github.com/szarsti/iwc for details.
 *
 * Self contained ajax proxy library
 */

/*global define, requirejs, window*/

// If running in node, include amd style module definitions
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
	"use strict";
	return {
		util: {
			ajaxproxy: require('./lib/util/ajaxproxy')
		}
	};
});

// If running in browser expose whole module in window namespace
if (typeof window === 'object') {
	window.iwc = require('ajaxproxy');
}

