property locpath : missing value

-- ///////////////////////////////////////////////////////////////////////////
-- // Helper functions
-- ///////////////////////////////////////////////////////////////////////////

-- return true if iTunes has the named playlist, false otherwise
on havePlaylist(keyword)
	set listfound to false
	set listname to "MOR " & keyword
	tell application "iTunes"
		set listfound to exists user playlist listname
	end tell
	return listfound
end havePlaylist


on createThisPlaylist(keyword)
	set createList to false
	set listname to "MOR " & keyword
	set prompt to "Create \"" & listname & "\" playlist?"
	set result to display dialog prompt buttons {"No", "Yes"} default button 2
	if button returned of result is equal to "Yes" then
		set createList to true
	end if
	return createList
end createThisPlaylist


-- check which MOR playlists are wanted and create if necessary
on verifyPlaylists(MORUtil)
	tell MORUtil
		set keywords to MORUtil's getMORKeywordsList()
	end tell
	set foundAllLists to true
	repeat with keyword in keywords
		if not havePlaylist(keyword) then
			set foundAllLists to false
		end if
	end repeat
	if foundAllLists then
		return true
	end if
	set createAll to false
	set prompt to "Create all MyOpenReviews (MOR) managed playlists?"
	set allbutton1 to "Ask for any not already defined"
	set allbutton2 to "Create all " & (count of keywords)
	set result to display dialog prompt buttons {allbutton1, allbutton2} default button 2
	if button returned of result is equal to allbutton2 then
		set createAll to true
	end if
	repeat with keyword in keywords
		if not havePlaylist(keyword) then
			if createAll or createThisPlaylist(keyword) then
				set listname to "MOR " & keyword
				set listprops to {name:listname}
				tell application "iTunes"
					make new user playlist with properties listprops
				end tell
			end if
		end if
	end repeat
end verifyPlaylists


on unquote(val)
	set result to do shell script "/usr/bin/python -c 'import sys, urllib; print urllib.unquote(sys.argv[1])' " & quoted form of val
end unquote


-- parsing the record data and calling unquote for each elem is too slow
on getReviewRecordFromLine(revrec)
	set rec to {mortitle:"", morartist:"", moralbum:"", moryear:"", morrating:"", mormodified:"", morkeywords:"", mortext:""}
	set linified to do shell script "/usr/bin/python " & (POSIX path of locpath) & "morLinifyRecord.py " & quoted form of revrec
	set vals to paragraphs of linified
	set mortitle of rec to (item 2 of vals)
	set morartist of rec to (item 3 of vals)
	set moralbum of rec to (item 4 of vals)
	set moryear of rec to (item 5 of vals)
	set morrating of rec to (item 6 of vals)
	set mormodified of rec to (item 7 of vals)
	set morkeywords of rec to (item 8 of vals)
	set mortext of rec to (item 9 of vals)
	return rec
end getReviewRecordFromLine


on displayReviewRecord(revrec)
	set displayval to "mortitle: " & (mortitle of revrec) & "
" & "morartist: " & (morartist of revrec) & "
" & "moralbum: " & (moralbum of revrec) & "
" & "moryear: " & (moryear of revrec) & "
" & "morrating: " & (morrating of revrec) & "
" & "mormodified: " & (mormodified of revrec) & "
" & "morkeywords: " & (morkeywords of revrec) & "
" & "mortext: " & (mortext of revrec) & "
"
	display dialog displayval
end displayReviewRecord


on getCursorRecordFromLine(revrec)
	set rec to {morfetched:"", morcursor:""}
	set AppleScript's text item delimiters to ", "
	set elems to text items of revrec
	set AppleScript's text item delimiters to ": "
	repeat with elem in elems
		set idvalpair to text items of elem
		set val to text item 2 of idvalpair
		if (text item 1 of elem) is equal to "fetched" then
			set morfetched of rec to val
		end if
		if (text item 1 of elem) is equal to "cursor" then
			set morcursor of rec to val
		end if
	end repeat
	return rec
end getCursorRecordFromLine


