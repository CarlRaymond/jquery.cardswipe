# What It Does
This jQuery plugin is intended for use with a magnetic card scanner that simulates a keyboard.  It allows a
web application to interface with the card scanner so that scanning a card will trigger a callback function
which can then act on the scanned data.  Scanning a card will not result in keyboard events getting through
to the underlying page, so you can scan a card without regard to which control on the page has focus.

Magnetic cards encode data in up to three tracks.  This expects a card that encodes data on track 1, though
it also reads tracks 2 and 3.  Most cards use track 1.  This won't recognize cards that don't use track 1,
or work with a reader that doesn't read track 1.

See <http://en.wikipedia.org/wiki/Magnetic_card> to understand the format of the data on a card.

## What It Does Not Do
While this plugin can scan a credit card or debit card account number, it does not validate or verify that data in any way,
and cannot by itself process a credit card transaction.  This plugin is not a substitue for a point-of-sale
terminal or a web- or app-based payment system like Square&#8482; or Intuit&reg; GoPayment.

# How It Works
The card reader acts like a keyboard, and so causes keydown, keypress, and keyup events when a card is swiped.
We take advantage of the facts that the scan will begin with a pair of unusual characters, usually `%B`, which
is a strange thing to enter on a web page manually, and that the card reader "types" much faster than a human.
	
The plugin uses a simple state machine and timer.  The state machine starts in the IDLE state, waiting
for a % character, which is the leading character on a swipe.  This changes the state to PENDING, and starts
the inter-digit timer.  It also stops event propagation, so the % character does not get sent to the control
with focus on the web page.

In the PENDING state, we await a keypress corresponding to a A-Z character, which is the card's format code.
Credit cards and most private use cards (employee ID cards, etc.) use 'B', but other letters are possible.
On seeing a format code, the state machine enters the READING state.  If the next character is not a valid
format code, the state machine returns to the IDLE state, and the keypress is not supressed.

In the READING state, we just append each incoming character to the buffer, until either the interdigit timer
times out, or we see a carriage return character, which indicates the end of the scan, at least on some card
readers. As a performance improvement, the client can set the option firstLineOnly to true, and the
state machine will return the scan after the line 1 ending character.  In this case, the state machine enters
the DISCARD state to eat all subsequent characters until the end of the scan, when it goes back to the IDLE state.

Because the initial % character is supressed, if you need to manually enter a % character into a form, you
must type two % characters in quick succession (within the timeout interval).

On a successful scan, the plugin will invoke the parser function, passing the raw character data.  If the
parser recognizes the format, it should return an object that encapsulates the data of interest.  Otherwise,
the parser should return null. Then the plugin will invoke either the success callback, passing it the parsed
object as a parameter, or it will invoke the error callback.

# How To Use It
You will need to create a parser function that recognizes the data on the kind of card you're interested in.  For
example, if you're scanning an employee or student identification card, the data on line 1 may look something like this:

	%B6543210000000000^DOE/JOHN                  ^0000000000000000000ABC123456789?

Your cards of course will be different.  You will need to create a parser function using a regular expression to extract
the first and last name and the employee or student ID number, or whatever fields you're interested.
Here's a sample page that handles the example format:

	<html>
	<head>
		<script type="text/javascript" src="/scripts/jquery-1.7.2.js"></script>
		<script type="text/javascript" src="/scripts/jquery.cardswipe.js"></script>
		<title>Demo</title>
	</head>
	<body>
		<h1>Cardswipe Demo</h1>
		<p>Plug in your card reader and scan a card.</p>

		<script type="text/javascript">

		// Parses raw scan into name and ID number
		var companyCardParser = function (rawData) {

			// RegExp to extract the first and last name and ID number from the raw data
			var pattern = new RegExp("^%B612345[0-9]{10}\\^([A-Z ]+)\/([A-Z ]+)\\^0*([A-Z0-9])+\\?");
			var match = pattern.exec(rawData);
			if (!match)
				return null;

			var cardData = {
				firstName: $.trim(match[2]),
				lastName: $.trim(match[1]),
				idNumber: match[3]
			};
			return cardData;
		};

		// Called on a good scan (company card recognized)
		var goodScan = function (cardData) {
			var text = ['Success!\nFirst name: ', cardData.firstName, '\nLast name: ', cardData.lastName, '\nID number: ', cardData.idNumber].join('');
			alert(text);
			};

		// Called on a bad scan (company card not recognized)
		var badScan = function() {
			alert('Card not recognized.');
		};

		// Initialize the plugin.
		$.cardswipe({
			parser: companyCardParser,
			success: goodScan,
			error: badScan
		});

		</script>



