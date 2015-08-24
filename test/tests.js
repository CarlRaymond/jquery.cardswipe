QUnit.test("plugin loaded", function(assert) {
	assert.ok(typeof(jQuery.cardswipe) === 'function', "Plugin loaded");
});

QUnit.test("plugin starts in IDLE", function(assert) {
	$.cardswipe();
	var states = $.cardswipe('_getStates');
	var state = $.cardswipe('_getState');
	assert.equal(state, states.IDLE);
});

QUnit.test("plugin defines builtin parsers", function(assert) {
	$.cardswipe();
	var parsers = $.cardswipe('_builtinParsers');

	assert.equal('object', typeof(parsers), "Built-in parsers exist");
});

QUnit.test("Generic parser", function(assert) {
	$.cardswipe();

	var testData = '%B6009050000000000^SIMPSON/HOMER J           ^0000000X11111111100000000000000?;6009050000000000=00000002411111111100?\n';

	var parser = $.cardswipe('_builtinParsers').generic;
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
	var parser = $.cardswipe('_builtinParsers').visa;
	var result = parser(testData);

	var expected = {
		type: "visa",
		account: "4111111111111111",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05",
	};

	assert.deepEqual(expected, result);
});

QUnit.test("Mastercard parser", function(assert) {
	$.cardswipe();
	var testData = "%B5555555555554444^DOE/JANE^1805101000000000000000503000000?";
	var parser = $.cardswipe('_builtinParsers').mastercard;
	var result = parser(testData);

	var expected = {
		type: "mastercard",
		account: "5555555555554444",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05",
	};

	assert.deepEqual(expected, result);
});

QUnit.test("American Express parser", function(assert) {
	$.cardswipe();
	var testData = "%B378282246310005^DOE/JANE^1805101000000000000000503000000?";
	var parser = $.cardswipe('_builtinParsers').amex;
	var result = parser(testData);

	var expected = {
		type: "amex",
		account: "378282246310005",
		lastName: "DOE",
		firstName: "JANE",
		expYear: "18",
		expMonth: "05",
	};

	assert.deepEqual(expected, result);
});


QUnit.test("Keypress: %", function(assert) {
	expect(3);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: 100 });

	var states = $.cardswipe("_getStates");
	var initialState = $.cardswipe("_getState");

	assert.equal(initialState, states.IDLE, "Initial state is IDLE");

	// Send a % keypress
	var event = $.Event("keypress", { which: 37 });
	$("body").trigger(event);

	// Allow for processing; then state should be PENDING.
	var done1 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.PENDING, "On % state is PENDING");
		done1();
	}, 50);

	// Wait long enough for timeout. State should be IDLE again.
	var done2 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.IDLE, "On timeout state is IDLE");
		done2();
	}, timeout);
});

QUnit.test("Keypress: not %", function(assert) {
	expect(2);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout});

	var states = $.cardswipe("_getStates");
	var initialState = $.cardswipe("_getState");

	assert.equal(initialState, states.IDLE, "Initial state is IDLE");

	// Send a non-% keypress, like "A"
	var event = $.Event("keypress", { which: 65 });
	$("body").trigger(event);

	// Allow for processing; then state should still be IDLE
	var done1 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.IDLE, "On non-% state is IDLE");
		done1();
	}, 20);
});

QUnit.test("Keypress: %B", function(assert) {
	expect(3);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout});

	var states = $.cardswipe("_getStates");
	var initialState = $.cardswipe("_getState");

	assert.equal(initialState, states.IDLE, "Initial state is IDLE");

	// Send a % character
	var event1 = $.Event("keypress", { which: 37 });
	$("body").trigger(event1);
	
	// setTimeout allows for processing; then state should be PENDING
	var done1 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.PENDING, "On %, state is PENDING");
		done1();
	
		// Send a B character
		var event2 = $.Event({ which: 66 });
		$("body").trigger(event2);

		// setTimeout allows for processing; then state should be READING
		var done2 = assert.async();
		setTimeout(function () {
			var state = $.cardswipe("_getState");
			assert.equal(state, states.READING, "On B, state is READING");
			done2();
		}, 50);
	}, 50);
});