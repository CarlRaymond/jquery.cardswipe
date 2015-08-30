
// All states of FSM
var allStates = $.cardswipe._states();
var stateNames = $.cardswipe._stateNames();

// Custom assertion that verifies the state of the plugin
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


// Used by tests that need to simulate multiple keypress events.
// Simulates a sequence of character keypresses, and verifies that after each
// the state is as specified. Argument 'seq' is an array of objects, with
// properties 'char' and 'state'.
// Sends a keypress event corresponding to the character at the head of the list, and
// verifies the state transitions to the corresponding value. Becuase this requires
// letting the event handlers execute, it uses the "setTimeout trick" to queue up the
// state verification.
// Then it recursively invokes itself on the tail of the list. 
//
// seq is an array of objects with 'char' and 'state' properties. 'char' is a string
// containing the character to send, and 'state' is the corresponding state that
// the FSM should be in after processing the character. The optional 'then' property
// will be executed after verifying the state. It is passed the assert object.
//
// If a 'lastly' function is supplied, it will be invoked after processing the
// sequence, to make final assertions or whatnot.
function validateSequence(assert, seq, lastly) {

	// End of sequence?
	if (seq.length === 0) {
		// Invoke final function, if present
		if (lastly) {
			var lastlyDone = assert.async();
			lastly(assert);
			lastlyDone();
		}
		return;
	}

	// Split sequence into head element and the rest
	var head = seq[0];
	var tail = seq.slice(1);

	// Send keypress, verify resulting state.
	$("body").trigger(keypressFor(head.key));
	var done = assert.async();

	// Allow for the handler to execute. Queue the validation with setTimeout.
	setTimeout(function() {
		var message = "After '" + head.key + "' state is " + stateNames[head.state];
		assert.stateIs(head.state, message);
		done();

		// Execute the "then" function, if it exists
		if (head.then) {
			var thendone = assert.async();
			head.then(assert);
			thendone();
		}

		// Recursively invoke on tail
		validateSequence(assert, tail, lastly);
	});
}

// Helper that waits a specified interval, then verifies the FSM state.
// This returns a function that can be used as the 'lastly' argument
// of validateSequence.
function timeoutToState(assert, interval, state) {

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
// char: character to send as argument of event
// state: state the FSM should be in after processing the character
// then: optional function to exeucte after transition.
function Key(key, state, then) {
	this.key = key;
	this.state = state;
	this.then = then;
}



QUnit.test("plugin loaded on page", function (assert) {
	assert.ok(typeof(jQuery.cardswipe) === 'function', "Plugin loaded");
});


QUnit.test("plugin starts in IDLE", function(assert) {
	$.cardswipe();
	assert.stateIs(allStates.IDLE);
});


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


QUnit.test("Sequence: %", function(assert) {
	expect(2);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout });

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	var stateSeq = [ new Key('%', allStates.PENDING) ];
	validateSequence(assert, stateSeq);
});

QUnit.test("Sequence: % with timeout", function(assert) {
	expect(3);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout, parsers: []});

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");
	var stateSeq = [ new Key('%', allStates.PENDING) ];
	var lastly = timeoutToState(assert, timeout, allStates.IDLE);

	validateSequence(assert, stateSeq, lastly);
});


QUnit.test("Sequence: A", function(assert) {
	expect(2);

	$.cardswipe();

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");
	var stateSeq = [ new Key('A', allStates.IDLE)];

	validateSequence(assert, stateSeq);
});


QUnit.test("Sequence: %B with timeout", function(assert) {
	expect(4);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout, parsers: [] });

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Key('%', allStates.PENDING),
		new Key('B', allStates.READING)
	];

	var lastly = timeoutToState(assert, timeout, allStates.IDLE);

	validateSequence(assert, stateSeq, lastly);
});	


QUnit.test("Prefix settings", function(assert) {
	$.cardswipe({ prefixCharacter: "!" });
	var settings = $.cardswipe._settings();
	assert.equal(settings.prefixCode, 33);
});


QUnit.test("Prefix sequence: !", function(assert) {

	var timeout = 100;
	var prefix = "!";
	$.cardswipe({ enable: true, prefixCharacter: prefix, interdigitTimeout: timeout, parsers: []});

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Key(prefix, allStates.PREFIX)
	];

	var lastly = timeoutToState(assert, timeout, allStates.IDLE);

	validateSequence(assert, stateSeq, lastly);
});


QUnit.test("Prefix sequence: !PREFIX%", function(assert) {
	var timeout = 100;
	$.cardswipe({enable: true, prefixCharacter: "!", interdigitTimeout: timeout, parsers: []});

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	var stateSeq = [
		new Key('!', allStates.PREFIX),
		new Key('P', allStates.PREFIX),
		new Key('R', allStates.PREFIX),
		new Key('E', allStates.PREFIX),
		new Key('F', allStates.PREFIX),
		new Key('I', allStates.PREFIX),
		new Key('X', allStates.PREFIX),
		new Key('%', allStates.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Start enabled then disable", function(assert) {
	$.cardswipe({ enabled: true, parsers: []});

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	// Function to disable the plugin
	var disable = function(assert) {
		$.cardswipe("disable");
		assert.ok(true, "Disabled");
	};

	var stateSeq = [
		new Key("%", allStates.PENDING, disable),
		new Key("B", allStates.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Start disabled then enable", function(assert) {
	$.cardswipe({enabled: false, parsers: []});

	assert.stateIs(allStates.IDLE, "Initial state is IDLE");

	var enable = function(assert) {
		$.cardswipe("enable");
		assert.ok(true, "Enabled");
	};

	var stateSeq = [
		new Key('%', allStates.IDLE, enable),
		new Key('%', allStates.PENDING)
	];

	validateSequence(assert, stateSeq);
});


QUnit.test("Sequence: %B654321^DOE/JOHN? accepted by generic parser", function(assert) {


	var done = assert.async();

	// Callback function receiving parsed data
	var callback = function(data) {
		assert.equal(data.type, "generic", "Generic parser invoked");
		assert.equal(data.line1, "B654321^DOE/JOHN", "Parser captured data, stripping delimiters");
		done();
	};

	var stateSeq = [
		new Key('%', allStates.PENDING),
		new Key('B', allStates.READING),
		new Key('6', allStates.READING),
		new Key('5', allStates.READING),
		new Key('4', allStates.READING),
		new Key('3', allStates.READING),
		new Key('2', allStates.READING),
		new Key('1', allStates.READING),
		new Key('^', allStates.READING),
		new Key('D', allStates.READING),
		new Key('O', allStates.READING),
		new Key('E', allStates.READING),
		new Key('/', allStates.READING),
		new Key('J', allStates.READING),
		new Key('O', allStates.READING),
		new Key('H', allStates.READING),
		new Key('N', allStates.READING),
		new Key('?', allStates.READING)
	];

	$.cardswipe({ enabled: true, parsers: [ "generic" ], complete: callback });
	assert.stateIs(allStates.IDLE, "Initial state is IDLE");
	validateSequence(assert, stateSeq);
});


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

