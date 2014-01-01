tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set locdir to (POSIX path of locdir)
set itsdir to (POSIX path of ((path to home folder as text) & "Library:iTunes:Scripts:"))
set filenames to {"MORKeywords.scpt", "MORUpdate.scpt", "MORUtil.scpt", "MORSetup.scpt", "morLinifyRecord.py", "WDYDFunExport.scpt", "WDYDFunList.scpt", "WDYDFunReview.scpt"}
repeat with fname in filenames
	set cfile to (quoted form of (itsdir & fname))
	set command to "rm -f " & cfile
	do shell script command
end repeat
display dialog "WDYDFun script files removed"
