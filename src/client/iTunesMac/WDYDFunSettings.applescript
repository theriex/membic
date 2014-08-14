property wdtitle : "WDYDFunSettings"
property wdconf : null
property revscript : null
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
	set defconf to {username:"", token:"", pname:"", penid:"", defreq:7, toff:0, plists:defplists}
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


on resetLoginInfo()
	set username of wdconf to ""
	set token of wdconf to ""
	set pname of wdconf to ""
	set penid of wdconf to ""
end resetLoginInfo


on verifyUsername()
	if (username of wdconf) is equal to "" then
		set ptxt to "Username to connect to WDYDFun.com?"
		set dlgres to display dialog ptxt default answer ""
		resetLoginInfo()
		set username of wdconf to text returned of dlgres
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


on verifyTokenAndPen(errdetail)
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
		display dialog "Pen name verification failed. " & errdetail
		return false
	end if
	return true
end verifyTokenAndPen


on verifyServerAccess(errdetail)
	verifyUsername()
	set tokenAndPenVerified to false
	try
		set tokenAndPenVerified to verifyTokenAndPen(errdetail)
	end try
	if not tokenAndPenVerified then
		return false
	end if
	-- display dialog "username: " & (username of wdconf) & ", penid: " & (penid of wdconf) & ", token: " & (token of wdconf)
	writeConfig()
	return true
end verifyServerAccess


on verifyDefaultFrequency()
	set ptxt to "Default track suggestion frequency?"
	set seltxt to item 1 of revscript's freqkeys
	set selidx to 1
	repeat with freqday in revscript's freqdays
		if (defreq of wdconf) is equal to (freqday as number) then
			set seltxt to item selidx of revscript's freqkeys
			exit repeat
		end if
		set selidx to selidx + 1
	end repeat
	set listchoice to choose from list (revscript's freqkeys) with prompt ptxt default items {seltxt} with title wdtitle
	if listchoice is not false then
		set seltxt to item 1 of listchoice
		set freqidx to 1
		repeat with freqkey in revscript's freqkeys
			if (seltxt as text) is equal to (freqkey as text) then
				set defreq of wdconf to item freqidx of revscript's freqdays
				exit repeat
			end if
			set freqidx to freqidx + 1
		end repeat
	end if
	writeConfig()
	return true
end verifyDefaultFrequency


on describeConfig()
	set fname to getConfigFileMacName()
	loadConfig()
	try
		set confprompt to "Settings file: " & fname & newline & "username: " & (username of wdconf) & newline & "pen name: " & (pname of wdconf) & newline & "pen id: " & (penid of wdconf) & newline & "token: " & (token of wdconf) & newline & newline & "Rebuild settings?"
		set doconf to display dialog confprompt buttons {"No", "Yes"} default button 1 with title wdtitle
		if button returned of result is equal to "Yes" then
			resetLoginInfo()
			verifyServerAccess("")
		end if
	on error
		set wdconf to defaultConfig()
		writeConfig()
		verifyServerAccess("")
	end try
	set revscript to loadScript("WDYDFunReview")
	verifyDefaultFrequency()
end describeConfig


-- Main script
describeConfig()
