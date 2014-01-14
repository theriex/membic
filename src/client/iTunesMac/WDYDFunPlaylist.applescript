property wdtitle : "WDYDFunPlaylist"
property revscript : null
property wdconf : null
property newline : "
"

on loadScript(scrname)
	tell application "Finder"
		set locpath to container of (path to me) as text
	end tell
	set scrobj to load script (alias (locpath & scrname & ".scpt"))
	return scrobj
end loadScript


on getConfigFileMacName()
	tell application "Finder"
		set macpathstr to (container of (path to me) as text) & "WDYDFun.conf"
	end tell
	return macpathstr
end getConfigFileMacName


on defaultConfig()
	set filtopts1 to {"Social", "Dining"}
	set notopts1 to {"Heavy", "Attention"}
	set pl1 to {plname:"WDYDFun Living Room", filtopts:filtopts1, notopts:notopts1, minrat:50}
	set filtopts2 to {"Travel", "Attention"}
	set notopts2 to {"Dining", "Social"}
	set pl2 to {plname:"WDYDFun Phone", filtopts:filtopts2, notopts:notopts2, minrat:70}
	set filtopts3 to {"Dance", "Social"}
	set notopts3 to {"Attention"}
	set pl3 to {plname:"WDYDFun Party", filtopts:filtopts3, notopts:notopts3, minrat:40}
	set defplists to {pl1, pl2, pl3}
	set defconf to {username:"", token:"", penid:"", toff:0, plists:defplists}
	return defconf
end defaultConfig


on loadConfig()
	set wdconf to defaultConfig()
	try
		set fname to getConfigFileMacName()
		set wdconf to (read file fname as list)
		-- writing as list creates an extra list level
		set wdconf to item 1 of wdconf
	end try
end loadConfig


on writeConfig()
	try
		set fname to getConfigFileMacName()
		set wf to open for access fname with write permission
		set eof wf to 0
		write wdconf to wf starting at eof as list
		close access wf
		-- display dialog "wdconf written to " & fname
	on error errStr number errorNumber
		try
			close access wf
		end try
		error errStr number errorNumber
		return false
	end try
end writeConfig


on selectOptions(pldef)
	set ptxt to "Choose keywords that must be in the description of the selected tracks."
	set listchoice to choose from list revscript's funkeys with prompt ptxt default items (filtopts of pldef) with title wdtitle with multiple selections allowed and empty selection allowed
	if listchoice is false then
		return false
	end if
	set (filtopts of pldef) to listchoice
	set notopts to {}
	repeat with keyw in revscript's funkeys
		if (filtopts of pldef) does not contain keyw then
			set end of notopts to keyw
		end if
	end repeat
	set ndflts to {}
	repeat with notopt in (notopts of pldef)
		if (filtopts of pldef) does not contain notopt then
			set end of ndflts to notopt
		end if
	end repeat
	set ptxt to "Choose keywords that must NOT be in the description of the selected tracks."
	set listchoice to choose from list notopts with prompt ptxt default items ndflts with title wdtitle with multiple selections allowed and empty selection allowed
	if listchoice is false then
		return false
	end if
	set (notopts of pldef) to listchoice
	return true
end selectOptions


on selectMinRating(pldef)
	set trat of revscript's idata to (minrat of pldef)
	revscript's promptForRating()
	set (minrat of pldef) to trat of revscript's idata
end selectMinRating


on setPlaylistName(pldef)
	set ptxt to "Name of playlist"
	set dlgresult to display dialog ptxt default answer (plname of pldef)
	set plname of pldef to text returned of dlgresult
	return true
end setPlaylistName


on verifyPlaylistDefinition(pldef)
	selectOptions(pldef)
	selectMinRating(pldef)
	setPlaylistName(pldef)
end verifyPlaylistDefinition


on selectRemovePlaylists()
	set ptxt to "Choose WDYDFun playlist to delete"
	set plnames to {}
	repeat with pldef in (plists of wdconf)
		set end of plnames to (plname of pldef)
	end repeat
	set plname to choose from list plnames with prompt ptxt with title wdtitle
	if plname is false then
		return false
	end if
	set plname to plname as text
	set newlist to {}
	set oldlist to (plists of wdconf)
	-- have to go by index to avoid references via old list..
	repeat with i from 1 to count oldlist
		set defname to plname of oldlist's item i
		if plname is not equal to defname then
			set end of newlist to oldlist's item i
		end if
	end repeat
	set (plists of wdconf) to newlist
