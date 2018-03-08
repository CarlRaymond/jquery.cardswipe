// A jQuery plugin to detect magnetic card swipes.  Requires a card reader that simulates a keyboard.
// This expects a card that encodes data on track 1, though it also reads tracks 2 and 3.  Most cards
// use track 1.  This won't recognize cards that don't use track 1, or work with a reader that
// doesn't read track 1.
//
// See http://en.wikipedia.org/wiki/Magnetic_card to understand the format of the data on a card.
//
// Uses pattern at https://github.com/umdjs/umd/blob/master/jqueryPlugin.js to declare
// the plugin so that it works with or without an AMD-compatible module loader, like RequireJS.
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

	// The plugin proper.  Dispatches methods using the usual jQuery pattern.
	var plugin = function (method) {
		// Method calling logic. If named method exists, execute it with passed arguments
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		}
			// If no argument, or an object passed, invoke init method.
		else if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		}
		else {
			throw 'Method ' + method + ' does not exist on jQuery.cardswipe';
		}
	};

	// Built-in parsers. These include simplistic credit card parsers that
	// recognize various card issuers based on patterns of the account number.
	// There is no guarantee these are correct or complete; they are based
	// on information from Wikipedia.
	// Account numbers are validated by the Luhn checksum algorithm.
	var builtinParsers = {

		// Generic parser. Separates raw data into up to three lines.
		generic: function (rawData) {
				var pattern = new RegExp("^(%[^%;\\?]+\\?)?(;[0-9\\:<>\\=]+\\?)?([+;][0-9\\:<>\\=]+\\?)?");

				var match = pattern.exec(rawData);
				if (!match) return null;

				// Extract the three lines
				var cardData = {
					type: "generic",
					line1: match[1] ? match[1].slice(1, -1) : "",
					line2: match[2] ? match[2].slice(1, -1) : "",
					line3: match[3] ? match[3].slice(1, -1) : ""
				};

				return cardData;
			},


		// Visa card parser.
		visa: function (rawData) {
			// Visa issuer number begins with 4 and may vary from 13 to 19 total digits. 16 digits is most common.
			var pattern = new RegExp("^%B(4[0-9]{12,18})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

			var match = pattern.exec(rawData);
			if (!match) return null;

			var account = match[1];
			if (!luhnChecksum(account))
				return null;

			var cardData = {
				type: "visa",
				account: account,
				lastName: match[2].trim(),
				firstName: match[3].trim(),
				honorific: match[4] ? match[4].trim().slice(1) : "",
				expYear: match[5],
				expMonth: match[6]
			};

			return cardData;
		},

		// MasterCard parser.
		mastercard: function (rawData) {
			// MasterCard starts with 51-55, and is 16 digits long.
			var pattern = new RegExp("^%B(5[1-5][0-9]{14})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

			var match = pattern.exec(rawData);
			if (!match) return null;

			var account = match[1];
			if (!luhnChecksum(account))
				return null;

			var cardData = {
				type: "mastercard",
				account: account,
				lastName: match[2],
				firstName: match[3],
				honorific: match[4] ? match[4].trim().slice(1) : "",
 				expYear: match[5],
				expMonth: match[6]
			};

			return cardData;
		},

		// Discover parser.
		discover: function (rawData) {
			// discover starts with 6, and is 16 digits long.
			var pattern = new RegExp("^%B(6[0-9]{15})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

			var match = pattern.exec(rawData);
			if (!match) return null;

			var account = match[1];
			if (!luhnChecksum(account))
				return null;

			var cardData = {
				type: "discover",
				account: account,
				lastName: match[2],
				firstName: match[3],
				honorific: match[4] ? match[4].trim().slice(1) : "",
				expYear: match[5],
				expMonth: match[6]
			};

			return cardData;
		},

		// American Express parser
		amex: function (rawData) {
			// American Express starts with 34 or 37, and is 15 digits long.
			var pattern = new RegExp("^%B(3[4|7][0-9]{13})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

			var match = pattern.exec(rawData);
			if (!match) return null;

			var account = match[1];
			if (!luhnChecksum(account))
				return null;

			var cardData = {
				type: "amex",
				account: account,
				lastName: match[2],
				firstName: match[3],
				honorific: match[4] ? match[4].trim().slice(1) : "",
				expYear: match[5],
				expMonth: match[6]
			};

			return cardData;
		}
	};




	// State definitions:
	var states = { IDLE: 0, PENDING1: 1, PENDING2: 2, READING: 3, DISCARD: 4, PREFIX: 5 };

	// State names used when debugging.
	var stateNames = { 0: 'IDLE', 1: 'PENDING1', 2: 'PENDING2', 3: 'READING', 4: 'DISCARD', 5: 'PREFIX' };

	// Holds current state. Update only through state function.
	var currentState = states.IDLE;

	// Gets or sets the current state.
	var state = function() {

		if (arguments.length === 0) {
			return currentState;
		}

		// Set new state.
		var newState = arguments[0];
		if (newState == state)
			return;

		if (settings.debug) { console.log("%s -> %s", stateNames[currentState], stateNames[newState]); }

		// Raise events when entering and leaving the READING state
		if (newState == states.READING)
			$eventSource.trigger("scanstart.cardswipe");

		if (currentState == states.READING)
			$eventSource.trigger("scanend.cardswipe");

		currentState = newState;
	};

	// Array holding scanned characters
	var scanbuffer;

	// Interdigit timer
	var timerHandle = 0;

	// Keypress listener
	var listener = function (e) {
		if (settings.debug) { console.log(e.which + ': ' + String.fromCharCode(e.which));}
		switch (state()) {

			// IDLE: Look for prfix characters or line 1 or line 2 start
			// characters, and jump to PENDING1 or PENDING2.
		 	case states.IDLE:
				// Look for prefix characters, and jump to PREFIX.
				if (isInPrefixCodes(e.which)) {
					state(states.PREFIX);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}

				// Cards with (and readers reading) line 1:
				// look for '%', and jump to PENDING1.
				if (e.which == 37) {
					state(states.PENDING1);
					scanbuffer = [];
					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}

				// Cards without (or readers ignoring) line 1:
				// look for ';', and jump to PENDING_LINE
				if (e.which == 59) {
					state(states.PENDING2);
					scanbuffer = [];
					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}

				break;

			// PENDING1: Look for A-Z then jump to READING.
			// Otherwise, pass the keypress through, reset and jump to IDLE.
			case states.PENDING1:
				// Look for format code character, A-Z. Almost always B for cards
				// used by the general public. Some reader / OS combinations
				// will issue lowercase characters when the caps lock key is on.
				if ((e.which >= 65 && e.which <= 90) || (e.which >= 97 && e.which <= 122)) {
					state(states.READING);

					// Leaving focus on a form element wreaks browser-dependent
					// havoc because of keyup and keydown events.  This is a
					// cross-browser way to prevent trouble.
					$("input").blur();

					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}
				else {
					clearTimer();
					scanbuffer = null;
					state(states.IDLE);
				}
				break;

			// PENDING_LINE2: look for 0-9, then jump to READING.
			// Otherwise, pass the keypress through, reset and jump to IDLE.
			case states.PENDING2:
				// Look for digit.
				if ((e.which >= 48 && e.which <= 57)) {
					state(states.READING);

					$("input").blur();

					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}
				else {
					clearTimer();
					scanbuffer = null;
					state(states.IDLE);
				}
				break;

			// READING: Copy characters to buffer until newline, then process the scanned characters
			case states.READING:
				processCode(e.which);
				startTimer();
				e.preventDefault();
				e.stopPropagation();

				// Carriage return indicates end of scan
				if (e.which == 13) {
					clearTimer();
					state(states.IDLE);
					processScan();
				}

				if (settings.firstLineOnly && e.which == 63) {
					// End of line 1.  Return early, and eat remaining characters.
				  state(states.DISCARD);
				  processScan();
				}
				break;

			// DISCARD: Eat up characters until newline, then jump to IDLE
			case states.DISCARD:
				e.preventDefault();
				e.stopPropagation();
				if (e.which == 13) {
					clearTimer();
					state(states.IDLE);
					return;
				}

				startTimer();
				break;

			// PREFIX: Eat up characters until % is seen, then jump to PENDING1
			case states.PREFIX:

				// If prefix character again, pass it through and return to IDLE state.
				if (isInPrefixCodes(e.which)) {
					state(states.IDLE);
					return;
				}

				// Eat character.
				e.preventDefault();
				e.stopPropagation();
				// Look for '%'
				if (e.which == 37) {
					state(states.PENDING1);
					scanbuffer = [];
					processCode(e.which);
				}
				// Look for ';'
				if (e.which == 59) {
					state(states.PENDING2);
					scanbuffer = [];
					processCode(e.which);
				}
				startTimer();
		}
	};

	// Converts a scancode to a character and appends it to the buffer.
	var processCode = function (code) {
		scanbuffer.push(String.fromCharCode(code));
	};

	var startTimer = function () {
		clearTimeout(timerHandle);
		timerHandle = setTimeout(onTimeout, settings.interdigitTimeout);
	};

	var clearTimer = function () {
		clearTimeout(timerHandle);
		timerHandle = 0;
	};

	// Invoked when the timer lapses.
	var onTimeout = function () {
		if (settings.debug) { console.log('Timeout!'); }
		if (state() == states.READING) {
			processScan();
		}
		scanbuffer = null;
		state(states.IDLE);
	};


	// Processes the scanned card
	var processScan = function () {

		if (settings.debug) {
			console.log(scanbuffer);
		}

		var rawData = scanbuffer.join('');

		// Invoke rawData callback if defined, a testing hook.
		if (settings.rawDataCallback) { settings.rawDataCallback.call(this, rawData); }

		var result = parseData(rawData);

		if (result) {
			// Scan complete. Invoke callback
			if (settings.success) { settings.success.call(this, result); }

			// Raise success event.
			$(document).trigger("success.cardswipe", result);
		}
		else
		{
			// All parsers failed.
			if (settings.failure) { settings.failure.call(this, rawData); }
			$(document).trigger("failure.cardswipe");
		}
	};

	// Invokes parsers until one succeeds, and returns the parsed result,
	// or null if none succeed.
	var parseData = function(rawData) {
		for (var i = 0; i < settings.parsers.length; i++) {
		  var ref = settings.parsers[i];
		  var parser;

		  // ref is a function or the name of a builtin parser
		  if ($.isFunction(ref)) {
		    parser = ref;
		  }
		  else if (typeof (ref) === "string") {
		    parser = builtinParsers[ref];
		  }

		  if (parser != null)
		  {
		    var parsedData = parser.call(this, rawData);
		    if (parsedData == null)
		      continue;

		    return parsedData;
		  }
		}

		// All parsers failed.
		return null;
	};

	// Binds the event listener
	var bindListener = function () {
		$(document).on("keypress.cardswipe-listener", listener);
	};

	// Unbinds the event listener
	var unbindListener = function () {
		$(document).off(".cardswipe-listener", listener);
	};

	// Default callback used if no other specified. Works with default parser.
	var defaultSuccessCallback = function (cardData) {
		var text = ['Line 1: ', cardData.line1, '\nLine 2: ', cardData.line2, '\nLine 3: ', cardData.line3].join('');
		alert(text);
	};

  var isInPrefixCodes = function(arg) {
    if(!settings.prefixCodes){
      return false;
    }
    return $.inArray(arg,settings.prefixCodes) != -1;
  };

	// Defaults for settings
	var defaults = {
		enabled: true,
		interdigitTimeout: 250,
		success: defaultSuccessCallback,
		failure: null,
		parsers: [ "generic" ],
		firstLineOnly: false,
		prefixCharacter: null,
		eventSource: document,
		debug: false
	};

	// Plugin actual settings
	var settings;

	// Element on which events are raised.
	// Normally, this stays set to document, but setting it to another
	// element makes testing easier.
	var $eventSource;

	// Apply the Luhn checksum test.  Returns true on a valid account number.
	// The input is assumed to be a string containing only digits.
	var luhnChecksum = function (digits) {
		var map = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9];
		var sum = 0;

		// Proceed right to left. Even and odd digit positions are handled differently.
		var n = digits.length;
		var odd = true;
		while (n--) {
			var d = parseInt(digits.charAt(n), 10);
			if (odd) {
				// Odd digits used as is
				sum += d;
			}
			else {
				// Even digits mapped
				sum += map[d];
			}

			odd = !odd;
		}

		return sum % 10 === 0 && sum > 0;
	};

	// Callable plugin methods
	var methods = {
		init: function (options) {
			settings = $.extend({}, defaults, options);

			// Is a prefix character defined?
			if (settings.prefixCharacter) {

        // Check if prefix character is an array, if its not, convert
        var isPrefixCharacterArray = Object.prototype.toString.call(settings.prefixCharacter) === '[object Array]';
        if(!isPrefixCharacterArray){
          settings.prefixCharacter = [settings.prefixCharacter];
        }

        settings.prefixCodes = [];
        $(settings.prefixCharacter).each(function(){
          if (this.length != 1){
  					throw 'prefixCharacter must be a single character';
          }

          // convert to character code
          settings.prefixCodes.push(this.charCodeAt(0));
        });
			}

			$eventSource = $(settings.eventSource);

			// Reset state
			clearTimer();
			state(states.IDLE);
			scanbuffer = null;
			unbindListener();

			if (settings.enabled)
				methods.enable();
		},

		disable: function () {
			unbindListener();
		},

		enable: function () {
			bindListener();
		}
	};

	// The Luhn checksum function is available to the client if needed.
	plugin.luhnChecksum = luhnChecksum;

	// Attach internal functions to plugin for easier testing. These aren't intended for
	// use in production, hence the underscore security.

	// Get all states
	plugin._states = function() {
		return states;
	};

	// Get names of states
	plugin._stateNames = function() {
		return stateNames;
	};

	// Read-only access to the current state
	plugin._state = function() {
		return state();
	};

	// Read-only access to the settings supplied to init method
	plugin._settings = function() {
		return settings;
	};

	// Invoke parsers on supplied data
	plugin._parseData = function(data) {
		return parseData(data);
	};

	plugin._builtinParsers = function() {
		return builtinParsers;
	};

	// Attach plugin to jQuery object.
	$.cardswipe = plugin;

}));
