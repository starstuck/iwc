(function () {
/*global define, document*/

define('test/helpers',['require'],function (require) {
	

	return {
		/**
		 * @param {String} script Script contetn which will be injected into created frame
		 */
		setupFrame: function (srcs, script, callback) {
			var frame = document.createElement('iframe'),
				frameDoc;

			if (typeof script === 'function') {
				script = script.toString();
			} else if (script.join) {
				script = script.join('\n    ');
			}

			frame.style.display = 'none';
			frame.src = 'about:blank';
			document.body.appendChild(frame);
			frameDoc = frame.contentWindow.document;
			frameDoc.open();
			frameDoc.write([
				'<html><head>',
				'<script src="../node_modules/requirejs/require.js"></script>',
				'<script>',
				'  requirejs(',
				'    [' + srcs.map(function (src) { return '"' + src + '"'; }).join(', ') + '],',
				'    ' + script,
				'  );',
				'</script>',
				'</head></html>'
			].join('\n'));
			frameDoc.close();

			frame.addEventListener('load', function () {
				callback(frame);
			});

			return frame;
		},

		tearDownFrame: function (frame) {
			document.body.removeChild(frame);
		}
	};
});
/*global define, window*/
/*jslint nomen:true, regexp:true*/

define('lib/pipe',[],function () {
	

	var	pub = {}, // module namespace

		// Unique prefix, which will be used to distinguish messages sent 
		// within pipes, from those sent by manual call to postMessage
		messagePrefix = 'idc-',
		messageSeparator = '?',
		defaultPipeName = 'default',
		pipeUriRe = new RegExp('^([a-z]+:)?//([a-zA-Z0-9-.]+/?[^#]*)(#(.*))?$'),
		pipeNameRe = new RegExp('^[a-zA-Z0-9-]+$'),
		urlHashRe = new RegExp('(#(.*))?$'),

		// Module context
		localContext = window,
		localContextUri = localContext.location.toString().replace(/#[^#]*$/, 's'),

		// Hash of already instantiated pipes by their full URI
		pipeByUri = {},

		// Hash of known frames by contextUri
		contextByUri = {},

		// Multiple lists of local recipients, by pipe name
		// Starts with null, as indication that local message dispatcher
		// must be initialised first, beforning setting hash values
		localRecipients = null,

		// Multiple lists of recipiens, which will still externall calls.
		// Organised in 2 dimension table by remote contextUri and pipe name
		externalRecipients = {};


	// Private functions
	// =================

	function encodeMessage(pipeName, data) {
		return messagePrefix + pipeName + messageSeparator + '{"v":' + JSON.stringify(data) + '}';
	}

	function MessageDecodingError(message) {
		Error.call(this, message);
	}

	MessageDecodingError.prototype = new Error();
	MessageDecodingError.prototype.type = 'MessageDecodingError';

	function decodeMessage(rawData) {
		var prefixLen = messagePrefix.length,
			separatorIndex,
			name,
			data;

		if (rawData.slice(0, prefixLen) === messagePrefix) {
			rawData = rawData.slice(prefixLen);
		} else {
			throw new MessageDecodingError('Message does not match pipe message format');
		}

		separatorIndex = rawData.indexOf(messageSeparator);
		name = rawData.slice(0, separatorIndex);
		data = JSON.parse(rawData.slice(separatorIndex + 1)).v;
		return {
			name: name,
			data: data
		};
	}

	/**
	 * Message handler, which will dispatch message to recipients interested
	 * in reciving data from particular pipe.
	 *
	 * This dispatcher will consider only local recipients.
	 *
	 * @private
	 */
	function dispatchMessage(event) {
		var processed = false,
			message,
			recipients,
			l,
			i;

		try {
			message = decodeMessage(event.data);
		} catch (err) {
			if (err.type !== 'MessageDecodingError') {
				throw err;
			} else {
				// #ifdef DEBUG
				console.info('idc.pipe.MessageDispatcher ignored not prefixed message: ', event.data);
				// #endif
				return;
			}
		}

		// #ifdef DEBUG
		console.debug('idc.pipe.MessageDispatcher at ' + localContextUri + ' dispatching: ', message);
		// #endif

		recipients = localRecipients[message.name];
		if (recipients) {
			for (i = 0, l = recipients.length; i < l; i += 1) {
				recipients[i].call(localContext, message.data);
				// #ifdef DEBUG
				processed = true;
				// #endif
			}
		}

		// #ifdef DEBUG
		if (!processed) {
			console.warn('idc.pipe.MessageDispatcher did not found recipient for: ', event.data);
			console.debug('Got recipients:', localRecipients);
		}
		// #endif
	}

	function initMessageDispatcher() {
		if (localContext.addEventListener) {
			localContext.addEventListener('message', dispatchMessage, false);
		} else {
			localContext.attachEvent('onmessage', dispatchMessage);
		}
		localRecipients = {};
	}

	function PipeUri(contextUri, name) {
		this.contextUri = contextUri;
		this.name = name;
	}
	PipeUri.prototype = {
		toString: function () {
			return this.contextUri + '#' + this.name;
		}
	};

	/**
	 * Normalise and expand pipe uri
	 */
	function expandPipeUri(uri) {
		var match,
			result,
			name,
			contextUri,
			ln;

		if (!uri) {
			uri = defaultPipeName;
		}

		if (pipeNameRe.exec(uri)) {
			name = uri;
			contextUri = localContextUri;
		} else {
			match = pipeUriRe.exec(uri);
			if (match) {
				contextUri = (match[1] || localContext.location.protocol) + '//' + match[2];
				name = match[4] || defaultPipeName;
			} else {
				throw new Error('Invalid pipe uri: ' + uri);
			}
		}
		return new PipeUri(contextUri, name);
	}

	function getContextByUri(contextUri) {
		var context = contextByUri[contextUri],
			frame,
			loaded,
			callback,
			onLoad,
			asyncFactory;

		// If context is not here, return asynchronous function, which will
		// accept callback, when will be called when finally constext is created
		if (!context) {
			frame = localContext.document.createElement('frame');
			frame.style.display = 'none';
			frame.src = contextUri;

			//TODO: check if there are no unnecessary reference loops,
			// which may couse potential memory leaks
			onLoad = function () {
				context = contextByUri[contextUri] = frame.contentWindow;
				if (callback) {
					callback(context);
				}
			};

			asyncFactory = function (cb) {
				if (context) {
					cb(context);
				} else {
					callback = cb;
				}
			};

			if (frame.addEventListener) {
				frame.addEventListener('onload', onLoad);
			} else {
				frame.attachEvent('onload', onLoad);
			}
		}

		return context;
	}

	// Internal classes
	// ================
	// Object implementing those classes may get returned, but people outside
	// of this module shoul never create them naually

	/**
	 * @param {Object} bject supporting message like window, worker, or frame
	 */
	function MessagePipe(name, context) {
		var me = this;

		me.name = name;
		// If context is function, than assume it is asynchronous context factory
		if (typeof context === 'function') {
			context(function (context) { me.setContext(context); });
		} else {
			me.setContext(context);
		}
	}

	MessagePipe.prototype = {
		/**
		 * Context setter. If there are any messages ququed when context is 
		 * set, then send them.
		 */
		setContext: function (context) {
			var queue = this.queue,
				i,
				l;

			this.context = context;
			if (queue) {
				// It is importand to sent messages from queue in the 
				// same order inwhich they were stashed
				for (i = 0, l = queue.length; i < l; i += 1) {
					this.send(queue[i]);
				}
				delete this.queue;
			}
		},

		push: function (data) {
			var q = this.queue;
			if (!q) { q = this.queue = []; }
			q.push(data);
		},

		/**
		 * If context is not ready yet, messages will be queued, to be 
		 * dispatched on context ready
		 *
		 * @returns {Object} The pipe object
		 */
		send: function (data) {
			if (this.context) {
				this.context.postMessage(encodeMessage(this.name, data), '*');
			} else {
				this.push(data);
			}
			return this;
		}
	};

	// private functions are exposed for unit testing. They should never
	// be invoked manually
	// #ifdef DEBUG
	pub._encodeMessage = encodeMessage;
	pub._decodeMessage = decodeMessage;
	pub._expandPipeUri = expandPipeUri;
	// #endif

	// Public funcitons
	// ================

	/**
	 * Pipe uri can be in format:
	 *  * simple string reflecting pipe name
	 *  * url starting with frame hrml file followed by hash and pipe name, like
	 *      http://example.com/some-proxy.html#cookie
	 * 
	 * In later case hidden frame will be created for selected url
	 *
	 * It is allowed to have only one pipe for unique uri, so if you try
	 * to open again pipe to the same location, this method will give you back
	 * already created instance
	 */
	pub.open = function (uri, context) {
		var pipeUri,
			contextUri,
			name;

		if (typeof uri === 'object') {
			context = uri;
			uri = defaultPipeName;
		}

		pipeUri = expandPipeUri(uri);
		if (pipeByUri[pipeUri]) {
			return pipeUri[pipeUri];
		}

		if (!context) {
			context = getContextByUri(pipeUri.contextUri);
		}

		return (pipeByUri[pipeUri] = new MessagePipe(pipeUri.name, context));
	};

	/**
	 * Send via existing pipe. You can provide pipe name. In case it does not
	 * exis
	 *
	 * @param {String} pipe Pipe name
	 * @param {Object} data whichi will be sent
	 * @returns {Object} Pipe which was used for sending data
	 */
	pub.send = function (pipe, data) {
		if (typeof pipe === 'string') {
			pipe = pub.open(pipe);
		}
		return pipe.send(data);
	};

	/**
	 * If recipient uri is in full domain, then its behaviour can differ
	 * 
	 * TODO: handle full uri as pipe name
	 *
	 * @returns module for calls chaining
	 */
	pub.addRecipient = function (uri, handler, allowedOrigins) {
		var recipients,
			recipientRegistry,
			pipeUri,
			contextUri,
			name;

		if (typeof uri === 'function') {
			allowedOrigins = handler;
			handler = uri;
			uri = null;
		}
		if (!uri) {
			uri = defaultPipeName;
		}

		pipeUri = expandPipeUri(uri);
		name = pipeUri.name;
		contextUri = pipeUri.contextUri;

		if (contextUri === localContextUri) {
			// If local messages are null, then we need to initialise
			// local message dispatcher
			if (!localRecipients) {
				initMessageDispatcher();
			}
			recipientRegistry = localRecipients;
		} else {
			recipientRegistry = externalRecipients[contextUri];
			if (!recipientRegistry) {
				recipientRegistry = externalRecipients[contextUri] = {};
			}
		}

		recipients = localRecipients[name];
		if (!recipients) {
			recipients = localRecipients[name] = [];
		}
		recipients.push(handler);

		return pub;
	};

	// TODO: add cleanup functions like close pipe and removeRecipient
	return pub;
});

/*global define, describe, it, expect, window*/
/*jslint nomen:true, regexp:true*/

define('test/pipe_test',['require','./helpers','../lib/pipe'],function (require) {
	

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

/*global define, window*/

/**
 * Module provides convinience methods for hanlding bi-directional comunicaiton
 * between frames using request - response pattern
 */
define('lib/reqresp',['require','./pipe'],function (require) {
	

	var pub = {}, // Publicly exposed module
		pipe = require('./pipe');

	// Private functions
	// =================

	// Internal classes
	// ================

	// TODO: add support for closing channels

	/**
	 * Requests are queued numbered, so when we got response for each 
	 * request, then we can invoke proper handelr, wven if there is more
	 * than one requests waiting for response at the moment.
	 *
	 * @param {String} channel identifier
	 * @param {Object} responderContext responder pipe end context
	 */
	function RequestorEndPoint(name, responderContext) {
		var  me = this;
		me.counter = 0;
		me.respHandler = {};
		me.pipe = pipe.open(name + '-req', responderContext);
		pipe.addRecipient(name + '-resp', function (resp) {
			me.handleResponse(resp);
		});
	}

	RequestorEndPoint.prototype = {
		// TODO: add erro handling on request timeouts
		request: function (req, handler) {
			var rId = this.counter += 1,
				reqPacket = {c: rId, d: req};

			this.respHandler[rId] = handler;
			this.pipe.send(reqPacket);
		},

		handleResponse: function (respPacket) {
			var rId = respPacket.c,
				handler = this.respHandler[rId];

			if (handler) {
				handler(respPacket.d);
				delete this.respHandler[rId];
			} else {
				return new Error('Duplicated response in ' + this.pipe.name.replace(/-req$/, '') + ' pipe: ' + JSON.stringify(respPacket));
			}
		}
	};

	/**
	 * @constructor
	 * @param {Object} [requestorContext] Context in which requestor lives. By default it will be parent window
	 */
	function ResponderEndPoint(name, handler, requestorContext) {
		var me = this;

		if (!requestorContext) {
			requestorContext = window.parent;
		}

		me.handler = handler;
		me.pipe = pipe.open(name + '-resp', requestorContext);

		pipe.addRecipient(name + '-req', function (req) {
			me.handleRequest(req);
		});
	}

	ResponderEndPoint.prototype = {
		handleRequest: function (reqPacket) {
			var me = this,
				handler = me.handler;

			// Lets assume, that if handler accepts 2 arguments then it 
			// support asynchronous call
			if (handler.length >= 2) {
				handler(reqPacket.d, function (resp) {
					// Callback when request is done
					// Sent response data to requestor
					me.pipe.send({
						c: reqPacket.c,
						d: resp
					});
				});
			} else {
				me.pipe.send({
					c: reqPacket.c,
					d: handler(reqPacket.d)
				});
			}
		}
	};

	// Public functions
	// ================

	pub.openRequestor = function (name, responderContext) {
		return new RequestorEndPoint(name, responderContext);
	};

	pub.openResponder = function (name, handler, requestContext) {
		return new ResponderEndPoint(name, handler, requestContext);
	};

	// TODO: prepare convinient shortcut for sharing requestors
	pub.request = function (name, data, callback) {
	};

	return pub;
});

/*global define, describe, before, after, afterEach, it, expect, window, idc*/
/*jslint nomen:true*/

define('test/reqresp_test',['require','./helpers','../lib/reqresp'],function (require) {
	
	var helpers = require('./helpers'),
		reqresp = require('../lib/reqresp');

	describe('reqresp', function () {

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

/*!
  * Reqwest! A general purpose XHR connection manager
  * (c) Dustin Diaz 2011
  * https://github.com/ded/reqwest
  * license MIT
  */
!function (name, definition) {
  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(name, definition)
  else this[name] = definition()
}('reqwest', function () {

  var win = window
    , doc = document
    , twoHundo = /^20\d$/
    , byTag = 'getElementsByTagName'
    , readyState = 'readyState'
    , contentType = 'Content-Type'
    , requestedWith = 'X-Requested-With'
    , head = doc[byTag]('head')[0]
    , uniqid = 0
    , lastValue // data stored by the most recent JSONP callback
    , xmlHttpRequest = 'XMLHttpRequest'
    , isArray = typeof Array.isArray == 'function' ? Array.isArray : function (a) {
        return a instanceof Array
      }
    , defaultHeaders = {
          contentType: 'application/x-www-form-urlencoded'
        , accept: {
              '*':  'text/javascript, text/html, application/xml, text/xml, */*'
            , xml:  'application/xml, text/xml'
            , html: 'text/html'
            , text: 'text/plain'
            , json: 'application/json, text/javascript'
            , js:   'application/javascript, text/javascript'
          }
        , requestedWith: xmlHttpRequest
      }
    , xhr = win[xmlHttpRequest] ?
        function () {
          return new XMLHttpRequest()
        } :
        function () {
          return new ActiveXObject('Microsoft.XMLHTTP')
        }

  function handleReadyState(o, success, error) {
    return function () {
      if (o && o[readyState] == 4) {
        if (twoHundo.test(o.status)) {
          success(o)
        } else {
          error(o)
        }
      }
    }
  }

  function setHeaders(http, o) {
    var headers = o.headers || {}, h
    headers.Accept = headers.Accept || defaultHeaders.accept[o.type] || defaultHeaders.accept['*']
    // breaks cross-origin requests with legacy browsers
    if (!o.crossOrigin && !headers[requestedWith]) headers[requestedWith] = defaultHeaders.requestedWith
    if (!headers[contentType]) headers[contentType] = o.contentType || defaultHeaders.contentType
    for (h in headers) {
      headers.hasOwnProperty(h) && http.setRequestHeader(h, headers[h])
    }
  }

  function generalCallback(data) {
    lastValue = data
  }

  function urlappend(url, s) {
    return url + (/\?/.test(url) ? '&' : '?') + s
  }

  function handleJsonp(o, fn, err, url) {
    var reqId = uniqid++
      , cbkey = o.jsonpCallback || 'callback' // the 'callback' key
      , cbval = o.jsonpCallbackName || ('reqwest_' + reqId) // the 'callback' value
      , cbreg = new RegExp('((^|\\?|&)' + cbkey + ')=([^&]+)')
      , match = url.match(cbreg)
      , script = doc.createElement('script')
      , loaded = 0

    if (match) {
      if (match[3] === '?') {
        url = url.replace(cbreg, '$1=' + cbval) // wildcard callback func name
      } else {
        cbval = match[3] // provided callback func name
      }
    } else {
      url = urlappend(url, cbkey + '=' + cbval) // no callback details, add 'em
    }

    win[cbval] = generalCallback

    script.type = 'text/javascript'
    script.src = url
    script.async = true
    if (typeof script.onreadystatechange !== 'undefined') {
        // need this for IE due to out-of-order onreadystatechange(), binding script
        // execution to an event listener gives us control over when the script
        // is executed. See http://jaubourg.net/2010/07/loading-script-as-onclick-handler-of.html
        script.event = 'onclick'
        script.htmlFor = script.id = '_reqwest_' + reqId
    }

    script.onload = script.onreadystatechange = function () {
      if ((script[readyState] && script[readyState] !== 'complete' && script[readyState] !== 'loaded') || loaded) {
        return false
      }
      script.onload = script.onreadystatechange = null
      script.onclick && script.onclick()
      // Call the user callback with the last value stored and clean up values and scripts.
      o.success && o.success(lastValue)
      lastValue = undefined
      head.removeChild(script)
      loaded = 1
    }

    // Add the script to the DOM head
    head.appendChild(script)
  }

  function getRequest(o, fn, err) {
    var method = (o.method || 'GET').toUpperCase()
      , url = typeof o === 'string' ? o : o.url
      // convert non-string objects to query-string form unless o.processData is false
      , data = (o.processData !== false && o.data && typeof o.data !== 'string')
        ? reqwest.toQueryString(o.data)
        : (o.data || null)
      , http

    // if we're working on a GET request and we have data then we should append
    // query string to end of URL and not post data
    if ((o.type == 'jsonp' || method == 'GET') && data) {
      url = urlappend(url, data)
      data = null
    }

    if (o.type == 'jsonp') return handleJsonp(o, fn, err, url)

    http = xhr()
    http.open(method, url, true)
    setHeaders(http, o)
    http.onreadystatechange = handleReadyState(http, fn, err)
    o.before && o.before(http)
    http.send(data)
    return http
  }

  function Reqwest(o, fn) {
    this.o = o
    this.fn = fn
    init.apply(this, arguments)
  }

  function setType(url) {
    var m = url.match(/\.(json|jsonp|html|xml)(\?|$)/)
    return m ? m[1] : 'js'
  }

  function init(o, fn) {
    this.url = typeof o == 'string' ? o : o.url
    this.timeout = null
    var type = o.type || setType(this.url)
      , self = this
    fn = fn || function () {}

    if (o.timeout) {
      this.timeout = setTimeout(function () {
        self.abort()
      }, o.timeout)
    }

    function complete(resp) {
      o.timeout && clearTimeout(self.timeout)
      self.timeout = null
      o.complete && o.complete(resp)
    }

    function success(resp) {
      var r = resp.responseText
      if (r) {
        switch (type) {
        case 'json':
          try {
            resp = win.JSON ? win.JSON.parse(r) : eval('(' + r + ')')
          } catch (err) {
            return error(resp, 'Could not parse JSON in response', err)
          }
          break;
        case 'js':
          resp = eval(r)
          break;
        case 'html':
          resp = r
          break;
        }
      }

      fn(resp)
      o.success && o.success(resp)

      complete(resp)
    }

    function error(resp, msg, t) {
      o.error && o.error(resp, msg, t)
      complete(resp)
    }

    this.request = getRequest(o, success, error)
  }

  Reqwest.prototype = {
    abort: function () {
      this.request.abort()
    }

  , retry: function () {
      init.call(this, this.o, this.fn)
    }
  }

  function reqwest(o, fn) {
    return new Reqwest(o, fn)
  }

  // normalize newline variants according to spec -> CRLF
  function normalize(s) {
    return s ? s.replace(/\r?\n/g, '\r\n') : ''
  }

  function serial(el, cb) {
    var n = el.name
      , t = el.tagName.toLowerCase()
      , optCb = function(o) {
          // IE gives value="" even where there is no value attribute
          // 'specified' ref: http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-862529273
          if (o && !o.disabled)
            cb(n, normalize(o.attributes.value && o.attributes.value.specified ? o.value : o.text))
        }

    // don't serialize elements that are disabled or without a name
    if (el.disabled || !n) return;

    switch (t) {
    case 'input':
      if (!/reset|button|image|file/i.test(el.type)) {
        var ch = /checkbox/i.test(el.type)
          , ra = /radio/i.test(el.type)
          , val = el.value;
        // WebKit gives us "" instead of "on" if a checkbox has no value, so correct it here
        (!(ch || ra) || el.checked) && cb(n, normalize(ch && val === '' ? 'on' : val))
      }
      break;
    case 'textarea':
      cb(n, normalize(el.value))
      break;
    case 'select':
      if (el.type.toLowerCase() === 'select-one') {
        optCb(el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null)
      } else {
        for (var i = 0; el.length && i < el.length; i++) {
          el.options[i].selected && optCb(el.options[i])
        }
      }
      break;
    }
  }

  // collect up all form elements found from the passed argument elements all
  // the way down to child elements; pass a '<form>' or form fields.
  // called with 'this'=callback to use for serial() on each element
  function eachFormElement() {
    var cb = this
      , e, i, j
      , serializeSubtags = function(e, tags) {
        for (var i = 0; i < tags.length; i++) {
          var fa = e[byTag](tags[i])
          for (j = 0; j < fa.length; j++) serial(fa[j], cb)
        }
      }

    for (i = 0; i < arguments.length; i++) {
      e = arguments[i]
      if (/input|select|textarea/i.test(e.tagName)) serial(e, cb)
      serializeSubtags(e, [ 'input', 'select', 'textarea' ])
    }
  }

  // standard query string style serialization
  function serializeQueryString() {
    return reqwest.toQueryString(reqwest.serializeArray.apply(null, arguments))
  }

  // { 'name': 'value', ... } style serialization
  function serializeHash() {
    var hash = {}
    eachFormElement.apply(function (name, value) {
      if (name in hash) {
        hash[name] && !isArray(hash[name]) && (hash[name] = [hash[name]])
        hash[name].push(value)
      } else hash[name] = value
    }, arguments)
    return hash
  }

  // [ { name: 'name', value: 'value' }, ... ] style serialization
  reqwest.serializeArray = function () {
    var arr = []
    eachFormElement.apply(function(name, value) {
      arr.push({name: name, value: value})
    }, arguments)
    return arr
  }

  reqwest.serialize = function () {
    if (arguments.length === 0) return ''
    var opt, fn
      , args = Array.prototype.slice.call(arguments, 0)

    opt = args.pop()
    opt && opt.nodeType && args.push(opt) && (opt = null)
    opt && (opt = opt.type)

    if (opt == 'map') fn = serializeHash
    else if (opt == 'array') fn = reqwest.serializeArray
    else fn = serializeQueryString

    return fn.apply(null, args)
  }

  reqwest.toQueryString = function (o) {
    var qs = '', i
      , enc = encodeURIComponent
      , push = function (k, v) {
          qs += enc(k) + '=' + enc(v) + '&'
        }

    if (isArray(o)) {
      for (i = 0; o && i < o.length; i++) push(o[i].name, o[i].value)
    } else {
      for (var k in o) {
        if (!Object.hasOwnProperty.call(o, k)) continue;
        var v = o[k]
        if (isArray(v)) {
          for (i = 0; i < v.length; i++) push(k, v[i])
        } else push(k, o[k])
      }
    }

    // spaces should be + according to spec
    return qs.replace(/&$/, '').replace(/%20/g,'+')
  }

  // jQuery and Zepto compatibility, differences can be remapped here so you can call
  // .ajax.compat(options, callback)
  reqwest.compat = function (o, fn) {
    if (o) {
      o.type && (o.method = o.type) && delete o.type
      o.dataType && (o.type = o.dataType)
      o.jsonpCallback && (o.jsonpCallbackName = o.jsonpCallback) && delete o.jsonpCallback
      o.jsonp && (o.jsonpCallback = o.jsonp)
    }
    return new Reqwest(o, fn)
  }

  return reqwest
})
;
define("reqwest", function(){});

/*global define, window*/
/*jslint nomen:true*/

/**
 * Ajax use reqwest library for making actucall call.
 */
define('lib/util/ajax',['require','reqwest','../reqresp'],function (require) {
	

	var reqwest = require('reqwest'),
		reqresp = require('../reqresp'),

		hostRe = new RegExp('([a-zA-Z]:)?//([a-zA-Z0-9-.]+)(:[0-9]+)?(/|$)'),
		successStatusRe = new RegExp('^20[0-9]$'),

		proxyByHost = {};

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
		delete opts.complete;
		delete opts.success;
		delete opts.error;

		return function (resp) {
			if (successStatusRe.exec(resp.status)) {
				successCb(resp);
			} else {
				errorrCb(resp);
			}
			completeCb(resp);
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
		proxyByHost = url;
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
			console.debug('No host variant', hostMatch);
			reqwest(opts);
		} else {
			proto = hostMatch[0];
			host = hostMatch[1];
			port = hostMatch[2] || '';
			loc = window.location;
			if (host === loc.host && (!proto || proto === loc.protocol) && port === loc.port) {
				// If request it to full url, but it matches, then just 
				// fire it directly
				console.debug('Full url variant, to local host');
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
			return ajax('GET', url, callback);
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

/*global define, describe, it, expect, location*/
/*jslint regexp:true*/

define('test/ajax_test',['require','../lib/util/ajax'],function (require) {
	

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

/*global define*/
define('test/suite',['./pipe_test', './reqresp_test', './ajax_test'], function(){
});

/*global define, window*/
define('main.js',['require','./lib/pipe','./lib/reqresp','./lib/util/ajax'],function (require) {
	
	var iwc = {
		pipe: require('./lib/pipe'),
		reqresp: require('./lib/reqresp'),
		util: {
			ajax: require('./lib/util/ajax')
		}
	};
	if (typeof window === 'object') {
		window.iwc = iwc;
	}
	return iwc;
});
}());