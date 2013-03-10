property updplaylist : missing value
property listkeyw : missing value
property datezero : missing value
property newline : "
"

-- ///////////////////////////////////////////////////////////////////////////
-- // Helper functions
-- ///////////////////////////////////////////////////////////////////////////

on listChosen(MORUtil)
	tell MORUtil
		set keywords to MORUtil's getMORKeywordsList()
	end tell
	tell application "iTunes"
		set plnames to the name of every playlist
	end tell
	set pchoices to {}
	set default to {}
	repeat with keyword in keywords
		set listname to "MOR " & keyword
		repeat with plname in plnames
			if (listname as text) is equal to (plname as text) then
				set pchoices to (pchoices & listname)
			end if
		end repeat
	end repeat
	if (count of pchoices) is equal to 0 then
		display dialog "No MOR playlists found, run the MORSetup script."
		return false
	end if
	set ptxt to "Select the list to update"
	set listchoice to choose from list pchoices with prompt ptxt with title "MORUpdate"
	if listchoice is false then
		return false
	end if
	set listchoice to (item 1 of listchoice)
	set listkeyw to (text 5 thru (length of listchoice) of listchoice)
	tell application "iTunes"
		set updplaylist to user playlist listchoice
	end tell
	return true
end listChosen


on writeMORUploadScript(ups, conf, MORUtil)
	try
		set sfile to (open for access ups with write permission)
		set eof sfile to 0
		write "# Upload music review data to MyOpenReviews" & newline to sfile
		write "# This file written from AppleScript " & (current date) & newline to sfile
		write "import urllib, httplib" & newline to sfile
		write "headers = {\"Content-type\": \"application/x-www-form-urlencoded\", \"Accept\": \"text/plain\"}" & newline to sfile
		write "# ------------------------" & newline to sfile
		tell application "iTunes"
			repeat with currtrack in (every track of updplaylist)
				if (rating of currtrack) > 0 then
					set tdata to {tcmt:(comment of currtrack), selkeys:"", comtxt:""}
					MORUtil's parseTrackComment(tdata)
					set keycsv to MORUtil's listValsToCSV(selkeys of tdata)
					set datline to "data = \"am=mid&an=" & (username of conf) & "&at=" & (token of conf) & "&penid=" & (penid of conf) & "&revtype=music&title=\" + urllib.quote(\"" & (name of currtrack) & "\") + \"&artist=\" + urllib.quote(\"" & (artist of currtrack) & "\") + \"&rating=" & (rating of currtrack) & "&keywords=\" + urllib.quote(\"" & keycsv & "\") + \"&mode=batch\""
					-- text may contain newlines so have to triple quote
					-- empty string triple quotes work badly, so check first
					if (((comtxt of tdata) is not missing value) and (length of (comtxt of tdata) > 0)) then
						set datline to datline & " + \"&text=\" + urllib.quote(\"\"\"" & (comtxt of tdata) & "\"\"\")"
					end if
					if (album of currtrack) is not missing value then
						set datline to datline & " + \"&album=\" + urllib.quote(\"" & (album of currtrack) & "\")"
					end if
					if (year of currtrack) is not missing value then
						set datline to datline & " + \"&year=" & (year of currtrack) & "\""
					end if
					write datline & newline to sfile
					write "print data" & newline to sfile
					write "conn = httplib.HTTPConnection(\"www.myopenreviews.com\")" & newline to sfile
					write "conn.request(\"POST\", \"/newrev\", data, headers)" & newline to sfile
					write "response = conn.getresponse()" & newline to sfile
					write "print response.status, response.reason" & newline to sfile
					write "conn.close()" & newline to sfile
					write "# ------------------------" & newline to sfile
				end if
			end repeat
		end tell
		write "print \"Upload complete\"" & newline to sfile
		close access sfile
	on error
		try
			close access sfile
		end try
		display dialog "Writing " & ups & " failed."
		return false
	end try
end writeMORUploadScript


on uploadPlaylistReviewData(MORUtil)
	tell application "iTunes"
		set prompt to "Upload data from " & (name of updplaylist) & " to MyOpenReviews?"
	end tell
	set doup to display dialog prompt buttons {"No", "Yes"} default button 2 with title "MORUpdate"
	if button returned of result is not equal to "Yes" then
		return true -- nothing to do, return as if completed successfully
	end if
	set conf to MORUtil's verifyAccess(true)
	set ups to ((path to temporary items from user domain) as string) & "MORUpload.py"
	writeMORUploadScript(ups, conf, MORUtil)
	set outfile to ((path to temporary items from user domain) as string) & "MORUpload.out"
	-- run the upload script in the background
	set command to "/usr/bin/python " & (quoted form of (POSIX path of ups)) & " &> " & (quoted form of (POSIX path of outfile)) & " &"
	set sorted to do shell script command
	return true
end uploadPlaylistReviewData


on isodatestr(date)
	set {year:y, month:m, day:d} to dt
	set y to text 2 through -1 of ((y + 10000) as text)
	set m to text 2 through -1 of ((m + 100) as text)
	set d to text 2 through -1 of ((d + 100) as text)
	return y & "-" & m & "-" & d
end isodatestr


