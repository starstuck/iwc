/*global define, document*/

define(function (require) {
	"use strict";

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