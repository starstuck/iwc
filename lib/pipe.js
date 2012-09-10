/*global define, window*/
/*jslint nomen:true, regexp:true*/

define(function () {
	"use strict";

	var	pub = {}, // module namespace

		// Unique prefix, which will be used to distinguish messages sent 
		// within pipes, from those sent by manual call to postMessage
		messagePrefix = 'iwc-',
		messageSeparator = '?',
		defaultPipeName = 'default',
		pipeUriRe = new RegExp('^([a-z]+:)?//([a-zA-Z0-9-.]+/?[^#]*)(#(.*))?$'),
		pipeNameRe = new RegExp('^[a-zA-Z0-9-]+$'),
		urlHashRe = new RegExp('(#(.*))?$'),

		// log levels
		DEBUG = 'debug',
		INFO = 'info',
		WARN = 'warn',

		// Module context
		localContext = window,
		localContextUri = localContext.location.toString().replace(/#[^#]*$/, 's'),

		// Hash of already instantiated pipes by their full URI
		pipeByUri = {},

		// Hash of known frames by contextUri
		contextByUri = {},

		// List of message prefixes, which will be ignored by dispatcher
		ignoredMessagePrefixes = [],

		// Multiple lists of local recipients, by pipe name
		// Starts with null, as indication that local message dispatcher
		// must be initialised first, beforning setting hash values
		localRecipients = null,

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

		window.parent.console.log('entering dispatcher');		

		try {
			message = decodeMessage(event.data);
		} catch (err) {
			if (err.type !== 'MessageDecodingError') {
				throw err;
			} else {
				// #ifdef DEBUG
				// Report messages which does not match ingored list
				message = event.data;
				if (ignoredMessagePrefixes.filter(function (prefix) {
						return (message.indexOf(prefix) === 0);
					}).length === 0) {
					log(INFO, 'iwc.pipe.MessageDispatcher', 'ignored not prefixed message: ', message);
				}
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
			log(DEBUG, 'Got recipients:', localRecipients);
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
			onLoad;

		// If context is not here, return asynchronous function, which will
		// accept callback, when will be called when finally constext is created
		if (!context) {
			frame = localContext.document.createElement('iframe');
			frame.style.display = 'none';
			frame.src = contextUri;

			// #ifdef debug
			log(DEBUG, 'idc.pipe.getContextByUri', 'building new frame:', contextUri);
			// #endif

			//TODO: check if there are no unnecessary reference loops,
			// which may couse potential memory leaks
			onLoad = function () {
				context = contextByUri[contextUri] = frame.contentWindow;
				if (callback) {
					callback(context);
				}
			};

			if (frame.addEventListener) {
				frame.addEventListener('load', onLoad);
			} else {
				frame.attachEvent('onload', onLoad);
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
	pub.ignoreMessagePrefix = function (prefix) {
		ignoredMessagePrefixes.push(prefix);
	};
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
