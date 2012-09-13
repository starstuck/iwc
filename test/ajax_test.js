/*global define, describe, it, expect, location*/
/*jslint regexp:true*/

define(function (require) {
	"use strict";

	var ajax = require('../lib/util/ajax'),
		helpers = require('helpers');

	describe('util/ajax', function () {

		it('should make ajax call through proxy frame', function (done) {
			var path = location.pathname.replace(/[^\/]*.html$/, ''),
				hostAlias = helpers.getHostAlias();

			ajax.registerProxy('//' + hostAlias + path + 'fixtures/ajaxproxy.html');
			ajax.get('//' + hostAlias + path + 'fixtures/data.json', function (resp) {
				expect(resp.succeded).to.equal('OK');
				done();
			});
		});

		it('should make same domain ajax requests straight away');

		it('should make few requests in parallel', function (done) {
			var path = location.pathname.replace(/[^\/]*.html$/, ''),
				hostAlias = helpers.getHostAlias(),
				otherFinished = false;

			ajax.registerProxy('//' + hostAlias + path + 'fixtures/ajaxproxy.html');
			ajax.get('//' + hostAlias + path + 'fixtures/data.json', function (resp) {
				expect(resp.succeded).to.equal('OK');
				otherFinished = true;
			});
			ajax.get('//' + hostAlias + path + 'fixtures/data2.json', function (resp) {
				expect(resp.message).to.equal('Success');
				if (otherFinished) {
					done();
				}
			});
		});
	});
});
