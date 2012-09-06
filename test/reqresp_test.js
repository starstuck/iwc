/*global define, describe, before, after, afterEach, it, expect, window, idc*/
/*jslint nomen:true*/

define(function (require) {
	"use strict";
	var helpers = require('./helpers'),
		reqresp = require('../lib/reqresp');

	describe('idc.reqresp', function () {

		it('should sent simple request and response', function (done) {
			helpers.setupFrame(
				['../lib/reqresp.js'],
				function (reqresp) {
					reqresp.openResponder('conversation', function (req) {
						return req + ' Pong!';
					});
				},
				function (frame) {
					reqresp.openRequestor('conversation', frame.contentWindow)
						.request('Ping', function (resp) {
							expect(resp).to.equal('Ping Pong!');
							helpers.tearDownFrame(frame);
							done();
						});
				}
			);
		});

		it('should should handle responses out of order', function (done) {
			var result = [],
				responseHandlers = [
					function (r, c) { setTimeout(function () { c(r + ' 1Pong!'); }, 30); },
					function (r, c) { c(r + ' 2Pong!'); },
					function (r, c) { setTimeout(function () { c(r + ' 3Pong!'); }, 15); },
				];

			window.responder01 = function (req, callback) {
				var responder = responseHandlers.shift();
				responder(req, callback);
			};

			helpers.setupFrame(
				['../lib/reqresp.js'],
				function (reqresp) {
					reqresp.openResponder('multireq', function (req, callback) {
						window.parent.responder01(req, callback);
					});
				},
				function (frame) {
					var requestor = reqresp.openRequestor('multireq', frame.contentWindow),
						respHandler = function (resp) { result.push(resp); };

					// First request should be the longest
					requestor.request('1Ping!', function (resp) {
						respHandler(resp);
						expect(result.join(', ')).to.equal([
							'2Ping! 2Pong!',
							'3Ping! 3Pong!',
							'1Ping! 1Pong!'
						].join(', '));
						delete window.responder01;
						done();
					});

					requestor.request('2Ping!', respHandler);
					requestor.request('3Ping!', respHandler);
				}
			);
		});


		describe('ResponderEndPoint', function () {
			var dummyResponder,
				pipeOut = '';

			before(function () {
				dummyResponder = reqresp.openResponder('dummy', null);
				dummyResponder.pipe = {
					send: function (msg) {
						pipeOut += msg.d;
						if (this.onSend) {
							this.onSend();
						}
					}
				};
			});

			after(function () {
				dummyResponder = null;
			});

			afterEach(function () {
				pipeOut = '';
			});

			describe('#handleRequest', function () {
				it('should call synchronous handlers', function () {
					dummyResponder.handler = function (data) {
						return data + ' Pong!';
					};
					dummyResponder.handleRequest({c: 1, d: 'Ping'});
					expect(pipeOut).to.equal('Ping Pong!');
				});

				it('should call asynchronous handlers', function (done) {
					dummyResponder.handler = function (data) {
						return data + ' Pong!';
					};
					dummyResponder.pipe.onSend = function () {
						expect(pipeOut).to.equal('Ping Pong!');
						done();
					};
					dummyResponder.handleRequest({c: 1, d: 'Ping'});
				});
			});
		});

	});
});
