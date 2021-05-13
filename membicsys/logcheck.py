""" Check the application log for errors. """
#pylint: disable=wrong-import-position
#pylint: disable=wrong-import-order
#pylint: disable=missing-function-docstring
#pylint: disable=invalid-name
import datetime
import os.path
import py.mconf as mconf
import logging
import logging.handlers
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s %(module)s %(asctime)s %(message)s',
    handlers=[logging.handlers.TimedRotatingFileHandler(
        mconf.logsdir + "plg_logcheck.log", when='D', backupCount=10)])
import py.util as util

# Matches the cron job timing setup
TIMEWINDOW = datetime.timedelta(minutes=-60)


def mail_error_notice(txt):
    util.send_mail(None, "Membic logcheck summary", txt,
                   domain=mconf.domain, sender="support")


def search_log_file(lfp, srchts):
    """ search the log file path filtering by the search timestamp prefix """
    if not os.path.isfile(lfp):
        txt = "Log file " + lfp + " not found.\n"
    else: # log file exists
        errors = ""
        warnings = ""
        lc = 0
        with open(lfp) as f:
            for line in f.readlines():
                if srchts in line:  # relevant log line
                    lc += 1
                    if "ERROR" in line:
                        errors += "  " + line
                    elif "WARNING" in line:
                        warnings += "  " + line
                elif lc > 0:  # processed at least one relevant log line
                    if line.startsWith("ValueError: "):
                        errors += "  " + line
        firstline = "Checked " + str(lc) + " lines from " + lfp + "\n"
        txt = firstline + errors + warnings
        if errors or warnings:
            mail_error_notice(txt)
    logging.info(txt)
    return txt


def check_log_file():
    """ figure out which log file and what the search timestamp prefix is """
    lfp = mconf.logsdir + "plg_application.log"   # main log file path
    toth = datetime.datetime.now().replace(microsecond=0, second=0, minute=0)
    if not toth.hour:  # hour zero, switch to rollover log file if it exists
        rls = (toth + datetime.timedelta(hours=-24)).strftime("%Y-%m-%d")
        if os.path.isfile(lfp + "." + rls):
            lfp = lfp + "." + rls  # rolled over log file path
    toth = toth + TIMEWINDOW  # now top of the previous hour
    srchts = toth.strftime("%Y-%m-%d %H:")
    return search_log_file(lfp, srchts)


check_log_file()
