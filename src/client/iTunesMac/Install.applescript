tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set locdir to (POSIX path of locdir)
-- display dialog locdir
set itsdir to (POSIX path of ((path to home folder as text) & "Library:iTunes:Scripts:"))
display dialog "Installing to " & itsdir
set command to "mkdir -p " & (quoted form of itsdir)
do shell script command
set filenames to {"MORUtil.scpt", "MORSetup.scpt", "morLinifyRecord.py", "MORKeywords.scpt", "MORUpdate.scpt"}
repeat with fname in filenames
	set cfile to (quoted form of (locdir & fname))
	set command to "cp " & cfile & " " & itsdir
	do shell script command
end repeat
display dialog "Script files installed. From the iTunes script menu, select MORSetup to get started"
