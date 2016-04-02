
// All states of FSM
var states = $.cardswipe._states();
var stateNames = $.cardswipe._stateNames();

// Custom assertion that verifies the state of the FSM
QUnit.assert.stateIs = function(expectedState, message) {

	var state = $.cardswipe._state();
	if (!message) {
		message = "State is " + $.cardswipe._stateNames()[expectedState];
	}

	this.push(state === expectedState, state, expectedState, message);
};


// Utility to build a keypress event for a character
function keypressFor(key) {
	return $.Event("keypress", { which: key.charCodeAt(0) });
}


// Simulates a sequence of character keypresses, and verifies that after each
// the state is as specified. Used by tests that need to simulate multiple keypress
// events and validate the intermediate states. Optionally a 'lastly' function can
// be executed after the state validation to perform final assertions or actions.
//
// Verifying that an event handler is invoked cannot be done immediately after
// raising the event, since the handler code is queued to execute at a later time.
// This function uses the "setTimeout trick" to queue up the state verification
// resulting from raising a keypress event, with a 0 timeout delay.
//
// 'seq' is an array of objects with 'chars' and 'state' properties. 'chars' is a string
// containing one or more characters to send a keypress for, and 'state' is the
// corresponding state that the FSM should be in after processing the last character.
// The optional 'then' property is a function that will be executed after verifying the state.
// It is invoked with the assert object as its argument.
//
// The head element of the sequence is peeled off and acted upon, and then
// the function recurses with the tail of the list.

// If a 'lastly' function is supplied, it will be invoked after processing the
// sequence, to make final assertions or whatnot.
function validateSequence(assert, seqList, lastly) {

	// End of sequence?
	if (seqList.length === 0) {
		// Invoke final function, if present
		if (lastly) {
			var lastlyDone = assert.async();
			lastly(assert);
			lastlyDone();
		}
		return;
	}

	// Split sequence into head element and the rest
	var head = seqList[0];
	var tail = seqList.slice(1);

	// Send keypresses.
	var carr = head.chars.split('');
	$.each(carr, function(index, character) {
		$("body").trigger(keypressFor(character));
	});

	// Allow for the handler to execute. Queue the validation with setTimeout.
	var done = assert.async();
	setTimeout(function() {

		// Verify the state, if a state was provided. Otherwise let it slide.
		if (head.state) {
			var message = "After '" + head.chars + "' state is " + stateNames[head.state];
			assert.stateIs(head.state, message);
		}

		// Execute the "then" function for this element, if any.
		if (head.then) {
			head.then(assert);
		}

		// Recurse on tail of sequnce
		validateSequence(assert, tail, lastly);

		done();
	});
}

// Helper that returns a function that waits a specified interval,
// then verifies the FSM state. This can be used as the 'lastly' argument
// of validateSequence.
function delayValidateState(interval, state) {

	var func = function(assert) {
		var done = assert.async();
		setTimeout(function() {
			var message = "After timeout, state is " + stateNames[state];
			assert.stateIs(state, message);
			done();
		}, interval+1);
	};

	return func;
}


// Constructor to assemble a sequence pair for validateSequence with fewer keystrokes.
// chars: character(s) to send as argument of event
// state: optinal state the FSM should be in after processing the character(s)
// then: optional function to exeucte after transition.
function Seq(chars, state, then) {
	this.chars = chars;
	this.state = state;
	this.then = then;
}


QUnit.test("plugin starts in IDLE", function(assert) {
	$.cardswipe();
	assert.stateIs(states.IDLE);
});


QUnit.test("Sequence: % ends in PENDING", function(assert) {

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout });

	var stateSeq = [ new Seq('%', states.PENDING) ];
	assert.stateIs(states.IDLE, "Initial state is IDLE");
	validateSequence(assert, stateSeq);
});


QUnit.test("Sequence: A remains in IDLE", function(assert) {

	$.cardswipe();

	var stateSeq = [ new Seq('A', states.IDLE)];
	assert.stateIs(states.IDLE, "Initial state is IDLE");
	validateSequence(assert, stateSeq);
});


QUnit.test("Sequence: % with timeout goes to IDLE", function(assert) {

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");
	var stateSeq = [ new Seq('%', states.PENDING) ];
	var lastly = delayValidateState(timeout, states.IDLE);

	validateSequence(assert, stateSeq, lastly);
});


QUnit.test("Sequence: %B with timeout returns to IDLE", function(assert) {

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout, parsers: [] });

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	var stateSeq = [ new Seq('%B', states.READING) ];

	var lastly = delayValidateState(timeout, states.IDLE);

	validateSequence(assert, stateSeq, lastly);
});


