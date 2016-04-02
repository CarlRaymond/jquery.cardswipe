# jQuery.cardswipe

## What It Does
This jQuery plugin is intended for use with a magnetic card reader that simulates a keyboard.  It allows a
web application to interface with the reader so that scanning a card will trigger a callback function
which can then act on the scanned data.  Scanning a card will not result in keyboard events getting through
to the underlying page, so you can scan a card without regard to which control on the page has focus.

Note that while this plugin can scan a credit card or debit card account number, it does not validate or verify that data in any way (except for the standard Luhn checksum on account numbers). The plugin simply reads the data on the card. What you do with it is up to you.

There are built-in parsers to handle common credit cards, but the primary use case of this plugin is for
private-use cards, like company or institutional ID cards.

## Getting Started
Before you try the plugin, make sure your card reader does what the plugin expects. Connect your reader, and open
`notepad` or `vi` or some other plain-text editor, and then scan a card. If the scanned data does not start with
a `%` character followed by a letter this plugin will not be able to work with your cards and reader.  However, if
the `%` character and a letter are present, but there is a consistent prefix ahead of it, you may be able to use
the plugin by configuring the `prefixCharacter` property.  See an example below.

To use the plugin, include either `dist\jquery.cardswipe.js` or `dist\jquery.cardswipe.min.js` on your web page,
after including jQuery version 1.7.2 or later. 

If you are scanning credit cards like Visa, MasterCard, or American Express, there are built-in parsers within
the plugin that can recognize those formats. A built-in generic parser will parse up to three lines of data.
To scan private-use cards, like company or institutional ID cards, you'll need to create your own parser function,
as described below.

## Developing
If you want to experiment with and further develop the plugin, you will need [https://nodejs.org/](Node.js), NPM
and grunt on your computer. Fork and clone the repository, and in the root folder, run `npm install`. This will
fetch the required Node packages. Then run `grunt` to execute the default build task. The command `grunt test` will execute the test suite, using the QUnit testing framework.

Note that while development is done in the NodeJS environment, the plugin itself is not really a Node module. When used
on a web page, there is no dependency on any other Node modules or on Node itself. It's
just a garden-variety jQuery plugin, distributed as a Node package, which is the form jQuery encourages.

## Sample Pages
The sample page [demo-simple.html](demo-simple.html) shows a basic example of using the plugin with the builit-in
parsers. The page [demo-events.html](demo-events.html) shows an example that binds to the events to handlers that
update the user interface as scans occur.

## Events
The plugin defines four custom events which are fired during the scanning process. They are
`scanstart.cardswipe`, `scanend.cardswipe`, `success.cardswipe`, and `failure.cardswipe`.
You can bind listeners to these events to update your page's user interface to provide visual feedback
about the scan. The `success.cardswipe` event handler will receive two parameters, the `event` object
and the scanned data. This is the same data that is passed to the `success` callback. The callback
is invoked first, and then the event is fired. The sample page [demo-events.html](demo-events.html) shows an example
of using event listeners.

## Card Formats
Magnetic cards encode data in up to three tracks.  This expects a card that encodes data on track 1, though
it also reads tracks 2 and 3.  Most cards use track 1.  This won't recognize cards that don't use track 1,
or work with a reader that doesn't read track 1.

See <http://en.wikipedia.org/wiki/Magnetic_card> to understand the format of the data on a card. For details of
the format of bank card numbers, see <http://en.wikipedia.org/wiki/Bank_card_number>.

The data fileds on a line are typically separated by carets, and padded with spaces. Lines are separated by question marks,
and the end of a scan is indicated by a carriage return character. Note that the exact format could vary between various
models of card reader. My own experience is limited to the reader I have. I welcome additions and corrections to this
 information.

To determine the format of the card you're interested in, scan as many samples as you can into a plain text editor like
vi or Notepad.

For example, if you're scanning an employee or student identification card, the data on line 1 may look something like 
this:

	%B6543210000000000^DOE/JOHN                  ^0000000000000000000ABC123456789?

Immediately following the `%B` is a 13-16 digit number. On a credit card, this would be the cardholder account number.
(Each credit card issuer reserves a different range of leading digits for their account numbers. Details for these can
be found online.)
Here, the initial digit 6 indicates that this is a private-use card, and the first six digits (including the 6)
indicate the card issuer (the business or institution).
The subsequent digits may be all zeroes or not; that's up to the issuer.  The next field (between the first and second
`^`) encodes the last name and first name, separated with a slash, and right-padded with spaces. The third field is an
employee or student ID number, here left padded with zeroes.  The final `?` indicates the end of the first line on the
card, and there are no further lines.  Some cards may contain the same data on the second line, but with a different
encoding. Only the first line will contain alphabetic characters; the other lines will consist of only of digits and a 
small number of punctuation characters.

