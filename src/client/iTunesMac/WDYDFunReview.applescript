-- prompt for rating, keywords, additional text, save to comment field
property wdtitle : "WDYDFunReview"
property funkeys : {"Light", "Heavy", "Wakeup", "Travel", "Office", "Workout", "Dance", "Sex", "Social", "Dining", "Attention"}
property idata : {tref:null, tname:"", trat:0, tcmt:""}
property tdata : null
property selkeys : null
property newline : "
"

on readColonFieldVal(pfname, ptxt, pdefault)
	set pfcolname to pfname & ":"
	set idx to offset of pfcolname in ptxt
	if idx < 1 then
		return pdefault
	end if
	set ptxt to text (idx + (length of pfcolname)) thru (length of ptxt) of ptxt
	set idx to 0
	set loopflag to true
	repeat while loopflag
		if idx is equal to (length of ptxt) then
			exit repeat
		end if
		set idx to idx + 1
		try
			set currchar to text idx thru idx of ptxt
			set numchar to currchar as number
		on error
			set idx to idx - 1
			set loopflag to false
		end try
	end repeat
	set retval to (text 1 thru idx of ptxt)
	return retval
end readColonFieldVal


on parseTrackData(comment)
	script ptd
		-- unrated tracks have rating 0.  
		-- field names chosen to not conflict with iTunes
		property tdata : {ptdrat:0, ptdfreq:0, ptdkeys:"", ptdcmt:""}
		on parseTrack(comment)
			set cmt to comment
			-- display dialog "cmt: " & cmt
			if cmt starts with "[rating:" then
				set idx to offset of "]" in cmt
				set (ptdrat of tdata) to readColonFieldVal("rating", cmt, 0)
				set (ptdfreq of tdata) to readColonFieldVal("freq", cmt, 2)
				set cmt to text (idx + 1) thru (length of cmt) of cmt
			end if
			if cmt starts with "[" then
				set idx to offset of "]" in cmt
				set ptdkeys of tdata to (text 2 thru (idx - 1) of cmt)
				if (length of cmt) is greater than (idx + 1) then
					set cmt to text (idx + 1) thru (length of cmt) of cmt
				else
					set cmt to ""
				end if
			end if
			if cmt is equal to " " then
				set cmt to ""
			end if
			if cmt starts with " " then
				set cmt to text 2 thru (length of cmt) of cmt
			end if
			set ptdcmt of tdata to cmt
		end parseTrack
	end script
	ptd's parseTrack(comment)
	return ptd's tdata
end parseTrackData


on assembleTrackData(tdata)
	return "[rating:" & (ptdrat of tdata) & ",freq:" & (ptdfreq of tdata) & "][" & (ptdkeys of tdata) & "] " & (ptdcmt of tdata)
end assembleTrackData


-- note the track we will be working with. The player may move to the next
-- song while the script is running, so set the tref and work with that
on getCurrentTrackInfo()
	tell application "iTunes"
		if not (exists current track) then
			return false
		end if
		set tref of idata to current track
		set tname of idata to (get name of (tref of idata))
		set trat of idata to (get rating of (tref of idata))
		set tcmt of idata to (get comment of (tref of idata))
	end tell
	return true
end getCurrentTrackInfo


on promptForKeys()
	set ptxt to "Choose keywords that describe \"" & (tname of idata) & "\""
	set listchoice to choose from list funkeys with prompt ptxt default items selkeys with title wdtitle with multiple selections allowed and empty selection allowed
	if listchoice is false then
		return false
	end if
	set selkeys to listchoice
	return true
end promptForKeys


on promptForComment()
	set ptxt to "Additional comment for \"" & (tname of idata) & "\""
	set dlgresult to display dialog ptxt default answer (ptdcmt of tdata)
	set ptdcmt of tdata to text returned of dlgresult
	return true
end promptForComment


on promptForRating()
	--     100,    90-99,   80-89,   70-79,  60-69,  50-59, 40-49, 30-39, 20-29, 10-19, 0-9
	set levels to {"★★★★★", "★★★★½", "★★★★", "★★★½", "★★★", "★★½", "★★", "★½", "★", "½"}
	set ratidx to (11 - ((trat of idata) div 10))
	if ratidx > 10 then
		set ratidx to 10
	end if
	-- default any unrated items to 3 stars.  Average is better than zero.
	if ((trat of idata) is missing value) then
		set ratidx to 60
	end if
	if (tname of idata) is not equal to "" then
		set ptxt to "Rate \"" & (tname of idata) & "\""
		set dlgtitle to wdtitle
	else
		set ptxt to "Minimum rating for tracks in playlist"
		set dlgtitle to "WDYDFunList"
	end if
	set listchoice to choose from list levels with prompt ptxt default items {(item ratidx of levels)} with title dlgtitle
	if listchoice is not false then
		set seltxt to item 1 of listchoice
		set ratidx to 0
		repeat with levtxt in levels
			set ratidx to (ratidx + 1)
			if ((levtxt as text) is equal to (seltxt as text)) then
				exit repeat
			end if
		end repeat
	end if
	set trat of idata to ((11 - ratidx) * 10)
	return true
end promptForRating


on promptForFrequency()
	set freqkeys to {"daily", "2 days", "3 days", "weekly", "monthly", "quarterly", "yearly", "never"}
	set freqdays to {1, 2, 3, 7, 30, 90, 365, 0}
	set ptxt to "How often should " & (tname of idata) & " be selected?"
	set seltxt to item 1 of freqkeys
	set selidx to 1
	repeat with freqday in freqdays
		if ((ptdfreq of tdata) as number) is equal to (freqday as number) then
			set seltxt to item selidx of freqkeys
			exit repeat
		end if
		set selidx to selidx + 1
	end repeat
	set listchoice to choose from list freqkeys with prompt ptxt default items {seltxt} with title wdtitle
	if listchoice is not false then
		set seltxt to item 1 of listchoice
		set freqidx to 1
		repeat with freqkey in freqkeys
			if (seltxt as text) is equal to (freqkey as text) then
				set (ptdfreq of tdata) to item freqidx of freqdays
				exit repeat
			end if
			set freqidx to freqidx + 1
		end repeat
	end if
	return true
end promptForFrequency


on updateTrackInfo()
	set (ptdrat of tdata) to (trat of idata)
	set prevDelimiter to AppleScript's text item delimiters
	set AppleScript's text item delimiters to ","
	set (ptdkeys of tdata) to selkeys as text
	set AppleScript's text item delimiters to prevDelimiter
	set comtxt to assembleTrackData(tdata)
	tell application "iTunes"
		set comment of (tref of idata) to comtxt
		set rating of (tref of idata) to (trat of idata)
	end tell
end updateTrackInfo


-- Main script
if getCurrentTrackInfo() then
	set tdata to parseTrackData(tcmt of idata)
	set AppleScript's text item delimiters to ","
	set selkeys to (ptdkeys of tdata)'s text items
	if promptForKeys() and promptForComment() and promptForRating() and promptForFrequency() then
		updateTrackInfo()
	end if
end if
