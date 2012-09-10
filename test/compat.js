/**
 * Javascript 1.6 compatilbility for dev not friendly browsers, read IE8
 */

/**
 * Array#forEach
 * Copied from https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/forEach
 */
if (!Array.prototype.forEach) {
	"use strict";
	var i, len;
	Array.prototype.forEach = function (fn, scope) {
		for (i = 0, len = this.length; i < len; i += 1) {
			fn.call(scope || this, this[i], i, this);
		}
	};
}


/**
 * Production steps of ECMA-262, Edition 5, 15.4.4.19
 * Reference: http://es5.github.com/#x15.4.4.19
 */
if (!Array.prototype.map) {
	Array.prototype.map = function (callback, thisArg) {
		"use strict";
		if (this === null || this === undefined) {
			throw new TypeError(" this is null or not defined");
		}

		if ({}.toString.call(callback) !== "[object Function]") {
			throw new TypeError(callback + " is not a function");
		}

		var T,
			// Let A be a new array created as if by the expression new Array(len) where Array is
			// the standard built-in constructor with that name and len is the value of len.
			A = new Array(len),

			// Let O be the result of calling ToObject passing the |this| value as the argument.
			O = Object(this),

			k = 0,

			// 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
			// 3. Let len be ToUint32(lenValue).
			len = O.length >>> 0;


		// 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
		if (thisArg) {
			T = thisArg;
		}


		// 7. Let k be 0
		k = 0;

		// 8. Repeat, while k < len
		while(k < len) {

			var kValue, mappedValue;

			// a. Let Pk be ToString(k).
			//   This is implicit for LHS operands of the in operator
			// b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
			//   This step can be combined with c
			// c. If kPresent is true, then
			if (k in O) {

				// i. Let kValue be the result of calling the Get internal method of O with argument Pk.
				kValue = O[k];

				// ii. Let mappedValue be the result of calling the Call internal method of callback
				// with T as the this value and argument list containing kValue, k, and O.
				mappedValue = callback.call(T, kValue, k, O);

				// iii. Call the DefineOwnProperty internal method of A with arguments
				// Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
				// and false.

				// In browsers that support Object.defineProperty, use the following:
				// Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

				// For best browser support, use the following:
				A[k] = mappedValue;
			}
			// d. Increase k by 1.
			k += 1;
		}
		// 9. return A
		return A;
	};
}


/**
 * Aray#reduce variant compatible with ECMXScript 5th Edition
 * Influenced by https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/reduce
 */
if (!Array.prototype.reduce) {
	Array.prototype.reduce = function reduce(accumulator, initial) {
		"use strict";
		if (this === null || this === undefined) {
			throw new TypeError("Object is null or undefined");
		}

		var i = 0,
			l = this.length >> 0,
			curr;

		if (typeof accumulator !== "function") {// ES5 : "If IsCallable(callbackfn) is false, throw a TypeError exception."
			throw new TypeError("First argument is not callable");
		}
		if (arguments.length < 2) {
			if (l === 0) {
				throw new TypeError("Array length is 0 and no second argument");
			}
			curr = this[0];
			i = 1; // start accumulating at the second element
		} else {
			curr = initial;
		}
		while (i < l) {
			if (i in this) {
				curr = accumulator.call(undefined, curr, this[i], i, this);
			}
			i += 1;
		}
		return curr;
	};
}