end selectRemovePlaylists


on selectPlaylist()
	set newlistname to "- Create New Playlist -"
	set clearlistname to "- Delete Playlist -"
	set plnames to {newlistname}
	repeat with pldef in (plists of wdconf)
		set end of plnames to (plname of pldef)
	end repeat
	set end of plnames to clearlistname
	set ptxt to "Choose WDYDFun playlist to update"
	set plname to choose from list plnames with prompt ptxt with title wdtitle
	if plname is false then
		return false
	end if
	set plname to plname as text
	set currpldef to null
	if plname is equal to clearlistname then
		selectRemovePlaylists()
	else -- creating a list or using an existing one
		if plname is equal to newlistname then
			set currpldef to {plname:"", filtopts:{}, notopts:{}, minrat:0}
			set end of (plists of wdconf) to currpldef
		else
			repeat with pldef in (plists of wdconf)
				set defname to (plname of pldef) as text
				if plname is equal to defname then
					set currpldef to pldef
				end if
			end repeat
		end if
		verifyPlaylistDefinition(currpldef)
	end if
	writeConfig()
	return currpldef
end selectPlaylist


on verifyUsername()
	if (username of wdconf) is equal to "" then
		set ptxt to "Username to connect to WDYDFun.com?"
		set dlgres to display dialog ptxt default answer ""
		set username of wdconf to text returned of dlgres
		set token of wdconf to ""
		set penid of wdconf to ""
	end if
end verifyUsername


on getAccessToken()
	set ptxt to "WDYDFun.com password for " & (username of wdconf) & "?"
	set result to display dialog ptxt default answer "" with hidden answer
	set pass to text returned of result
	set pdat to "user=" & (username of wdconf) & "&pass=" & pass & "&format=record"
	set purl to "https://myopenreviews.appspot.com/login"
	set command to "curl --data \"" & pdat & "\" " & purl
	set rdata to do shell script command
	set AppleScript's text item delimiters to ": "
	set result to text item 2 of rdata
	return result
end getAccessToken


on fetchPenNames()
	if ((token of wdconf) is "") then
		return ""
	end if
	set command to Â
		"curl \"http://www.wdydfun.com/mypens?am=mid" & "&an=" & (username of wdconf) & "&at=" & (token of wdconf) & "&format=record\""
	set rdata to do shell script command
	return rdata
end fetchPenNames


on idOfPenRecord(penrec)
	set idstr to text 8 thru ((offset of "," in penrec) - 1) of penrec
	return idstr
end idOfPenRecord


on nameOfPenRecord(penrec)
	set namestr to text ((offset of "," in penrec) + 7) thru (length of penrec) in penrec
	return namestr
end nameOfPenRecord


on verifyTokenAndPen()
	set pendata to fetchPenNames()
	if ((pendata is "") or (pendata starts with "Authentication failed")) then
		set logintoken to getAccessToken()
		set (token of wdconf) to logintoken
	end if
	set pendata to fetchPenNames()
	set srchtxt to "penid: " & (penid of wdconf) & ", "
	if pendata does not contain srchtxt then
		set penrecs to paragraphs of pendata
		if length of penrecs is equal to 1 then
			set (penid of wdconf) to idOfPenRecord(item 1 of penrecs)
		else
			set pns to {}
			repeat with penrec in penrecs
				set end of pns to nameOfPenRecord(penrec)
			end repeat
			set ptxt to "Which pen name do you want to use for reviews?"
			set pname to choose from list pns with prompt ptxt with title wdtitle
			if pname is false then
				return false
			end if
			set pname to pname as text
			repeat with penrec in penrecs
				if nameOfPenRecord(penrec) is equal to pname then
					set (penid of wdconf) to idOfPenRecord(penrec)
				end if
			end repeat
		end if
	end if
	if (penid of wdconf) is equal to "" then
		display dialog "Pen name verification failed. Not able to upload review information for playlist tracks."
		return false
	end if
	return true
