﻿// A jQuery plugin to detect magnetic card swipes.  Requires a card reader that simulates a keyboard.
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

  // State definitions:
  var states = { IDLE: 0, PENDING: 1, READING: 2, DISCARD: 3 };

	// Holds current state
	var state = states.IDLE;

	// Array holding scanned characters
	var scanbuffer;
	
	// Interdigit timer
	var timerHandle = 0;

	// Keypress listener
	var listener = function (e) {
		switch (state) {
			case states.IDLE:
				// Look for '%'
				if (e.which == 37) {
					state = states.PENDING;
					scanbuffer = new Array();
					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();
					startTimer();
				}

				break;

			case states.PENDING:
				// Look for format code character, A-Z. Almost always B for cards
				// used by the general public.
				if (e.which >= 65 && e.which <= 90) {
					state = states.READING;

					// Leaving focus on a form element wreaks browser-dependent
					// havoc because of keyup and keydown events.  This is a
					// cross-browser way to prevent trouble.
					$("input").blur();

					processCode(e.which);
					e.preventDefault();
					e.stopPropagation();

					$(document).trigger("scanbegin.cardswipe");

					startTimer();
				}
				else {
					clearTimer();
					scanbuffer = null;
					state = states.IDLE;
				}
				break;

			case states.READING:
				processCode(e.which);
				startTimer();
				e.preventDefault();
				e.stopPropagation();

				// Carriage return indicates end of scan
				if (e.which == 13) {
					clearTimer();
					state = IDLE;

					$(document).trigger("scanend.cardswipe");

					processScan();
				}

				if (settings.firstLineOnly && e.which == 63) {
					// End of line 1.  Return early, and eat remaining characters.
				  state = states.DISCARD;

				  $(document).trigger("scanend.cardswipe");

					processScan();
				}
				break;

			case states.DISCARD:
				e.preventDefault();
				e.stopPropagation();
				if (e.which == 13) {
					clearTimer();
					state = states.IDLE;
					return;
				}

				startTimer();
				break;
		}
	};

	// Converts a scancode to a character and appends it to the buffer.
	var processCode = function (code) {
		scanbuffer.push(String.fromCharCode(code));
		//console.log(code);
	}

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
		if (state == states.READING) {
			procsessScan();
		}
		scanbuffer = null;
		state = states.IDLE;
	};


	// Processes the scanned card
	var processScan = function () {

		var rawData = scanbuffer.join('');

	    // Invoke client parsers until one succeeds
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

		    // Success. Raise event.
		    $(document).trigger("success.cardswipe", parsedData);
		    return;
		  }
		}

	  // All parsers failed.
		$(document).trigger("failure.cardswipe");
	};

	// Binds the event listener
	var bindListener = function () {
		$(document).bind("keypress", listener);
	};

	// Unbinds the event listener
	var unbindListener = function () {
		$(document).unbind("keypress", listener);
	};

	// Default parser. Separates raw data into up to three lines
	var defaultParser = function (rawData) {
		var pattern = new RegExp("^(%[^%;\\?]+\\?)?(;[0-9\\:<>\\=]+\\?)?(;[0-9\\:<>\\=]+\\?)?");

		var match = pattern.exec(rawData);
		if (!match) return null;

		// Extract the three lines
		var cardData = {
      type: "generic",
			line1: match[1],
			line2: match[2],
			line3: match[3]
		};

		return cardData;
	};

	var visaParser = function (rawData) {
	  var pattern = new RegExp("^%B([0-9]{16,19})\\^([A-Z ]+)/([A-Z ]+)\\^([0-9]{2})([0-9]{2})");

	  var match = pattern.exec(rawData);
	  if (!match) return null;

	  var cardData = {
      type: "visa",
	    account: match[1],
	    lastName: match[2],
	    firstName: match[3],
	    expYear: match[4],
	    expMonth: match[5]
	  };

	  return cardData;
	};

	var amexParser = function (rawData) {
	  return null;
	};

	var builtinParsers = { "default": defaultParser, "visa": visaParser, "amex": amexParser };

	// Default callback used if no other specified. Works with default parser.
	var defaultSuccessCallback = function (cardData) {
		var text = ['Success!\nLine 1: ', cardData.line1, '\nLine 2: ', cardData.line2, '\nLine 3: ', cardData.line3].join('');
		alert(text);
	};

	// Defaults for settings
	var defaults = {
		enabled: true,
		interdigitTimeout: 250,
		success: defaultSuccessCallback,
		error: null,
		parsers: [ "visa", "amex" ],
		firstLineOnly: false
	};

	// Plugin actual settings
	var settings;


	// Callable plugin methods
	var methods = {
		init: function (options) {
			settings = $.extend(defaults, options || {});

			if (settings.enabled)
				methods.enable();
		},

		disable: function (options) {
			unbindListener();
		},

		enable: function (options) {
			bindListener();
		}
	};


	// The extension proper.  Dispatches methods using the usual jQuery pattern.
	$.cardswipe = function (method) {
		// Method calling logic
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		else if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		}
		else {
			$.error('Method ' + method + ' does not exist on jQuery.cardswipe');
		}
	}

}));
