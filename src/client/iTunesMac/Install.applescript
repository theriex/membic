tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set locdir to (POSIX path of locdir)
-- display dialog locdir
set itsdir to (POSIX path of ((path to home folder as text) & "Library:iTunes:Scripts:"))
display dialog "Installing to " & itsdir
set command to "mkdir -p " & (quoted form of itsdir)
do shell script command
set filenames to {"WDYDFunExport.scpt", "WDYDFunList.scpt", "morLinifyRecord.py", "WDYDFunReview.scpt"}
repeat with fname in filenames
	set cfile to (quoted form of (locdir & fname))
	set command to "cp " & cfile & " " & itsdir
	do shell script command
end repeat
display dialog "Script files installed. Choose WDYDFunReview to review the currently playing track. You might want to set up option-; as a key binding for that.  Use WDYDFunList to create a new playlist from track review data.  Use WDYDFunExport to export a playlist."