end verifyTokenAndPen


on verifyServerAccess()
	verifyUsername()
	set tokenAndPenVerified to false
	try
		set tokenAndPenVerified to verifyTokenAndPen()
	end try
	if not tokenAndPenVerified then
		return false
	end if
	-- display dialog "username: " & (username of wdconf) & ", penid: " & (penid of wdconf) & ", token: " & (token of wdconf)
	writeConfig()
	return true
end verifyServerAccess


on writePlaylistUploadScript(plname, fname)
	try
		set wf to (open for access fname with write permission)
		set eof wf to 0
		write "# -*- coding: utf-8 -*-" & newline to wf
		write "# Upload music review data from tracks in " & plname & newline to wf
		write "# This file written from AppleScript " & (current date) & newline to wf
		write "import urllib, httplib" & newline to wf
		write "headers = {\"Content-type\": \"application/x-www-form-urlencoded\", \"Accept\": \"text/plain\"}" & newline to wf
		write "# ------------------------" & newline to wf
		tell application "iTunes"
			repeat with currtrack in (every track of user playlist plname)
				if (rating of currtrack) > 0 then
					set tdata to revscript's parseTrackData(comment of currtrack)
					set keycsv to (ptdkeys of tdata)
					set datline to "data = \"am=mid&an=" & (username of wdconf) & "&at=" & (token of wdconf) & "&penid=" & (penid of wdconf) & "&revtype=music&title=\" + urllib.quote(\"" & (name of currtrack) & "\") + \"&artist=\" + urllib.quote(\"" & (artist of currtrack) & "\") + \"&rating=" & (rating of currtrack) & "&keywords=\" + urllib.quote(\"" & keycsv & "\") + \"&mode=batch\""
					-- text may contain newlines so have to triple quote
					-- empty string triple quotes work badly, so check first
					if (((ptdcmt of tdata) is not missing value) and (length of (ptdcmt of tdata) > 0)) then
						set datline to datline & " + \"&text=\" + urllib.quote(\"\"\"" & (ptdcmt of tdata) & "\"\"\")"
					end if
					if (album of currtrack) is not missing value then
						set datline to datline & " + \"&album=\" + urllib.quote(\"" & (album of currtrack) & "\")"
					end if
					if (year of currtrack) is not missing value then
						set datline to datline & " + \"&year=" & (year of currtrack) & "\""
					end if
					write datline & newline to wf
					write "print data" & newline to wf
					write "conn = httplib.HTTPConnection(\"www.wdydfun.com\")" & newline to wf
					write "conn.request(\"POST\", \"/newrev\", data, headers)" & newline to wf
					write "response = conn.getresponse()" & newline to wf
					write "print response.status, response.reason" & newline to wf
					write "conn.close()" & newline to wf
					write "# ------------------------" & newline to wf
				end if
			end repeat
		end tell
		write "print \"Upload complete\"" & newline to wf
		close access wf
	on error errStr number errorNumber
		try
			close access wf
		end try
		display dialog "Writing " & fname & " failed."
		error errStr number errorNumber
		return false
	end try
end writePlaylistUploadScript


on uploadPlaylistReviewData(pldef)
	set haveExistingPlaylist to false
	tell application "iTunes"
		try
			set pl to user playlist (plname of pldef)
			set haveExistingPlaylist to true
		end try
	end tell
	if not haveExistingPlaylist then
		set tn to (plname of pldef)
		set tprops to {name:tn}
		tell application "iTunes"
			make new user playlist with properties tprops
		end tell
	else if not verifyServerAccess() then
		return false
	end if
	-- at the time of this comment, ~/Library/Caches/TemporaryItems/
	set tempfolderstr to ((path to temporary items from user domain) as string)
	set ups to tempfolderstr & "WDYDFunUpload.py"
	writePlaylistUploadScript((plname of pldef), ups)
	set outfile to tempfolderstr & "WDYDFunUpload.out"
	-- run the upload script in the background
	set command to "/usr/bin/python " & (quoted form of (POSIX path of ups)) & " &> " & (quoted form of (POSIX path of outfile)) & " &"
	set sorted to do shell script command
	tell application "iTunes"
		repeat with ctrk in (every track of user playlist (plname of pldef))
			set played date of ctrk to current date
		end repeat
	end tell
	return true