## Custom Card Parsers
For a private-use employee or student ID card like the example above, you will need to create your own
parser function to extract the various data fields you are interested in. The parser will be invoked with a
single string argument containing the raw scanned characters from the card. Typically you'll use a regular expression
to recognize your cards and extract the relevant data. On a successful scan, your parser should return an object with
a property for each field of interest. This will cause the plugin to invoke the successful scan event and the
`success` callback, passing it the object.

If your parser does not recognize the raw data, it should return `null`, which will cause the plugin to move
on to the next defined parser, if any. If no configured parser recognizes the data, the plugin will invoke
the 

A parser function for the above private use card is shown below. 

```
// Parser for example format
var exampleParser = function (rawData) {
	var pattern = new RegExp("^%B6543210000000000\\^([A-Z ]+)/([A-Z ]+)\\^0+([A-Z0-9]+)");
	var match = pattern.exec(rawData);
	if (!match) return null;

	// Extract the data
	var cardData = {
		type: "examplecorp",
		lastName: match[0],
		firstName: match[1],
		idNumber: match[2]
	};

	return cardData;
}

// Configure the plugin to use the parser, with the built-in generic parser as a backup:
$.cardswipe({
	firstLineOnly: true,
	success: successCallback,
	parsers: [ exampleParser, "generic" ],
	error: error,
	debug: true
});
```



When the scanned data does not match your expected format, your parser should return null. This will cause the plugin
to move on to the next parser defined, if any, or invoke the error callback you have defined, if any.

The plugin can be configured to try several different parsers in sequence, so that your application can recognize
different kinds of cards and act accordingly.


## How It Works
The card reader acts like a keyboard, and so causes keydown, keypress, and keyup events when a card is swiped.
We take advantage of the facts that the scan will begin with a pair of unusual characters, usually `%B`, which
is a strange thing to enter on a web page manually, and that the card reader "types" much faster than a human.
	
The plugin uses a simple state machine and timer.  The state machine starts in the IDLE state, waiting
for a % character, which is the leading character on a swipe.  This changes the state to PENDING, and starts
the inter-digit timer.  It also stops event propagation, so the % character does not get sent to the control
with focus on the web page.  Other characters are just passed through as normal.

In the PENDING state, we await a keypress corresponding to a A-Z character, which is the card's format code.
Credit cards and most private use cards (employee ID cards, etc.) use 'B', but other letters are possible.
On seeing a format code, the state machine enters the READING state.  If the next character is not a valid
format code, the state machine returns to the IDLE state, and the keypress is not supressed.

In the READING state, we just append each incoming character to the buffer, until either the interdigit timer
times out, or we see a carriage return character, which indicates the end of the scan, at least on some card
readers. As a performance improvement, the client can set the option `firstLineOnly` to true, and the
state machine will return the scan after the line 1 ending character.  In this case, the state machine enters
the DISCARD state to eat all subsequent characters until the end of the scan, when it goes back to the IDLE state.

Because the initial % character is supressed, if you need to manually enter a % character into a form, you
must type two % characters in quick succession (within the timeout interval).

On a successful scan, the plugin will invoke the parser functions in sequence, passing each the raw character
data.  If a parser recognizes the format, it should return an object that encapsulates the data of interest.
Otherwise, the parser should return null, in which case the plugin will try the next parser.
When a parser succeeds, the the plugin will invoke either the success callback, passing it the parsed
object as a parameter. If no parser succeeds, the plugin will invoke the failure callback. If you're not
interested in this case, it is not necessary to define a failure callback.

## Special Cases
Some card readers, like the Scriptel MagStripe, prefix the scanned data with a manufacturer-specific sequence.
For the Scriptel, it's the string `!STCARD A `. Following this is the usual `%B` sequence.
To accommodate these readers, a prefix character can be set in
the configuration. On seeing the prefix character, the state machine enters the PREFIX state, and consumes characters
until a % character is seen, where we enter the PENDING state and proceed as before.  Indicate the prefix character
in the initial configuration with the `prefixCharacter` property.  For example the prefix for the Scriptel is `!`:

```
var companyCardParser = function (rawData) {
	/// ... process the raw data
};

$.cardswipe({
	parsers: ["visa", "amex", "mastercard", companyCardParser],
	success: goodScan,
	error: badScan,
	firstLineOnly: false,
	prefixCharacter: '!' });
```

When a prefix character is defined, in order to enter it manually into a form field, you will have to enter it twice
in quick succession, just as with `%`.

More than one prefix character can be specified by using an array of characters. For example,
```
$.cardswipe({
	success: goodScan,
    prefixCharacter: [ '!', ';' ] });
```

## Changes From Previous Versions

This version is incompatible with the versions tagged 0.2.1 and prior.

Instead of a single parser to handle any card format, the plugin now accepts an
array of parsers, each of which can be responsible for a single format.  In
addition, there are built-in parsers for the common credit cards (at
least in the U.S.), Visa, MasterCard, and American Express. These can
be used by passing the string "visa", "mastercard", or "amex" in the parser
array in the configuration.

This version raises events during a card scan. See the Events section above.

