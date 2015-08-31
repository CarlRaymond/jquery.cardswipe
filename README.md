
# What It Does
This jQuery plugin is intended for use with a magnetic card reader that simulates a keyboard.  It allows a
web application to interface with the reader so that scanning a card will trigger a callback function
which can then act on the scanned data.  Scanning a card will not result in keyboard events getting through
to the underlying page, so you can scan a card without regard to which control on the page has focus.

## What It Does Not Do
While this plugin can scan a credit card or debit card account number, it does not validate or verify that data in any way,
and cannot by itself process a credit card transaction.

# Card Formats
Magnetic cards encode data in up to three tracks.  This expects a card that encodes data on track 1, though
it also reads tracks 2 and 3.  Most cards use track 1.  This won't recognize cards that don't use track 1,
or work with a reader that doesn't read track 1.

See <http://en.wikipedia.org/wiki/Magnetic_card> to understand the format of the data on a card.

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
indicate the card issuer (the business or school).
The subsequent digits may be all zeroes or not; that's up to the issuer.  The next field (between the first and second `^`)
encodes the last name and first name, separated with a slash, and right-padded with spaces. The third field is an
employee or student ID number, here left padded with zeroes.  The final `?` indicates the end of the first line on the
card, and there are no further lines.  Some cards may contain the same data on the second line, but with a different
encoding. Only the first line will contain alphabetic characters; the other lines will consist of only of digits and a 
small number of punctuation characters.

# How To Use It
The code example below is for the sample data format above. Your cards of course will be different.
Scan several examples into a plain text editor to see how the data is encoded.

You will need to create a parser function to extract the first and last name and the employee or student ID number,
or whatever fields you're interested in. Typically you'll use a regular expression for this. On a successful scan,
your parser should return a object with a property for each field of interest.  This will cause the plugin to invoke
the successful scan callback, passing it the object.

For example, for the data above the parser could return the following object:

    {
      type: 'Example Corp ID Card',
      firstName: 'JOHN',
      lastName: 'DOE',
      idNumber: 'ABC123456789'
    };

If you're only expecting and accepting one format for the data, the `type` property is unnecessary.

When the scanned data does not match your expected format, your parser should return null. This will cause the plugin
to invoke the error callback you have defined, if any.


# Sample Page

The file [demo.html](demo.html) shows an example of using the plugin with the default parser.

If you have trouble using your scanner and cards with the sample page, try scanning a card into a
plain-text editor like `vi` or `notepad`.  If the scanned data does not start with a `%` followed by
a letter, this plugin will not be able to work with your cards and reader.  However, if the `%`
and a letter are present, but there is a prefix ahead of it, you may be able to use the plugin by
configuring the `prefixCharacter` property.  See an example below.



# How It Works
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

On a successful scan, the plugin will invoke the parser function, passing the raw character data.  If the
parser recognizes the format, it should return an object that encapsulates the data of interest.  Otherwise,
the parser should return null. Then the plugin will invoke either the success callback, passing it the parsed
object as a parameter, or it will invoke the error callback.

Some card readers, like the Scriptel MagStripe, prefix the scanned data with a manufacturer-specific sequence.
For the Scriptel, it's the string `!STCARD A `. To accommodate these readers, a prefix character can be set in
the configuration. On seeing the prefix character, the state machine enters the PREFIX state, and consumes characters
until a % character is seen, where we enter the PENDING state and proceed as before.  Indicate the prefix character
in the initial configuration with the `prefixCharacter` property.  For example the prefix for the Scriptel is `!`:

		$.cardswipe({
			parser: companyCardParser,
			success: goodScan,
			error: badScan,
			firstLineOnly: true,
			prefixCharacter: '!' });

When a prefix character is defined, in order to enter it manually into a form field, you will have to enter it twice
in quick succession, just as with `%`.