end uploadPlaylistReviewData


on recentPlay(lastplay, cmt)
	set freq to revscript's readColonFieldVal("freq", cmt, -1)
	if (freq as number) is equal to 0 then
		return true
	end if
	if freq is greater than 0 and lastplay is not missing value then
		set availdate to lastplay + (freq * days)
		if (current date) is less than availdate then
			return true
		end if
	end if
	return false
end recentPlay


on copyMatchingTracks(plen, tids, pldef)
	-- display dialog "copyMatchingTracks start..."
	set dstart to current date
	set toff to (toff of wdconf)
	set skipquantum to 30 -- one selection per double album
	set skipping to skipquantum
	set tcnt to 0
	set tcopied to 0
	set plname to (plname of pldef)
	set filtopts to (filtopts of pldef)
	set notopts to (notopts of pldef)
	set minrat to (minrat of pldef)
	tell application "iTunes"
		repeat with ct in every track
			set tcnt to tcnt + 1
			if tcnt is greater than or equal to toff then
				-- display dialog "tcnt: " & tcnt & ", toff: " & toff & ", skipping: " & skipping
				set toff to toff + 1
				set skipping to skipping - 1
				if skipping is less than or equal to 0 then
					-- display dialog (name of ct) & " - " & (artist of ct) & ", min: " & minrat & ", rating: " & (rating of ct)
					if (rating of ct) is greater than or equal to minrat then
						set cmt to (comment of ct)
						set haveAttrs to false
						repeat with attr in filtopts
							if cmt contains attr then
								set haveAttrs to true
								exit repeat
							end if
						end repeat
						-- display dialog cmt & newline & "attrs: " & filtopts & newline & "haveAttrs: " & haveAttrs
						if haveAttrs then
							set badAttrs to false
							repeat with attr in notopts
								if cmt contains attr then
									set badAttrs to true
								end if
							end repeat
							-- display dialog cmt & newline & notopts & newline & "batAttrs: " & badAttrs
							if not badAttrs then
								set rp to my recentPlay((played date of ct), cmt)
								if not rp then
									set tid to (id of ct)
									if tids does not contain tid then
										duplicate ct to user playlist plname
										set end of tids to (id of ct)
										set tcopied to tcopied + 1
										set skipping to skipquantum
									end if
								end if
							end if
						end if
					end if
				end if
			end if
			if tcopied is greater than or equal to plen then
				exit repeat
			end if
		end repeat
	end tell
	set dend to current date
	-- display dialog "start: " & dstart & newline & "  end: " & dend & newline & "toff: " & toff & newline & "tcopied: " & tcopied
	set (toff of wdconf) to toff
	return tcopied
end copyMatchingTracks


on updatePlaylistTracks(pldef)
	set tids to {}
	tell application "iTunes"
		repeat with ct in every track of user playlist (plname of pldef)
			set end of tids to (id of ct)
		end repeat
		delete every track of user playlist (plname of pldef)
	end tell
	-- display dialog "Updating tracks, toff: " & (toff of wdconf)
	-- display dialog "tids: " & tids
	set plen to 80
	set tcopied to copyMatchingTracks(plen, tids, pldef)
	if tcopied is less than plen then
		set (toff of wdconf) to random number from 0 to 50
		set plrem to plen - tcopied
		copyMatchingTracks(plrem, tids, pldef)
	end if
	-- display dialog "Writing updated config, toff: " & (toff of wdconf)
	writeConfig() -- note updated toff
end updatePlaylistTracks


on updatePlaylist(pldef)
	if pldef is equal to null or pldef is equal to false then
		return
	end if
	if not uploadPlaylistReviewData(pldef) then
		display dialog "Upload of \"" & (plname of pldef) & "\" review data failed. Continue and rebuild contents of playlist anyway?"
	end if
	updatePlaylistTracks(pldef)
end updatePlaylist


-- Main script
set revscript to loadScript("WDYDFunReview")
loadConfig()
updatePlaylist(selectPlaylist())