QUnit.test("Prefix settings", function(assert) {
	$.cardswipe({ prefixCharacter: "!" });
	var settings = $.cardswipe._settings();
	assert.deepEqual(settings.prefixCodes, [33]);
});

QUnit.test("Prefix allow multiple values", function(assert) {
	$.cardswipe({ prefixCharacter: ["!",";"] });
	var settings = $.cardswipe._settings();
	assert.deepEqual(settings.prefixCodes, [33, 59]);
});

QUnit.test("Prefix dont accept string with more than 1 char", function(assert) {
	assert.throws(function(){
			$.cardswipe({ prefixCharacter: ["!","morethanonechar"] });
	});	
});

QUnit.test("Prefix sequence: !", function(assert) {

	var timeout = 100;
	var prefix = "!";
	$.cardswipe({ enable: true, prefixCharacter: prefix, interdigitTimeout: timeout, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Seq(prefix, states.PREFIX)
	];

	var lastly = delayValidateState(timeout, states.IDLE);

	validateSequence(assert, stateSeq, lastly);
});

QUnit.test("Prefix sequence: ! or ;", function(assert) {

	var timeout = 100;
	var prefixes = ["!",";"];
	$.cardswipe({ enable: true, prefixCharacter: prefixes, interdigitTimeout: timeout, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Seq(";", states.PREFIX)
	];

	var lastly = delayValidateState(timeout, states.IDLE);

	validateSequence(assert, stateSeq, lastly);
});


QUnit.test("Prefix sequence: !PREFIX%", function(assert) {
	var timeout = 100;
	$.cardswipe({enable: true, prefixCharacter: "!", interdigitTimeout: timeout, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Seq('!PREFIX%', states.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Start enabled then disable", function(assert) {
	$.cardswipe({ enabled: true, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	// Function to disable the plugin
	var disable = function(assert) {
		$.cardswipe("disable");
		assert.ok(true, "Disabled");
	};

	var stateSeq = [
		new Seq("%", states.PENDING, disable),
		new Seq("B", states.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Start disabled then enable", function(assert) {
	$.cardswipe({enabled: false, parsers: []});

	assert.stateIs(states.IDLE, "Initial state is IDLE");

	var enable = function(assert) {
		$.cardswipe("enable");
		assert.ok(true, "Enabled");
	};

	var stateSeq = [
		new Seq('%', states.IDLE, enable),
		new Seq('%', states.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Sequence: %B654321^DOE/JOHN? accepted by generic parser", function(assert) {


	var done = assert.async();

	var rawdata = "%B654321^DOE/JOHN?";

	// Callback function receiving parsed data
	var callback = function(parsedData) {
		assert.equal(parsedData.type, "generic", "Generic parser invoked");

		// Compare data, stripping first and last character
		var stripped = rawdata.slice(1, -1);
		assert.equal(parsedData.line1, stripped, "Parser captured data, stripping delimiters");
		done();
	};

	var stateSeq = [ new Seq(rawdata) ];

	$.cardswipe({ enabled: true, parsers: [ "generic" ], success: callback });
	assert.stateIs(states.IDLE, "Initial state is IDLE");
	validateSequence(assert, stateSeq);
});


QUnit.test("Rejected scan invokes failure callback with raw data", function(assert) {


	// Custom parser rejects everything.
	var parserDone = assert.async();
	var mikey = function(rawData) {
		assert.ok(true, "Parser received raw data: " + rawData);
		parserDone();
		return null;
	};

	// Success callback. Should not be called.
	var success = function(parsedData) {
		assert.ok(false, "Success callback invoked incorrectly with parsed data: " + parsedData);
	};

	// Failure callback.
	var failureDone = assert.async();
	var failure = function(scanData) {
		assert.equal(scanData, rawData, "Error callback invoked with scanned data");
		failureDone();
	};

	var rawData = "%B654321^DOE/JOHN?";
	var stateSeq = [ new Seq(rawData)];
	$.cardswipe({ enabled: true, parsers: [ mikey ], success: success, failure: failure});

	assert.stateIs(states.IDLE, "Initial state is IDLE");
	validateSequence(assert, stateSeq);
});


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

QUnit.module("Built-in Parsers");


QUnit.test("Generic parser", function(assert) {
	$.cardswipe();

	var testData = '%B6009050000000000^SIMPSON/HOMER J           ^0000000X11111111100000000000000?;6009050000000000=00000002411111111100?\n';

	var parser = $.cardswipe._builtinParsers().generic;
	var result = parser(testData);

	var expected = {
		type: "generic",
		line1: "B6009050000000000^SIMPSON/HOMER J           ^0000000X11111111100000000000000",
		line2: "6009050000000000=00000002411111111100",
		line3: ""
	};
	assert.deepEqual(expected, result);
});


QUnit.test("Visa parser", function(assert) {
	$.cardswipe();
	var testData = "%B4111111111111111^DOE/JANE^1805101000000000000000503000000?";
	var parser = $.cardswipe._builtinParsers().visa;
	var result = parser(testData);

	var expected = {
		type: "visa",
		account: "4111111111111111",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05"
	};

	assert.deepEqual(expected, result);
});


QUnit.test("Mastercard parser", function(assert) {
	$.cardswipe();
	var testData = "%B5555555555554444^DOE/JANE^1805101000000000000000503000000?";
	var parser = $.cardswipe._builtinParsers().mastercard;
	var result = parser(testData);

	var expected = {
		type: "mastercard",
		account: "5555555555554444",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05"
	};

	assert.deepEqual(expected, result);
});


QUnit.test("American Express parser", function(assert) {
	$.cardswipe();
	var testData = "%B378282246310005^DOE/JANE^1805101000000000000000503000000?";
	var parser = $.cardswipe._builtinParsers().amex;
	var result = parser(testData);

	var expected = {
		type: "amex",
		account: "378282246310005",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05"
	};

	assert.deepEqual(expected, result);
});


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

QUnit.module("Utilities");


QUnit.test("Luhn checksum", function(assert) {

	var luhn = $.cardswipe.luhnChecksum;

	// Fail except when last digit is correct
	assert.notOk(luhn('79927398710'));
	assert.notOk(luhn('79927398711'));
	assert.notOk(luhn('79927398712'));
	assert.ok(luhn('79927398713'));
	assert.notOk(luhn('79927398714'));
	assert.notOk(luhn('79927398715'));
	assert.notOk(luhn('79927398716'));
	assert.notOk(luhn('79927398717'));
	assert.notOk(luhn('79927398718'));
	assert.notOk(luhn('79927398719'));
});


//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


QUnit.module("Event triggers",
{
	afterEach: function() {
		// Clean up the document object.
		$(document).off(".cardswipe");
	}
});


QUnit.test("success event triggered", function(assert) {
	var done = assert.async();

	// Callback for success event
	var handler = function(event, data) {
		assert.equal(event.type, "success", "Handler invoked with success event");
		assert.equal(data.type, "generic", "Handler invoked with generic parsed data");
		done();
	};

	var timeout = 100;
	$.cardswipe({ enabled: true, interdigitTimeout: timeout, parsers: [ "generic"], success: null });
	$(document).on("success.cardswipe", handler);

	var seq = [ new Seq('%B654321^DOE/JOHN?') ];

	var fin = delayValidateState(timeout+1, states.IDLE);
	validateSequence(assert, seq, fin);
});


QUnit.test("failure event triggered", function(assert) {
	var done = assert.async();

	var handler = function(event) {
		assert.equal(event.type, "failure", "Handler invoked with failure event");
		done();
	};

	var timeout = 100;
	$.cardswipe({ enabled: true, interdigitTimeout: timeout, parsers: [], success: null });
	$(document).on("failure.cardswipe", handler);

	var seq = [ new Seq('%BXXX') ];

	var fin = delayValidateState(timeout+1, states.IDLE);
	validateSequence(assert, seq, fin);
});


QUnit.test("scanstart event triggered", function(assert) {

	var done = assert.async();

	// Callback for scanstart event
	var handler = function() {
		assert.ok(true, "Handler invoked");
		done();
	};

	var timeout = 100;
	$.cardswipe({ enabled: true, interdigitTimeout: timeout, parsers: [] });

	$(document).on("scanstart.cardswipe", handler);

	var seq = [
		new Seq('%B')
	];

	var fin = delayValidateState(timeout+1, states.IDLE);
	validateSequence(assert, seq, fin);

});


QUnit.test("scanend event triggered", function(assert) {

	var done = assert.async();

	// Callback for scanend event
	var handler = function() {
		assert.ok(true, "Handler invoked");
		done();
	};

	var timeout = 100;
	$.cardswipe({ enabled: true, interdigitTimeout: timeout, parsers: [] });

	$(document).on("scanend.cardswipe", handler);

	var seq = [
		new Seq('%B6')
	];

	var fin = delayValidateState(timeout+1, states.IDLE);
	validateSequence(assert, seq, fin);

});