-- Plain search of title just hangs. Go by only artist and then match title.
on updateiTunes(revrec, readprog)
	tell application "iTunes"
		set artistTracks to search playlist "Library" for (morartist of revrec) only artists
		repeat with artistTrack in artistTracks
			set trackName to (get name of artistTrack)
			set mtitleartist to (trackName is equal to (mortitle of revrec))
			set trackAlbum to (get album of artistTrack)
			set malbum to (trackAlbum is equal to (moralbum of revrec))
			set mdefault to false
			if (mtitleartist and not malbum) then
				set trackComment to (get comment of artistTrack)
				if trackComment is missing value then
					set trackComment to ""
				end if
				set trackRating to (get rating of artistTrack)
				if trackRating is missing value then
					set trackRating to 0
				end if
				if ((trackComment is equal to "") and (trackRating < 20)) then
					set mdefault to true
				end if
			end if
			if ((mtitleartist and malbum) or (mdefault)) then
				set updttl of readprog to ((updttl of readprog) + 1)
				set rating of artistTrack to (morrating of revrec)
				set comment of artistTrack to ("[" & (morkeywords of revrec) & "] " & (mortext of revrec))
			end if
		end repeat
	end tell
	set readttl of readprog to ((readttl of readprog) + 1)
	return true
end updateiTunes


on updateiTunesReviewData(conf, readprog, revrec)
	if (revrec starts with "revid:") then
		set revrec to getReviewRecordFromLine(revrec)
		-- display dialog "Read " & (readttl of readprog) & " Updated " & (updttl of readprog) & " Processing " & (mortitle of revrec) & " - " & (morartist of revrec)
		if (updateiTunes(revrec, readprog)) then
			set pullsince of conf to (mormodified of revrec)
		end if
	else
		set cursrec to getCursorRecordFromLine(revrec)
		set readcursor of readprog to (morcursor of cursrec)
	end if
end updateiTunesReviewData


on verifyDataRecords(rdata)
	set retval to true
	if (rdata contains "<html") then
		display dialog "Bad record data received: " default answer rdata
		set retval to false
	end if
	return retval
end verifyDataRecords


on readFromMyOpenReviews(conf, maxdate, readprog)
	tell application "iTunes"
		set userVolume to sound volume
	end tell
	set command to "curl \"http://www.myopenreviews.com/srchrevs?am=mid&an=" & (username of conf) & "&at=" & (token of conf) & "&mindate=" & (pullsince of conf) & "&maxdate=" & maxdate & "&oldfirst=true&penid=" & (penid of conf) & "&revtype=music&format=record\""
	set rdata to do shell script command
	if verifyDataRecords(rdata) then
		set recs to paragraphs of rdata
		set recnum to 1
		set ttlrecs to (count of recs)
		repeat with revrec in recs
			tell application "iTunes"
				set sound volume to recnum
			end tell
			set recnum to (recnum + 1)
			updateiTunesReviewData(conf, readprog, revrec)
		end repeat
	end if
	tell application "iTunes"
		set sound volume to userVolume
	end tell
end readFromMyOpenReviews


-- pull down any new reviews modified outside of this script 
on downloadReviewData(MORUtil)
	set conf to MORUtil's verifyAccess(false)
	set maxdate to do shell script "date -u +\"%Y-%m-%dT%H:%M:%SZ\""
	set readprog to {readttl:0, updttl:0, readcursor:""}
	set haveDataToRead to true
	repeat while haveDataToRead
		readFromMyOpenReviews(conf, maxdate, readprog)
		set pullsinceUpdated to MORUtil's writeConfigToFile(conf)
		set haveDataToRead to ((readcursor of readprog) is not equal to "")
		set progmsg to "Read " & (readttl of readprog) & " reviews and updated " & (updttl of readprog) & " tracks through to " & (pullsince of conf) & ". "
		if haveDataToRead then
			set progmsg to (progmsg & "Continue?")
		end if
		display dialog progmsg
	end repeat
end downloadReviewData


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
verifyPlaylists(MORUtil)
set timenotice to "Downloading review data from MyOpenReviews. The retrieval call normally takes a couple of seconds, updating iTunes takes longer. Watch the volume."
display dialog timenotice
downloadReviewData(MORUtil)
set endnotice to "Setup complete. 

Select MORKeywords from the iTunes script menu to update review information for the current track. 

Select MORUpdate from the iTunes script menu to update the contents of an MOR playlist.
"
display dialog endnotice
