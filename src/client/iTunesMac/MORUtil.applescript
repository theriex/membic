-- ///////////////////////////////////////////////////////////////////////////
-- // Common helper functions used by MOR scripts
-- ///////////////////////////////////////////////////////////////////////////

on getMacConfigFilePath()
	tell application "Finder"
		set macpathstr to (container of (path to me) as text) & "MyOpenReviews.conf"
	end tell
	return macpathstr
end getMacConfigFilePath


on getMORKeywordsList()
	set keywords to {"Light", "Heavy", "Wakeup", "Travel", "Office", "Workout", "Dance", "Social", "Sex"}
	return keywords
end getMORKeywordsList


-- read the configuration values from the config state file
on readConfigFromFile(conf)
	set macpathstr to getMacConfigFilePath()
	try
		set AppleScript's text item delimiters to ": "
		set confile to (open for access macpathstr)
		set fileContents to (read confile for (get eof confile))
		set fileLines to paragraphs of fileContents
		repeat with currLine in fileLines
			if (currLine starts with "username: ") then
				set username of conf to text item 2 of currLine
			end if
			if (currLine starts with "token: ") then
				set token of conf to text item 2 of currLine
			end if
			if (currLine starts with "penid: ") then
				set penid of conf to text item 2 of currLine
			end if
			if (currLine starts with "pullsince: ") then
				set pullsince of conf to text item 2 of currLine
			end if
		end repeat
	on error
		try
			close access confile
		end try
		-- most likely failure is that the file doesn't exist yet. continue.
	end try
end readConfigFromFile


-- write the configuration values back to the config state file
on writeConfigToFile(conf)
	set macpathstr to getMacConfigFilePath()
	set newline to "
"
	try
		set confile to (open for access macpathstr with write permission)
		set eof confile to 0
		write "username: " & (username of conf) & newline to confile
		write "token: " & (token of conf) & newline to confile
		write "penid: " & (penid of conf) & newline to confile
		write "pullsince: " & (pullsince of conf) & newline to confile
		close access confile
	on error
		try
			close access confile
		end try
		display dialog "Writing MyOpenReviews.txt failed."
		return false
	end try
end writeConfigToFile


-- if no username, ask for it and clear out dependent conf values
on verifyUsername(conf)
	if ((username of conf) is "") then
		set prompt to "Username to connect to MyOpenReviews?"
		set result to display dialog prompt default answer ""
		set username of conf to text returned of result
		set token of conf to ""
		set penid of conf to ""
	end if
end verifyUsername


-- fetch the pen names and return them, or the empty string
on fetchPenNames(conf)
	if ((token of conf) is "") then
		return ""
	end if
	set command to Â
		"curl \"http://www.myopenreviews.com/mypens?am=mid" & "&an=" & (username of conf) & "&at=" & (token of conf) & "&format=record\""
	set rdata to do shell script command
	return rdata
end fetchPenNames


on getAccessToken(conf)
	set prompt to "MyOpenReviews.com password for " & (username of conf) & "?"
	set result to display dialog prompt default answer "" with hidden answer
	set pass to text returned of result
	set pdat to "user=" & (username of conf) & "&pass=" & pass & "&format=record"
	set purl to "https://myopenreviews.appspot.com/login"
	set command to "curl --data \"" & pdat & "\" " & purl
	set rdata to do shell script command
	set AppleScript's text item delimiters to ": "
	set result to text item 2 of rdata
	return result
end getAccessToken


on getPenIDFromRecord(penrec)
	set AppleScript's text item delimiters to ", "
	set idrec to text item 1 of penrec
	set AppleScript's text item delimiters to ": "
	return text item 2 of idrec
end getPenIDFromRecord


on getPenNameFromRecord(penrec)
	set AppleScript's text item delimiters to ", "
	set namerec to text item 2 of penrec
	set AppleScript's text item delimiters to ": "
	return text item 2 of namerec
end getPenNameFromRecord


