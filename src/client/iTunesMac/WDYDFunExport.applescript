-- select a list, choose a directory to export to, then copy all the
-- files over with appropriate number prefixing to preserve order.
-- also provide an m3u file

-- working data
property wdtitle : "WDYDFunExport"
property wdlist : null
property wdfolder : null
property newline : "
"


-- choose the playlist to export
on chooseList()
	tell application "iTunes"
		set plnames to the name of every playlist whose special kind is none
	end tell
	set ptxt to "Playlist to export?"
	set listchoice to choose from list plnames with prompt ptxt with title wdtitle
	if listchoice is false then
		return false
	end if
	set listchoice to (item 1 of listchoice)
	tell application "iTunes"
		set wdlist to user playlist listchoice
	end tell
	return true
end chooseList


-- choose the folder to export the files to
on chooseFolder()
	set ptxt to "Folder to copy playlist files to?"
	set wdfolder to choose folder with prompt ptxt
	if wdfolder is not null then
		return true
	end if
end chooseFolder


-- if there are existing files in the folder, offer to clean them up first
on cleanExisting()
	tell application "Finder"
		set existFiles to every file of folder wdfolder
		set ttlfiles to (count of existFiles)
	end tell
	if ttlfiles > 0 then
		set cleanprompt to (POSIX path of wdfolder) & " contains " & ttlfiles & " files. Do you want to hard delete all folder contents before exporting?"
		set dodel to display dialog cleanprompt buttons {"No", "Yes"} default button 1 with title wdtitle
		if button returned of result is equal to "Yes" then
			-- delete all files the quick hard way with no crap left around
			set command to "rm -rf " & (POSIX path of wdfolder) & "*"
			do shell script command
		end if
	end if
end cleanExisting


-- copy the playlist files, renumbering as we go
on copyFiles()
	display dialog "Exporting source files from " & (name of wdlist) & " to " & (POSIX path of wdfolder) & ". Watch the iTunes volume knob for progress." with title wdtitle
	tell application "iTunes"
		set userVolume to sound volume
		set alltracks to every track of wdlist
		set curriter to 0
		set ttliter to (count of alltracks)
		repeat with currtrack in (every track of wdlist)
			set sound volume to ((curriter * 100) div ttliter)
			set curriter to (curriter + 1)
			set fsource to (location of currtrack)
			set renumbered to false
			tell application "Finder"
				set fdup to duplicate file fsource to wdfolder with replacing
				set pad to ""
				if curriter < 10 then
					set pad to "0"
				end if
				set fname to name of fdup
				set char1 to text 1 thru 1 of fname
				set char2 to text 2 thru 2 of fname
				set char3 to text 3 thru 3 of fname
				try
					set num1 to char1 as number
					set num2 to char2 as number
					if char3 is equal to " " or char3 is equal to "-" then
						set fcore to text 4 thru (length of fname) of fname
						set fname to pad & curriter & " " & fcore
						set name of fdup to fname
						set renumbered to true
					end if
				end try
				if not renumbered then
					set fname to pad & " " & fname
					set name of fdup to fname
				end if
			end tell
		end repeat
		set sound volume to userVolume
	end tell
end copyFiles


-- write the m3u fil for the playlist
on writeM3UFile()
	try
		set m3ufname to (wdfolder as Unicode text) & (name of wdlist) & ".m3u"
		set m3uf to open for access m3ufname with write permission
		set eof m3uf to 0
		write ((ASCII character 239) & (ASCII character 187) & (ASCII character 191)) to m3uf starting at eof
		set otxt to "# This is just a simple m3u list" & newline
		write otxt to m3uf starting at eof as Çclass utf8È
		tell application "Finder"
			set allfilenames to name of every file of entire contents of folder wdfolder
			repeat with fname in allfilenames
				if fname does not end with "m3u" then
					set otxt to fname & newline
					write otxt to m3uf starting at eof as Çclass utf8È
				end if
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
end writeM3UFile


-- Main script
if chooseList() and chooseFolder() then
	cleanExisting()
	copyFiles()
	writeM3UFile()
	set endnotice to "Playlist exported"
	display dialog endnotice with title wdtitle
end if

