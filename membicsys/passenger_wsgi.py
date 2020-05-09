import sys, os
INTERP = "/home/theriex/membic.org/venv/bin/python"
if sys.executable != INTERP:
    # According to Dreamhost docs, INTERP is present twice so that the new
    # Python interpreter knows the actual executable path
    os.execl(INTERP, INTERP, *sys.argv)
sys.path.append(os.getcwd())
from main import app as application
