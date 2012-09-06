/*global define, requirejs, window*/

define(function (require) {
	"use strict";

	console.debug('Got context:', this);
	return {
		pipe: require('./lib/pipe')
	};
});