on populatePlaylist()
	set datezero to current date
	set year of datezero to 1972
	tell application "iTunes"
		set prompt to "Reset contents of " & (name of updplaylist) & "?"
		set doup to display dialog prompt buttons {"No", "Yes"} default button 2 with title "MORUpdate"
		if button returned of result is not equal to "Yes" then
			return true -- nothing to do, return as if completed successfully
		end if
		repeat with curtrack in (every track of updplaylist)
			set played date of curtrack to current date
		end repeat
		delete every track of updplaylist
		set keytracks to every track of library playlist 1 whose rating > 50 and comment contains listkeyw
		-- fill out the played date if missing
		repeat with keytrack in keytracks
			if (played date of keytrack) is missing value then
				set played date of keytrack to datezero
			end if
		end repeat
		-- write the records to file and sort (script sorting is slow)
		try
			set mps to ((path to temporary items from user domain) as string) & "MORSort.txt"
			set sfile to (open for access mps with write permission)
			set eof sfile to 0
			repeat with keytrack in keytracks
				set tempdate to (played date of keytrack)
				tell me to set temptxt to isodatestr(tempdate)
				write temptxt & ":" & (id of keytrack) & newline to sfile
			end repeat
			close access sfile
		on error
			try
				close access sfile
			end try
			display dialog "Writing MORSort.txt failed."
			return false
		end try
		set command to "sort " & (quoted form of (POSIX path of mps))
		set sorted to do shell script command
		set sortlines to paragraphs of sorted
		set tracksAdded to 0
		set AppleScript's text item delimiters to ":"
		repeat with currLine in sortlines
			set tracksAdded to (tracksAdded + 1)
			if (tracksAdded) > 80 then
				exit repeat
			end if
			set tid to ((text item 2 of currLine) as integer)
			set tmptrack to (first track of library playlist 1 whose id is equal to tid)
			duplicate tmptrack to updplaylist
		end repeat
	end tell
end populatePlaylist


on makeStandardPlaylistIndex(exportFolder, plname)
	display dialog "Create standard playlist index file for copied files?" buttons {"No", "Yes"} default button 2 with title "MORUpdate"
	if button returned of result is not equal to "Yes" then
		return true
	end if
	try
		set m3ufname to (exportFolder as text) & plname & ".m3u"
		set m3uf to open for access m3ufname with write permission
		set eof m3uf to 0
		write "# This is just a simple m3u list" & newline to m3uf
		tell application "Finder"
			set allfilenames to name of every file of entire contents of folder exportFolder
			repeat with fname in allfilenames
				write fname & newline to m3uf
			end repeat
		end tell
		close access m3uf
	on error errStr number errorNumber
		try
			close access m3uf
		end try
		error errStr number errorNumber
		return false
	end try
end makeStandardPlaylistIndex


on copyPlaylistSourceFiles(exportFolder)
	tell application "iTunes"
		set plname to (name of updplaylist)
		display dialog "Exporting source files from " & plname & " to " & (POSIX path of exportFolder) & ". This can take a minute or more. Watch the volume."
		set userVolume to sound volume
		set alltracks to every track of updplaylist
		set curriter to 0
		set ttliter to (count of alltracks)
		repeat with currtrack in (every track of updplaylist)
			set sound volume to ((curriter * 100) div ttliter)
			set curriter to (curriter + 1)
			set fsource to (location of currtrack)
			tell application "Finder"
				duplicate file fsource to exportFolder with replacing
			end tell
		end repeat
		set sound volume to userVolume
	end tell
	makeStandardPlaylistIndex(exportFolder, plname)
end copyPlaylistSourceFiles


on copyPlaylistContents()
	tell application "iTunes"
		set plname to (name of updplaylist)
	end tell
	set copyprompt to "Copy all the source files for tracks in " & plname & " to a separate folder?"
	set docopy to display dialog copyprompt buttons {"No", "Yes"} default button 1 with title "MORUpdate"
	if button returned of result is not equal to "Yes" then
		return true -- nothing to do, return as if completed successfully
	end if
	set selprompt to "Copying all the source files can take a few minutes. What folder should the source files be copied to?"
	set exportFolder to choose folder with prompt selprompt
	-- if they cancel the folder selection then we error out, otherwise
	tell application "Finder"
		set existFiles to every file of folder exportFolder
		set ttlfiles to (count of existFiles)
		if ttlfiles > 0 then
			set cleanprompt to (POSIX path of exportFolder) & " contains " & ttlfiles & " files. Do you want to hard delete the entire contents so the folder is empty before copying files from " & plname & " over?"
			set dodel to display dialog cleanprompt buttons {"No", "Yes"} default button 1 with title "MORUpdate"
			if button returned of result is equal to "Yes" then
				-- delete all files the quick hard way with no crap left around
				set command to "rm -rf " & (POSIX path of exportFolder) & "*"
				-- display dialog command
				do shell script command
			end if
		end if
	end tell
	copyPlaylistSourceFiles(exportFolder)
end copyPlaylistContents


-- ///////////////////////////////////////////////////////////////////////////
-- // external helper script loader
-- ///////////////////////////////////////////////////////////////////////////

on loadScript(localScriptName)
	tell application "Finder"
		set locpath to container of (path to me) as text
	end tell
	return load script (alias (locpath & localScriptName))
end loadScript


-- ///////////////////////////////////////////////////////////////////////////
-- // Core script processing
-- ///////////////////////////////////////////////////////////////////////////

set MORUtil to loadScript("MORUtil.scpt")
if listChosen(MORUtil) and uploadPlaylistReviewData(MORUtil) then
	populatePlaylist()
	copyPlaylistContents()
end if
