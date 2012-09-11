/*global define, document, location*/
/*jslint regexp:true*/

define(function (require) {
	"use strict";

	var hostAlias,
		isScriptOnLoadSupported = (typeof document.getElementsByTagName('script')[0].onload !== 'undefined'),
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
				frameDoc,
				frameWin,
				baseUrl = location.toString().replace(/\w+\/\w+.html(\?|#|$).*/, '');

			if (typeof script === 'function') {
				script = script.toString();
			} else if (script.join) {
				script = script.join('\n    ');
			}

			frame.style.display = 'none';
			frame.src = 'about:blank';
			document.body.appendChild(frame);
			frameWin = frame.contentWindow;
			frameDoc = frameWin.document;
			frameDoc.open();
			frameDoc.write([
				'<!DOCTYPE html>', //DOCTYPE is important for IE8 to work in W3C compatibility mode
				'<html><head>',
				'<script src="' + baseUrl + 'test/compat.js"></script>',
				'<script>',
				'  function onRequirejsLoad(script) {',
				(isScriptOnLoadSupported ? '' : 'if (script.readyState !== "complete") { return; }'),
				'    requirejs(',
				'      [' + srcs.map(function (src) { return '"' + src + '"'; }).join(', ') + '],',
				'      function() {',
                '        (' + script + '.apply(window, arguments));',
				'        postMessage("testsuite-frame-load", "' + location.protocol + '//' + location.hostname + '")',
				'      }',
				'    );',
				'  }',
				'</script>',
				'<script src="' + baseUrl + 'node_modules/requirejs/require.js" ',
				'        ' + (isScriptOnLoadSupported ? 'onload' : 'onreadystatechange') + '="onRequirejsLoad(this)">',
				'</script>',
                '</head></html>'
			].join('\n'));
			frameDoc.close();

			function onFrameMessage(event) {
				if (event.data === 'testsuite-frame-load') {
					callback(frame);
				}
			}

			if (frameWin.addEventListener) {
				frameWin.addEventListener('message', onFrameMessage);
			} else {
				frameWin.attachEvent('onmessage', onFrameMessage);
			}
			return frame;
		},

		tearDownFrame: function (frame) {
			document.body.removeChild(frame);
		}
	};
});