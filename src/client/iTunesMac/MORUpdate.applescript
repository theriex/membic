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
	set prompt to "Upload existing review information to MyOpenReviews?"
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
end if
