property newline : "
"

on loadScript(localScriptName)
	tell application "Finder"
		set locpath to container of (path to me) as text
	end tell
	try
		set scriptObj to load script (alias (locpath & localScriptName & ".scpt"))
		return scriptObj
	on error number -43
		set uld to POSIX path of locpath
		display dialog localScriptName & " not found. Run this command to create it from source:" & newline & "osacompile -o " & uld & localScriptName & ".scpt " & uld & localScriptName & ".applescript"
		return false
	end try
end loadScript


-- Main script
display dialog "This script walks all the tracks in iTunes and syncs up track rating info with the rating info saved in the comments. If you open up a new iTunes with all the files in your collection, this will get the iTunes ratings filled out for you with whatever was previously saved in the comment text.  If you have ratings in iTunes, they will overwrite what is saved in the comment text. The standard comment structure looks like" & newline & newline & "[rating:60][keyw1,key2...] Additional comment text" & newline & newline & "This walks all the tracks in iTunes which can take a while, and there is no progress indicator."
set revscript to loadScript("FGFwebReview")
tell application "iTunes"
	repeat with ct in every track
		set td to revscript's parseTrackData(comment of ct)
		-- display dialog (name of ct) & " - " & (artist of ct) & " rating:" & (rating of ct) & newline & (ptdrat of td) & newline & (ptdkeys of td) & newline & (ptdcmt of td)
		-- if no iTunes rating then set it from the saved comment rating
		if (rating of ct) is equal to 0 and (ptdrat of td) is greater than 0 then
			set (rating of ct) to (ptdrat of td)
		end if
		-- update the saved rating from the iTunes rating if there is one
		if (rating of ct) is greater than 0 then
			set (ptdrat of td) to (rating of ct)
		end if
		set (comment of ct) to revscript's assembleTrackData(td)
	end repeat
end tell