-- verify a pen ID is specified, prompting if necessary.  If assumePen is
-- true then use the existing specified pen ID, otherwise prompt to confirm.
on verifyPenID(pendata, conf, assumePen)
	if assumePen then
		set found to ""
		if ((penid of conf) is not "") then
			set penrecs to paragraphs of pendata
			repeat with penrec in penrecs
				set optpenid to getPenIDFromRecord(penrec)
				if ((penid of conf) is equal to optpenid) then
					set found to optpenid
				end if
			end repeat
		end if
		if found is not equal to "" then
			return found
		end if
	end if
	set penid of conf to ""
	set penrecs to paragraphs of pendata
	repeat while penid of conf is ""
		repeat with penrec in penrecs
			set prompt to "Use pen name " & getPenNameFromRecord(penrec) & "?"
			set result to display dialog prompt buttons {"No", "Yes"} default button 2
			set answer to button returned of result
			if answer is equal to "Yes" then
				set penid of conf to getPenIDFromRecord(penrec)
				return penid of conf
			end if
		end repeat
		if penid of conf is "" then
			display dialog "You must choose a pen name to connect with."
		end if
	end repeat
end verifyPenID


on verifyTokenAndPen(conf, assumePen)
	set pendata to fetchPenNames(conf)
	if ((pendata is "") or (pendata starts with "Authentication failed")) then
		set logintoken to getAccessToken(conf)
		set token of conf to logintoken
	end if
	set pendata to fetchPenNames(conf)
	verifyPenID(pendata, conf, assumePen)
end verifyTokenAndPen


-- verify we have appropriate config and access to MyOpenReviews
on verifyAccess(assumePen)
	set conf to {username:"", token:"", penid:"", pullsince:"", pens:""}
	set pullsince of conf to "2000-01-01T00:00:00Z"
	readConfigFromFile(conf)
	verifyUsername(conf)
	verifyTokenAndPen(conf, assumePen)
	writeConfigToFile(conf)
	return conf
end verifyAccess


-- read the tcmt of tdata, and set selkeys, comtxt fields of tdata
on parseTrackComment(tdata)
	set rawtxt to (tcmt of tdata)
	set keytxt to ""
	if (rawtxt starts with "[") then
		set AppleScript's text item delimiters to "]"
		set keytxt to ((text item 1 of rawtxt) & "]")
		set comtxt of tdata to text item 2 of rawtxt
	else
		set keytxt to "[]"
		set comtxt of tdata to rawtxt
	end if
	-- strip the leading space off the comment as needed
	if ((comtxt of tdata) starts with " ") then
		set tmptxt to comtxt of tdata
		if (length of tmptxt ² 1) then
			set tmptxt to ""
		else
			set tmptxt to (text 2 thru (length of tmptxt) of tmptxt)
		end if
		set comtxt of tdata to tmptxt
	end if
	-- strip the brackets off the keytxt
	if length of keytxt > 2 then
		set keytxt to (text 2 thru ((length of keytxt) - 1) of keytxt)
	else
		set keytxt to ""
	end if
	set AppleScript's text item delimiters to "," -- just commas
	set selkeys of tdata to keytxt's text items
	return true
end parseTrackComment


on listValsToCSV(listvals)
	set csvtxt to ""
	if (count listvals) > 0 then
		repeat with listval in listvals
			if csvtxt is not equal to "" then
				set csvtxt to csvtxt & "," -- no spaces in CSV
			end if
			set csvtxt to csvtxt & listval
		end repeat
	end if
	return csvtxt
end listValsToCSV


-- return the full comment text from the selkeys and comtxt fields of tdata
on rebuildTrackComment(tdata)
	set rawtxt to listValsToCSV(selkeys of tdata)
	if rawtxt is not equal to "" then
		set rawtxt to "[" & rawtxt & "] " -- trailing space to separate comment
	end if
	set rawtxt to (rawtxt & (comtxt of tdata))
	return rawtxt
end rebuildTrackComment

