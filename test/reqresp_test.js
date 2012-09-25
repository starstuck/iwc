/*global define, describe, before, after, afterEach, it, expect, window, idc*/
/*jslint nomen:true, regexp:true*/

define(function (require) {
	"use strict";
	var helpers = require('./helpers'),
		reqresp = require('../lib/reqresp');

	describe('reqresp', function () {

		describe('RequestorEndPoint', function () {
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
						function (r, c) { setTimeout(function () { c(r + ' 1Pong!'); }, 45); },
						function (r, c) { c(r + ' 2Pong!'); },
						function (r, c) { setTimeout(function () { c(r + ' 3Pong!'); }, 5); },
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
							done();
							window.responder01 = undefined;
						});

						requestor.request('2Ping!', respHandler);
						requestor.request('3Ping!', respHandler);
					}
				);
			});

			it('should auto-create frame and queue requests', function (done) {
				var url = window.location.toString().replace(/[^\/]*.html(\?.*)?$/, ''),
					ping = reqresp.openRequestor(url + 'fixtures/pongframe.html#pong'),
					result = [];

				ping.request('Ping1', function (resp) { result.push(resp); });
				ping.request('Ping2', function (resp) {
					result.push(resp);
					expect(result.toString()).to.equal(
						'Ping1 1Pong!,Ping2 2Pong!'
					);
					done();
				});
			});
		});

		describe('#openRequestor', function () {
			it('should reuse the same requestor object');
		});

		describe('#openResponder', function () {
			it('should allow only one responder with the same name');
		});

		describe('#request', function () {
			var frameUrl = window.location.toString().replace(/[^\/]*.html(\?.*)?$/, '') + 'fixtures/pongframe.html',
				pingServiceUri = frameUrl + '#pong';

			it('should reuse requestor and queue requests', function (done) {
				var result = [],
					req1,
					req2,
					counter;

				reqresp.request(pingServiceUri, 'Ping1', function (resp) {
					result.push(resp);
					counter = parseInt(resp.match(/(\d)Pong/)[1], 10);
				});
				reqresp.request(pingServiceUri, 'Ping2', function (resp) {
					result.push(resp);
					expect(req2).to.equal(req1);
					expect(result.toString()).to.equal(
						'Ping1 ' + counter + 'Pong!,Ping2 ' + (counter + 1) + 'Pong!'
					);
					reqresp.request(pingServiceUri, 'Ping3', function (resp) {
						result.push(resp);
						expect(result.toString()).to.equal(
							'Ping1 ' + counter + 'Pong!,Ping2 ' + (counter + 1) + 'Pong!,Ping3 ' + (counter + 2) + 'Pong!'
						);
						done();
					});
				});
			});
		});

		describe('ResponderEndPoint', function () {
			var dummyResponder,
				pipeOut = '',
				responsePipe;

			before(function () {
				dummyResponder = reqresp.openResponder('dummy', null);
				responsePipe = {
					send: function (msg) {
						pipeOut += msg.d;
						if (this.onSend) {
							this.onSend();
						}
					}
				};
				dummyResponder.getResponsePipe = function () {
					return responsePipe;
				};
			});

			after(function () {
				dummyResponder = null;
				responsePipe = null;
			});

			afterEach(function () {
				pipeOut = '';
			});

			describe('#handleRequest', function () {
				it('should call synchronous handlers', function () {
					dummyResponder.handler = function (data) {
						return data + ' Pong!';
					};
					dummyResponder.handleRequest({c: 1, d: 'Ping'}, {});
					expect(pipeOut).to.equal('Ping Pong!');
				});

				it('should call asynchronous handlers', function (done) {
					dummyResponder.handler = function (data) {
						return data + ' Pong!';
					};
					responsePipe.onSend = function () {
						expect(pipeOut).to.equal('Ping Pong!');
						done();
					};
					dummyResponder.handleRequest({c: 1, d: 'Ping'}, {});
				});
			});
		});

	});
});
