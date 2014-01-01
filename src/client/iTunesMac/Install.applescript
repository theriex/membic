property newline : "
"

tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set locdir to (POSIX path of locdir)
set itsdir to (POSIX path of ((path to home folder as text) & "Library:iTunes:Scripts:"))
display dialog "Installing to " & itsdir
set command to "mkdir -p " & (quoted form of itsdir)
do shell script command
set filenames to {"WDYDFunExport.scpt", "WDYDFunList.scpt", "WDYDFunReview.scpt"}
repeat with fname in filenames
	set cfile to (quoted form of (locdir & fname))
	set command to "cp " & cfile & " " & itsdir
	do shell script command
end repeat
display dialog "Script files installed." & newline & newline & "WDYDFunExport: copy all playlist files to another folder." & newline & newline & "WDYDFunList: create or refresh a playlist." & newline & newline & "WDYDFunReview: review the currently playing track." & newline & newline & "You might want to set up option-; as a key binding for WDYDFunReview so you can quickly review the currently playing track."
