/*global define, describe, it, expect, window*/
/*jslint nomen:true, regexp:true*/

define(function (require) {
	"use strict";

	var helpers = require('./helpers'),
		pipe = require('../lib/pipe');

	describe('pipe', function () {

		var localContextUri = window.location.toString().replace(/#.*$/, '');

		it('should setup pipe to send message to default recipient', function (done) {
			var frame = helpers.setupFrame(
				['../lib/pipe.js'],
				function (pipe) {
					pipe.addRecipient(function (data, pipeEnd) {
						window.parent.recipient01(data, pipeEnd);
					});
				},
				function (frame) {
					pipe.open(frame.contentWindow).send('Single message');
				}
			);

			window.recipient01 = function (message) {
				expect(message).to.equal('Single message');
				helpers.tearDownFrame(frame);
				delete window.recipient01;
				done();
			};
		});

		it.skip('should not confuse local and remote recipients', function (done) {
		});

		describe('#open', function () {
			var pipeFrameUri = localContextUri.replace('test.html', 'fixtures/pipeframe.html');

			it.skip('should open pipe with default name and load external frame', function () {
				var framesCount = window.frames.length,
					p = pipe.open(pipeFrameUri);

				expect(p.name).to.equal('default');
				expect(p.context).to.be.an('undefined');
				expect(window.frames.length).to.equal(framesCount + 1);
			});

			it.skip('should reuse existing frame', function () {
			});

			it.skip('should queue messages and send when context is ready', function () {
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
		});
	});
});
