/*global define, describe, it, expect, location*/
/*jslint regexp:true*/

define(function (require) {
	"use strict";

	var ajax = require('../lib/util/ajax');

	describe('util/ajax', function () {
		it.skip('should make ajax call through proxy frame', function (done) {
			var path = location.pathname.replace(/[^\/]*.html$/, '');
			ajax.get('//127.0.0.1' + path, function (resp) {
				expect(resp.status).to.equal('200');
				// TODO: test parsed json content
			});
		});
	});
});
