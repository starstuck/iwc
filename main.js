/*!
 * iwc 0.1.0 - A Inter-Window/Worker Communication suite.
 * Available via MIT license.
 * See http://github.com/szarsti/iwc for details.
 */

/*global define, requirejs, window*/

// If running in node, include amd style module definitions
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
	"use strict";
	return {
		pipe: require('./lib/pipe'),
		reqresp: require('./lib/reqresp'),
		util: {
			ajax: require('./lib/util/ajax')
		}
	};
});

// If running in browser expose whole module in window namespace
if (typeof window === 'object') {
	requirejs(['main'], function (iwc) {
		"use strict";
		window.iwc = iwc;
	});
}
