How it works:
The card reader acts like a keyboard, and so causes keydown, keypress, and keyup events when a card is swiped.
We take advantage of the facts that the scan will begin with a pair of unusual characters, usually %B, which
is a strange thing to enter on a web page manually, and that the card reader "types" much faster than a human.
	
A simple state machine and timer act on keypress events.  The state machine starts in the IDLE state, waiting
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
the DISCARD state to eat all subsequent characters until the end of the scan, where we go back to the IDLE state.

Because the initial % character is supressed, if you need to manually enter a % character into a form, you
must type two % characters in quick succession (within the timeout interval).

On a successful scan, the plugin will invoke the parser function, passing the raw character data.  If the
parser recognizes the format, it should return an object that encapsulates the data of interest.  Otherwise,
the parser should return null. Then the plugin will invoke either the success callback, passing it the parsed
object as a parameter, or it will invoke the error callback.
