tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set uld to POSIX path of locdir
-- display dialog "uld: " & uld
-- remove any extraneous files that might have crept in during development
do shell script "rm -f " & uld & "*.scpt"
do shell script "rm -f " & uld & "WDYDFun.conf"
do shell script "rm -f " & uld & "*~"
-- compile the source script files so (path to me) etc evaluates properly
set sfnames to {"WDYDFunExport", "WDYDFunPlaylist", "WDYDFunReview", "WDYDFunSettings", "Install", "Uninstall"}
repeat with sfname in sfnames
	set cmd to "osacompile -o " & uld & sfname & ".scpt " & uld & sfname & ".applescript"
	do shell script cmd
end repeat
-- zip the compiled script files
set zipf to uld & "../../../docroot/downloads/iTunesMac.zip"
do shell script "rm -f " & zipf
set command to "zip " & zipf & " -j " & uld & "*.scpt "
-- display dialog "command: " default answer command
do shell script command
-- set zipcontents to do shell script "unzip -l " & zipf
-- display dialog "contents of " & zipf default answer zipcontents
do shell script "rm " & uld & "*.scpt"
display dialog "Local files packaged into " & zipf
