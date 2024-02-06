#!USERHOME/membic.org/venv/bin/python3
# server -rwxr-xr-x: chmod 755
from wsgiref.handlers import CGIHandler
import sys
import os
sys.path.append("..")
sys.path.append("../py")
from main import app
CGIHandler().run(app)
