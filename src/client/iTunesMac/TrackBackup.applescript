-- choose to backup (write) or restore (read) rating info from flat file

-- working data
property wdtitle : "WDYDFunBackup"
property wdaction : null
property wdfolder : null
property titledelim : "[WDYDFunTitle]"
property artistdelim : "[WDYDFunArtist]"
property albumdelim : "[WDYDFunAlbum]"
property ratingdelim : "[WDYDFunRating]"
property commentdelim : "[WDYDFunComment]"
property wdttl : 0
property newline : "
"

-- list sorting utility
on quickSort(theList)
	--public routine, called from your script
	script bs
		property alist : theList
		
		on Qsort(leftIndex, rightIndex)
			--private routine called by quickSort.
			--do not call from your script!
			if rightIndex > leftIndex then
				set pivot to ((rightIndex - leftIndex) div 2) + leftIndex
				set newPivot to Qpartition(leftIndex, rightIndex, pivot)
				set theList to Qsort(leftIndex, newPivot - 1)
				set theList to Qsort(newPivot + 1, rightIndex)
			end if
			
		end Qsort
		
		on Qpartition(leftIndex, rightIndex, pivot)
			--private routine called by quickSort.
			--do not call from your script!
			set pivotValue to item pivot of bs's alist
			set temp to item pivot of bs's alist
			set item pivot of bs's alist to item rightIndex of bs's alist
			set item rightIndex of bs's alist to temp
			set tempIndex to leftIndex
			repeat with pointer from leftIndex to (rightIndex - 1)
				if item pointer of bs's alist ² pivotValue then
					set temp to item pointer of bs's alist
					set item pointer of bs's alist to item tempIndex of bs's alist
					set item tempIndex of bs's alist to temp
					set tempIndex to tempIndex + 1
				end if
			end repeat
			set temp to item rightIndex of bs's alist
			set item rightIndex of bs's alist to item tempIndex of bs's alist
			set item tempIndex of bs's alist to temp
			
			return tempIndex
		end Qpartition
		
	end script
	
	if length of bs's alist > 1 then bs's Qsort(1, length of bs's alist)
	return bs's alist
end quickSort

-- choose backup (write) or restore (read)
on chooseDirection()
	set ptxt to "Do you want to Backup or Restore?"
	set cancelB to "Cancel"
	set backupB to "Backup"
	set restoreB to "Restore"
	set resp to display dialog ptxt buttons {cancelB, backupB, restoreB} default button 2 with title wdtitle
	if button returned of resp is equal to backupB then
		set wdaction to "write"
		return true
	end if
	if button returned of resp is equal to restoreB then
		set wdaction to "read"
		return true
	end if
	return false
end chooseDirection


-- choose the folder for the backup file.  File name is always the same.
on chooseFolder()
	set ptxt to "Folder to " & wdaction & " " & wdtitle & ".txt?"
	set wdfolder to choose folder with prompt ptxt
	if wdfolder is not null then
		return true
	end if
end chooseFolder


-- move existing export to .bak, write iTunes track rating info to .txt
on writeTracks()
	set fname to (wdfolder as text) & wdtitle & ".txt"
	set bname to wdtitle & ".bak"
	try
		-- read the tracks out of iTunes and sort them
		set tdatlist to {}
		set wdttl to 0
		set curriter to 0
		tell application "iTunes"
			set userVolume to sound volume
			repeat with ct in every track
				set wdttl to wdttl + 1
			end repeat
			repeat with ct in every track
				set curriter to curriter + 1
				set volset to ((curriter * 100) div wdttl)
				set sound volume to volset
				-- this data conversion step is what takes the most time
				set tdat to titledelim & (name of ct) & artistdelim & (artist of ct) & albumdelim & (album of ct) & ratingdelim & (rating of ct) & commentdelim & (comment of ct)
				copy tdat to end of tdatlist
			end repeat
		end tell
		tell application "iTunes" to set sound volume to 50
		set tdatlist to quickSort(tdatlist)
		-- if .txt exists, move it to .bak
		tell application "Finder"
			if exists fname then
				set bfullpath to (wdfolder as text) & bname
				if exists bfullpath then
					delete bfullpath
				end if
				set bf to file fname
				set name of bf to bname
			end if
		end tell
		-- write the track info to file
		set wf to open for access fname with write permission
		set eof wf to 0
		write ((ASCII character 239) & (ASCII character 187) & (ASCII character 191)) to wf starting at eof
		set curriter to 0
		repeat with tdat in tdatlist
			set curriter to curriter + 1
			set volset to ((curriter * 100) div wdttl)
			tell application "iTunes" to set sound volume to volset
			set otxt to tdat & newline
			write otxt to wf starting at eof as Çclass utf8È
		end repeat
		close access wf
		tell application "iTunes" to set sound volume to userVolume
	on error errStr number errorNumber
		try
			close access wf
		end try
		error errStr number errorNumber
		return false
	end try
end writeTracks


on compareLines(line1, line2)
	if line1 does not contain ratingdelim then
		return 1
	end if
	if line2 does not contain ratingdelim then
		return -1
	end if
	set comp1 to text 1 thru (offset of ratingdelim in line1) of line1
	set comp2 to text 1 thru (offset of ratingdelim in line2) of line2
	if comp1 is less than comp2 then
		return -1
	end if
	if comp1 is greater than comp2 then
		return 1
	end if
	return 0
end compareLines


-- sort export data and merge with .bak (if available)
on mergePrev()
	set fname to (wdfolder as text) & wdtitle & ".txt"
	set bfname to (wdfolder as text) & wdtitle & ".bak"
	set mfname to (wdfolder as text) & wdtitle & ".mrg"
	tell application "Finder"
		if not (exists bfname) then
			return true
		end if
		if exists mfname then
			delete mfname
		end if
		set tf to file fname
		set name of tf to (wdtitle & ".mrg")
	end tell
	-- .bak exists, merge that and .mrg into .txt
	try
		set wf to open for access fname with write permission
		set eof wf to 0
		write ((ASCII character 239) & (ASCII character 187) & (ASCII character 191)) to wf starting at eof
		set rf to open for access mfname
		set readflag to true
		repeat while readflag
			set otxt to read rf until newline
			-- display dialog otxt
			write otxt to wf starting at eof as Çclass utf8È
			if otxt does not contain titledelim then
				set readflag to false
			end if
		end repeat
		close access wf
	on error errStr number errorNumber
		try
			close access wf
		end try
		error errStr number errorNumber
		return false
	end try
end mergePrev


-- read rating info from file into iTunes, overwriting iTunes
on restoreRatings()
	display dialog "Not implemented yet"
end restoreRatings


-- Main script
display dialog "This script has been abandoned because it is not possible to read the backup file back in.  It gets truncated.  Leaving it around in case it is useful for later experimentation"
if chooseDirection() and chooseFolder() then
	if wdaction is "write" then
		display dialog "This can take a while, watch the iTunes volume for progress." with title wdtitle
		-- writeTracks()
		mergePrev()
		display dialog "Track rating data backed up to " & wdtitle & ".txt"
	else
		restoreRatings()
	end if
end if
