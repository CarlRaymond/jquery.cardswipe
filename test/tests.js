
QUnit.test("plugin loaded", function (assert) {
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
	$.cardswipe({ enable: true, interdigitTimeout: timeout });

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
	}, 0);

	// Wait long enough for timeout. State should be IDLE again.
	var done2 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.IDLE, "On timeout state is IDLE");
		done2();
	}, timeout + 1);
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
	}, 0);
});


QUnit.test("Keypress: %B", function(assert) {
	expect(4);

	var timeout = 100;
	$.cardswipe({ enable: true, interdigitTimeout: timeout, parsers: [] });

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
		var event2 = $.Event("keypress", { which: 66 });
		$("body").trigger(event2);

		// setTimeout allows for processing; then state should be READING
		var done2 = assert.async();
		setTimeout(function () {
			var state = $.cardswipe("_getState");
			assert.equal(state, states.READING, "On B, state is READING");
			done2();

			// Wait long enough for timeout. State should be IDLE again.
			var done3 = assert.async();
			setTimeout(function () {
				var state = $.cardswipe("_getState");
				assert.equal(state, states.IDLE, "On timeout state is IDLE");
				done3();
			}, timeout + 1);
		}, 0);
	}, 0);
});

QUnit.test("Prefix settings", function(assert) {
	$.cardswipe({ prefixCharacter: "!" });
	var settings = $.cardswipe("_getSettings");
	assert.equal(settings.prefixCode, 33);
});

QUnit.test("Prefix keypress: !", function(assert) {

	var timeout = 100;
	var prefix = "!";
	$.cardswipe({ enable: true, prefixCharacter: prefix, interdigitTimeout: timeout, parsers: []});

	var states = $.cardswipe("_getStates");
	var initialState = $.cardswipe("_getState");

	assert.equal(initialState, states.IDLE, "Initial state is IDLE");

	// Send a ! character
	var event1 = $.Event("keypress", { which: 33 });
	$("body").trigger(event1);
	
	// setTimeout allows for processing; then state should be PREFIX
	var done1 = assert.async();
	setTimeout(function() {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.PREFIX, "On %, state is PREFIX");
		done1();
	});
});


QUnit.test("Prefix keypress: !A", function(assert) {
	var timeout = 100;
	$.cardswipe({enable: true, prefixCharacter: "!", interdigitTimeout: timeout, parsers: []});

	var states = $.cardswipe("_getStates");

	assert.equal($.cardswipe("_getState"), states.IDLE, "Initial state is IDLE");

	// Send "!"
	$("body").trigger($.Event("keypress", { which: 33 }));
	
	// setTimeout allows for processing; then state should be PREFIX
	var done1 = assert.async();
	setTimeout(function() {
		assert.equal($.cardswipe("_getState"), states.PREFIX, "On !, state is PREFIX");
		done1();

		// Send "A"
		$("body").trigger($.Event("keypress", { which: 65 }));
		var done2 = assert.async();
		setTimeout(function() {
			assert.equal($.cardswipe("_getState"), states.PREFIX, "On A, state remains PREFIX");
			done2();

			// Send "%"
			$("body").trigger($.Event("keypress", { which: 37 }));
			var done3 = assert.async();
			setTimeout(function() {
				assert.equal($.cardswipe("_getState"), states.PENDING, "On %, state is PENDING");
				done3();
			});
		});
	});

});

/*
QUnit.test("Ordinary keypress not suppressed", function (assert) {
	expect(2);

	$.cardswipe({ enable: true });

	var keypressCounter = 0;
	var lastWhich;

	// Remove all event handlers from input, and attach a new one.
	$("#textbox")
		.off()
		.on("keypress", function (e) {
			keypressCounter++;
			lastWhich = e.which;
		})
		.focus()
		;

	// Send 'A' character
	$("#textbox").trigger($.Event("keypress", { which: 65 }));
	var done = assert.async();
	setTimeout(function () {
		assert.equal(keypressCounter, 1, "One keypress received");
		assert.equal(lastWhich, 65, "Correct character");
		done();
	});

});
*/

/*


QUnit.test("Keypress enters character", function(assert) {
	$("#textbox").off();
	$("#textbox").trigger($.Event("keypress", { which: 37, charCode: 37 }));
	assert.equal($("#textbox").val(), "%");

});
*/

/*

QUnit.test("Keypress: %%", function (assert) {
	expect(4);

	$.cardswipe({ enable: true, debug: true });

	// Counts kepresses received by form control
	var keypressCounter = 0;
	var lastEvent = 0;

	// Remove any existing handler on textbox and bind a new one
	$("#textbox")
		.off()
		.on("keypress", function (e) {
			keypressCounter++;
			lastEvent = e;
			console.log('Event: ' + e);
		})
		.focus()
	;

	var states = $.cardswipe("_getStates");
	var initialState = $.cardswipe("_getState");

	assert.equal(initialState, states.IDLE, "Initial state is IDLE");

	// Send a % character
	$("body").trigger($.Event("keypress", { which: 37 }));

	var done1 = assert.async();
	setTimeout(function () {
		var state = $.cardswipe("_getState");
		assert.equal(state, states.PENDING, "On first %, state is PENDING");
		//assert.equal($("#textbox").val(), "", "Textbox is empty");
		//assert.equal(keypressCounter, 0, "First % is suppressed");
		done1();

		// Send another % character
		$("body").trigger($.Event("keypress", { which: 37 }));

		var done2 = assert.async();
		setTimeout(function () {
			var state = $.cardswipe("_getState");
			assert.equal(state, states.IDLE, "On second %, state is IDLE");
			//assert.equal($("#textbox").val(), "%", "Textbox contains %");
			assert.equal(keypressCounter, 1, "Second % is not suppressed");
			//assert.equal(lastWhich, 37, "Correct character")
			done2();
		});
	});
});
*/


