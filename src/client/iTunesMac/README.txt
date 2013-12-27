Integrated AppleScript is pretty much the only reasonable way to add
extended functionality to iTunes.  Command line tools like osascript
are awesome, but character encodings off a command line environment
can be a hassle.  Objective C programming to hack iTunes components
directly is invasive and doesn't seem worth it.  AppleScript is
limited, but adequate.

WDYDFunExport:
  Copy source songs for any playlist to another directory.
WDYDFunList:
  Upload ratings for songs in the list, Create/Update/Merge a 
  playlist from specified keywords and rating level.
WDYDFunReview:
  Keywords, comments, and star rating for current track

To edit an applescript file, double click it in the Finder to bring it
up in the AppleScript editor.  Edit, compile and run.  Run
Packager.applescript to zip things up for release.

Everything on the Mac is an object, so access via nested tell blocks.
A standard dialog box allows one input field and up to 3 buttons.

In the script editor: File | Open Dictionary, then choose iTunes.
Suites contain commands (C with a circle) and classes (C with a
square), classes contain properties (P) and elements (E).

Please don't upload/download more than 20 ratings or so at once,
server bandwidth is a shared resource and very limited.

