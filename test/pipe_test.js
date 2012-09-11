/*global define, describe, it, expect, before, window*/
/*jslint nomen:true, regexp:true*/

define(function (require) {
	"use strict";

	var helpers = require('./helpers'),
		pipe = require('../lib/pipe');

	describe('pipe', function () {

		var localContextUri = window.location.toString().replace(/#.*$/, '');

		it('should setup pipe and send message to default recipient', function (done) {
			var frame = helpers.setupFrame(
				['../lib/pipe.js'],
				function (pipe) {
					pipe.addRecipient(function (data) {
						window.parent.recipient01(data);
					});
				},
				function (frame) {
					pipe.open(frame.contentWindow).send('Single message');
				}
			);

			window.recipient01 = function (message) {
				expect(message).to.equal('Single message');
				helpers.tearDownFrame(frame);
				done();
				window.recipient01 = undefined;
			};
		});

		it('should not confuse local and remote recipients');

		describe('#open', function () {
			var pipeFrameUri = localContextUri.replace('test.html', 'fixtures/pipeframe.html');

			it('should open pipe with default name and load external frame', function (done) {
				var framesCount = window.frames.length,
					p = pipe.open(pipeFrameUri),
					wFrames,
					frame;

				expect(p.name).to.equal('default');
				expect(p.context).to.be.an('undefined');

				wFrames = window.frames;
				expect(wFrames.length).to.equal(framesCount + 1);

				frame = wFrames[framesCount];
				(function (listener) {
					if (frame.addEventListener) {
						frame.addEventListener('load', listener);
					} else {
						frame.attachEvent('onload', listener);
					}
				}(function () {
					expect(frame.location.toString()).to.equal(pipeFrameUri);
					done();
				}));
			});

			it('should reuse existing frame');

			it('should queue messages and send when remote dispatcher is ready', function (done) {
				var remoteUri = localContextUri.replace('test.html', 'fixtures/logframe.html'),
					p = pipe.open(remoteUri),
					contextSetter = p.setContext;

				p.send('Message 1');
				p.send('Message 2');
				// Hack into context setter, so we can carry on after
				// pipe recive full context. Maybe we should introduce
				// pipe events
				p.setContext = function (context) {
					contextSetter.call(p, context);
					// We need to do tests after some time, so browser
					// has time to pass those messages
					setTimeout(function () {
						expect(p.queue).to.be.an('undefined');
						expect(context.messageLog.toString()).to.equal(
							'Message 1,Message 2'
						);
						done();
					}, 15);
				};
			});
		});

		describe('#_decodeMessage', function () {

			it('should fail on unrecognised message format', function (done) {
				try {
					pipe._decodeMessage('Some message');
				} catch (err) {
					if (err.type === 'MessageDecodingError') {
						done();
					} else {
						done(err);
					}
				} finally {
					done("Expected to fail");
				}
			});

			it('should decode encoded string value', function () {
				var encoded = pipe._encodeMessage('default', 'Text message'),
					decoded;

				expect(encoded).to.be.a('string');
				decoded = pipe._decodeMessage(encoded).data;
				expect(decoded).to.equal('Text message');
			});

			it('should decode encoded number value', function () {
				var encoded = pipe._encodeMessage('default', 12),
					decoded;

				expect(encoded).to.be.a('string');
				decoded = pipe._decodeMessage(encoded).data;
				expect(decoded).to.be.a('number');
				expect(decoded).to.be(12);
			});

			// TODO: does not work right now
			it.skip('should decode encoded date value', function () {
				var date = new Date(),
					encoded = pipe._encodeMessage('default', date),
					decoded;
				expect(encoded).to.be.a('string');
				decoded = pipe._decodeMessage(encoded).data;
				expect(decoded).to.be.an('object');
				expect(decoded).to.equal(date);
			});

			it('should decode encoded object value', function () {
				var encoded = pipe._encodeMessage('default', {a: 12, b: 'text'}),
					decoded;

				expect(encoded).to.be.a('string');
				decoded = pipe._decodeMessage(encoded).data;
				expect(decoded).to.be.a('object');
				expect(decoded.a).to.be(12);
				expect(decoded.b).to.equal('text');
			});
		});

		describe('#_expandPipeUri', function () {
			it('should expand local name', function () {
				expect(pipe._expandPipeUri('default').toString())
					.to.equal(localContextUri + '#default');
			});

			it('should fill default target', function () {
				expect(pipe._expandPipeUri('http://www.example.com/').toString())
					.to.equal('http://www.example.com/#default');
			});

			it('should expand protocolless uri', function () {
				expect(pipe._expandPipeUri('//www.example.com/').toString())
					.to.equal(window.location.protocol + '//www.example.com/#default');
			});

			it('should recognise parts in full uri ', function () {
				var pipeUri = pipe._expandPipeUri('http://www.example.com/#custompipe');
				expect(pipeUri.toString()).to.equal('http://www.example.com/#custompipe');
				expect(pipeUri.contextUri).to.equal('http://www.example.com/');
				expect(pipeUri.name).to.equal('custompipe');
			});

			it('should recognise hostless absolute path');

			it('should recognise relative path');
		});

	});
});
