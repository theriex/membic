Various directories used to verify minimum Dreamhost setups.

[server]$ cd ~/epinova.work
[server]$ source venv/bin/activate   # activate virtual environment
[server]$ deactivate                 # deactivate virtual environment
[server]$ touch tmp/restart.txt      # tell the WSGI server to restart

Rename index.html to whatever.html, restart, reload -> python start page
dra: Dynamic Root, API
rsync --rsh="ssh -l theriex" /general/membic/ref/dreamhost/dra/ -zvrtC theriex@theriex.com:/home/theriex/epinova.work
