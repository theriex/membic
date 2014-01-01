Why applescript:
---------------

Integrated AppleScript is pretty much the only reasonable way to add
extended functionality to iTunes.  Command line tools like osascript
are great, but character encodings in a command line environment are a
hassle.  Objective C programming to hack iTunes components directly is
invasive overkill right now.  AppleScript is limited, but adequate.


Description of files:
--------------------

Core script files:
  - WDYDFunExport:
    Copy source songs for any playlist to another directory.
  - WDYDFunList:
    Upload ratings for songs in the list, Create/Update/Merge a
    playlist from specified keywords and rating level.
  - WDYDFunReview:
    Keywords, comments, and star rating for current track

Supporting script files:
  - Packager: compiles and creates the download zip
  - Install: copies core script files into iTunes
  - Uninstall: removes core script files from iTunes

Other script files are from general hacking and are kept around for
example code.  To edit an applescript file, double click it in the
Finder to bring it up in the AppleScript editor.  Edit, compile and
run.  Here's what I usually do to test locally:
 1. Run Packager.applescript to zip things up for release
 2. cp ../../../docroot/downloads/iTunesMac.zip ~/Downloads/
 3. double click iTunesMac.zip in ~/Downloads to expand it
 4. double click Install.scpt

Run Packager.applescript to zip things up for release.  Unpack
the zip and run the install script.  



Applescript coding:
------------------

Everything on the Mac is an object, so access via nested tell blocks.
A standard dialog box allows one input field and up to 3 buttons.

In the script editor: File | Open Dictionary, then choose iTunes.
Suites contain commands (C with a circle) and classes (C with a
square), classes contain properties (P) and elements (E).

Please don't upload/download more than 20 ratings or so at once,
server bandwidth is a shared resource and very limited.

