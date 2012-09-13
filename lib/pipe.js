/*global define, window*/
/*jslint nomen:true, regexp:true*/


/**
 * TODO: Add security checks for valid senders/recipients
 */
define(function () {
	"use strict";

	var	pub = {}, // module namespace

		// log levels
		// #ifdef DEBUG
		DEBUG = 'debug',
		INFO = 'info',
		WARN = 'warn',
		// #endif

		// Unique prefix, which will be used to distinguish messages sent 
		// within pipes, from those sent by manual call to postMessage
		MESSAGE_PREFIX = 'iwc-',

		// Message sent by remote dispatcher to notify parent window, that it
		// is ready
		MESSAGE_REMOTE_READY = MESSAGE_PREFIX + 'remote-disaptcher-ready&',

		MESSAGE_SEPARATOR = '?',
		DEFAULT_PIPE_NAME = 'default',

		pipeUriRe = new RegExp('^([a-z]+:)?//([a-zA-Z0-9-.]+/?[^#]*)(#(.*))?$'),
		pipeNameRe = new RegExp('^[a-zA-Z0-9-]+$'),
		urlHashRe = new RegExp('(#(.*))?$'),

		// Becomes true one initMessageDisaptcher is called
		messageDispatcherReady = false,

		// Module context
		localContext = window,
		localContextUri = localContext.location.toString().replace(/#[^#]*$/, 's'),

		// Hash of already instantiated pipes by their full URI
		pipeByUri = {},

		// Hash of known frames by contextUri
		contextByUri = {},

		// Hash of remote dispatcher ready message callbacks
		readyCallbackByUri = {},

		// Message prefixes, which will be completely ignored by dispatcher
		ignoredMessagePrefixes = [],

		// Multiple lists of local recipients, by pipe name
		localRecipients = {},

		// Multiple lists of recipiens, which will still externall calls.
		// Organised in 2 dimension table by remote contextUri and pipe name
		externalRecipients = {};


	// Private functions
	// =================

	// #ifdef DEBUG
	function log(level) {
		var cons = (typeof console !== 'undefined') ? console : null,
			mthd,
			args;

		if (cons) {
			if (cons[level]) {
				mthd = cons[level];
				args = Array.prototype.slice.call(arguments, 1);
			} else {
				mthd = cons.log;
				args = arguments;
			}
		}

		if (typeof mthd.apply === 'function') {
			mthd.apply(cons, args);
		} else {
			mthd(Array.prototype.reduce.call(args, function (total, val) {
				if (typeof val === 'object') {
					val = JSON.stringify(val);
				}
				return total + val + ' ';
			}, ''));
		}
	}
	// #endif

	function encodeMessage(pipeName, data) {
		return MESSAGE_PREFIX + pipeName + MESSAGE_SEPARATOR + '{"v":' + JSON.stringify(data) + '}';
	}

	function MessageDecodingError(message) {
		Error.call(this, message);
	}

	MessageDecodingError.prototype = new Error();
	MessageDecodingError.prototype.type = 'MessageDecodingError';

	function decodeMessage(rawData) {
		var prefixLen = MESSAGE_PREFIX.length,
			separatorIndex,
			name,
			data;

		if (rawData.slice(0, prefixLen) === MESSAGE_PREFIX) {
			rawData = rawData.slice(prefixLen);
		} else {
			throw new MessageDecodingError('Message does not match pipe message format');
		}

		separatorIndex = rawData.indexOf(MESSAGE_SEPARATOR);
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
			uri,
			l,
			i;

		message = event.data;

		// If message is ignored, just stop right away
		for (i = 0, l = ignoredMessagePrefixes.length; i < l; i += 1) {
			if (message.indexOf(ignoredMessagePrefixes[i]) === 0) {
				return;
			}
		}

		// If message is remote ready, call callback and stop dispatchin
		if (message.indexOf(MESSAGE_REMOTE_READY) === 0) {
			uri = message.slice(MESSAGE_REMOTE_READY.length);
			if (readyCallbackByUri[uri]) {
				readyCallbackByUri[uri]();
				delete readyCallbackByUri[uri];
			}
			return;
		}

		// Try to decode message
		try {
			message = decodeMessage(event.data);
		} catch (err) {
			if (err.type !== 'MessageDecodingError') {
				// #ifdef DEBUG
				log(WARN, 'Message decoding error', message);
				// #endif
				throw err;
			} else {
				// Report messages which does not match ingored list
				// #ifdef DEBUG
				log(INFO, 'iwc.pipe.MessageDispatcher', 'ignored wrongly formatted message: ', message);
				// #endif
				return;
			}
		}

		// #ifdef DEBUG
		log(DEBUG, 'iwc.pipe.MessageDispatcher', 'at ' + localContextUri + ' dispatching: ', message);
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
			log(WARN, 'iwc.pipe.MessageDispatcher', 'did not found recipient for: ', event.data);
		}
		// #endif
	}

	function initMessageDispatcher() {
		if (localContext.addEventListener) {
			localContext.addEventListener('message', dispatchMessage, false);
		} else {
			localContext.attachEvent('onmessage', dispatchMessage);
		}
		// Notify parent window, that local dispatcher is ready
		if (localContext.parent && localContext.parent !== localContext) {
			// #ifdef DEBUG
			log(DEBUG, 'iwc.pipe.MessageDispatcher ready at ' + localContext.location.toString());
			// #endif
			localContext.parent.postMessage(MESSAGE_REMOTE_READY + localContext.location.toString(), '*');
		}
		messageDispatcherReady = true;
	}

	function PipeUri(contextUri, name) {
		this.contextUri = contextUri;
		this.name = name;
	}
	PipeUri.prototype = {
		toString: function () {
			var contextUri = this.contextUri;
			return (contextUri ? contextUri + '#' : '') + this.name;
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
			uri = DEFAULT_PIPE_NAME;
		}

		if (pipeNameRe.exec(uri)) {
			name = uri;
			contextUri = null;
		} else {
			match = pipeUriRe.exec(uri);
			if (match) {
				contextUri = (match[1] || localContext.location.protocol) + '//' + match[2];
				name = match[4] || DEFAULT_PIPE_NAME;
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
			onReady;

		// If context is not here, return asynchronous function, which will
		// accept callback, when will be called when finally constext is created
		if (!context) {
			frame = localContext.document.createElement('iframe');
			frame.style.display = 'none';
			frame.src = contextUri;
			frame.name = contextUri;

			// #ifdef debug
			log(DEBUG, 'idc.pipe.getContextByUri', 'building new frame:', contextUri);
			// #endif

			//TODO: check if there are no unnecessary reference loops,
			//TOOD: add onReady timeout if child frame does not include required library
			// which may couse potential memory leaks
			readyCallbackByUri[contextUri] = function (event) {
				context = contextByUri[contextUri] = frame.contentWindow;
				if (callback) {
					callback(context);
				}
			};

			// Ready callbacks are handled by dispatcher, so wee need to make sure
			// it is initialused
			if (!messageDispatcherReady) {
				initMessageDispatcher();
			}

			localContext.document.body.appendChild(frame);

			return function (cb) {
				if (context) {
					cb(context);
				} else {
					callback = cb;
				}
			};
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
		 * Context setter. If there are any messages queued when context is 
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
			// #ifdef DEBUG
			log(DEBUG, 'iwc.pipe.MessagePipe queued: ', data);
			// #endif
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
				// #ifdef DEBUG
				log(DEBUG, 'iwc.pipe.MessagePipe sent: ', data);
				// #endif
				this.context.postMessage(encodeMessage(this.name, data), '*');
			} else {
				this.push(data);
			}
			return this;
		},

		close: function () {
			// TODO: implement me
		}
	};

	// private functions are exposed for unit testing. They should never
	// be invoked manually
	// #ifdef DEBUG
	pub._encodeMessage = encodeMessage;
	pub._decodeMessage = decodeMessage;
	pub._expandPipeUri = expandPipeUri;
	pub._getContextByUri = getContextByUri;
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
	 *
	 * Optionally tou can create pipe in context, not knowing context uri, or
	 * if you do not want this module to create Frame/Worker automatically.
	 * In that case pipe will not be managed or re-used. You will need
	 * to keep reference to it manually.	 
	 */
	pub.open = function (uri, context) {
		var pipeUri,
			contextUri,
			name,
			pipe;

		if (typeof uri === 'object') {
			context = uri;
			uri = DEFAULT_PIPE_NAME;
		}

		pipeUri = expandPipeUri(uri);
		if (pipeByUri[pipeUri]) {
			return pipeByUri[pipeUri];
		}

		if (!context) {
			if (!pipeUri.contextUri) {
				throw new Error('If you do not provide context uri in pipe name, than you have to pass it as argument');
			}
			context = getContextByUri(pipeUri.contextUri);
		}

		pipe = new MessagePipe(pipeUri.name, context);
		// Store pipes, which has known context uri
		if (pipeUri.contextUri && !pipeByUri[pipeUri]) {
			pipeByUri[pipeUri] = pipe;
		}

		return pipe;
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
			uri = DEFAULT_PIPE_NAME;
		}

		pipeUri = expandPipeUri(uri);
		name = pipeUri.name;
		contextUri = pipeUri.contextUri;

		if (contextUri === null || contextUri === localContextUri) {
			recipientRegistry = localRecipients;
		} else {
			recipientRegistry = externalRecipients[contextUri];
			if (!recipientRegistry) {
				recipientRegistry = externalRecipients[contextUri] = {};
			}
		}

		recipients = recipientRegistry[name];
		if (!recipients) {
			recipients = recipientRegistry[name] = [];
		}
		recipients.push(handler);

		// Make sure dispatcher is intialised
		if (!messageDispatcherReady) {
			initMessageDispatcher();
		}

		// #ifdef DEBUG
		log(DEBUG, 'iwc.pipe.MessageDispatcher has new reciver for: ', pipeUri);
		// #endif

		return pub;
	};

	pub.ignoreMessagePrefix = function () {
		var i = 0,
			len;
		for (i = 0, len = arguments.length; i < len; i += 1) {
			ignoredMessagePrefixes.push(arguments[i]);
		}
	};

	// TODO: add cleanup functions like close pipe and removeRecipient
	return pub;
});
