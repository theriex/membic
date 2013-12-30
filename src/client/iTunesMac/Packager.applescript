tell application "Finder"
	set locdir to container of (path to me) as text
end tell
set uld to POSIX path of locdir
-- display dialog "uld: " & uld
-- compile the source script files so (path to me) etc evaluates properly
do shell script "osacompile -o " & uld & "WDYDFunExport.scpt " & uld & "WDYDFunExport.applescript"
do shell script "osacompile -o " & uld & "WDYDFunList.scpt " & uld & "WDYDFunList.applescript"
do shell script "osacompile -o " & uld & "WDYDFunReview.scpt " & uld & "WDYDFunReview.applescript"
do shell script "osacompile -o " & uld & "Install.scpt " & uld & "Install.applescript"
-- zip the compile script files and supporting python script
set zipf to uld & "../../../docroot/downloads/iTunesMac.zip"
do shell script "rm -f " & zipf
set command to "zip " & zipf & " -j " & uld & "*.scpt " & uld & "*.py"
-- display dialog "command: " default answer command
do shell script command
-- set zipcontents to do shell script "unzip -l " & zipf
-- display dialog "contents of " & zipf default answer zipcontents
do shell script "rm " & uld & "*.scpt"
display dialog "Local files packaged into " & zipf
