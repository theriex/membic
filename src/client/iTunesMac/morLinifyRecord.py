import sys, urllib
recordstr = sys.argv[1]
elems = recordstr.split(", ")
for elem in elems:
    attrval = elem.split(": ", 1)
    print urllib.unquote(attrval[1])
