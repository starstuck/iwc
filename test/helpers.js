/*global define, document, location*/

define(function (require) {
	"use strict";

	var hostAlias,
		message;

	try {
		hostAlias = location.search.match(/(\?|&)alias=([\w\-.]+)(&|$)/)[2];
	} catch (err) {}

	// Use well known aliases for localhost
	if (!hostAlias) {
		switch (location.hostname) {
		case ('localhost'):
			hostAlias = '127.0.0.1';
			break;
		case ('127.0.0.1'):
			hostAlias = 'localhost';
			break;
		}
	}

	return {
		getHostAlias: function () {
			if (!hostAlias) {
				throw new Error('The test require host alias to make cross-domain request. Please provide ?alias= in url.');
			}
			return hostAlias;
		},

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