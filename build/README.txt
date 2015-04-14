
THE BUILD SYSTEM IS NOT REQUIRED FOR DEVELOPMENT.  It's goal is to
create a minified combined source file that takes care of all the 
module requirements in one chunk so things load faster.

To run the build, you will need 
 1. node.js installed
 2. the google closure compiler unpacked into a "compiler-latest"
    subdirectory off of here
 3. a java runtime (needed by the compiler)

To create a minified file with all the source (optimized load) run

node build.js


To replace the minified file with an empty file (normal AMD load) run

node build.js clean


