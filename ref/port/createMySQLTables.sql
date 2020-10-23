CREATE TABLE MUser (  -- Membic User account.
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  importid BIGINT UNIQUE,
  email VARCHAR(256) NOT NULL UNIQUE,
  phash VARCHAR(256) NOT NULL,
  status VARCHAR(256),
  mailbounce VARCHAR(256),
  actsends LONGTEXT,
  actcode VARCHAR(256),
  altinmail VARCHAR(256) UNIQUE,
  name VARCHAR(256),
  aboutme LONGTEXT,
  hashtag VARCHAR(256) UNIQUE,
  profpic LONGBLOB,
  cliset LONGTEXT,
  perset LONGTEXT,
  themes LONGTEXT,
  lastwrite VARCHAR(256),
  preb LONGTEXT,
  PRIMARY KEY (dsId)
);
ALTER TABLE MUser AUTO_INCREMENT = 2020;

CREATE TABLE Theme (  -- A cooperative theme.
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  importid BIGINT UNIQUE,
  name VARCHAR(256) NOT NULL,
  name_c VARCHAR(256) NOT NULL UNIQUE,
  lastwrite VARCHAR(256),
  hashtag VARCHAR(256) UNIQUE,
  description LONGTEXT,
  picture LONGBLOB,
  founders LONGTEXT,
  moderators LONGTEXT,
  members LONGTEXT,
  people LONGTEXT,
  cliset LONGTEXT,
  keywords LONGTEXT,
  preb LONGTEXT,
  PRIMARY KEY (dsId)
);
ALTER TABLE Theme AUTO_INCREMENT = 2020;

CREATE TABLE AdminLog (  -- Administrative actions log.
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  letype VARCHAR(256) NOT NULL,
  leid BIGINT NOT NULL,
  adminid BIGINT NOT NULL,
  adminname VARCHAR(256),
  action VARCHAR(256) NOT NULL,
  target VARCHAR(256),
  targid BIGINT,
  targname VARCHAR(256),
  reason VARCHAR(256),
  PRIMARY KEY (dsId)
);
ALTER TABLE AdminLog AUTO_INCREMENT = 2020;

CREATE TABLE Membic (  -- A URL with a reason why it's memorable.
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  importid BIGINT UNIQUE,
  url LONGTEXT,
  rurl LONGTEXT,
  revtype VARCHAR(256) NOT NULL,
  details LONGTEXT,
  penid BIGINT NOT NULL,
  ctmid BIGINT NOT NULL,
  rating INT NOT NULL,
  srcrev BIGINT NOT NULL,
  cankey VARCHAR(256),
  text LONGTEXT,
  keywords LONGTEXT,
  svcdata LONGTEXT,
  revpic LONGBLOB,
  imguri LONGTEXT,
  icdata LONGBLOB,
  icwhen VARCHAR(256),
  dispafter VARCHAR(256),
  penname VARCHAR(256),
  reacdat LONGTEXT,
  INDEX (ctmid, modified DESC),
  INDEX (ctmid, penid, modified DESC),
  PRIMARY KEY (dsId)
);
ALTER TABLE Membic AUTO_INCREMENT = 2020;

CREATE TABLE Overflow (  -- extra preb membics
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  dbkind VARCHAR(256) NOT NULL,
  dbkeyid BIGINT NOT NULL,
  preb LONGTEXT,
  PRIMARY KEY (dsId)
);
ALTER TABLE Overflow AUTO_INCREMENT = 2020;

CREATE TABLE MailNotice (  -- Broadcast email tracking
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  name VARCHAR(256) NOT NULL UNIQUE,
  subject VARCHAR(256),
  uidcsv LONGTEXT,
  lastupd VARCHAR(256),
  PRIMARY KEY (dsId)
);
ALTER TABLE MailNotice AUTO_INCREMENT = 2020;

CREATE TABLE Audience (  -- Accumulated follower relationships
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  uid BIGINT NOT NULL,
  name VARCHAR(256),
  srctype VARCHAR(256),
  srcid BIGINT NOT NULL,
  lev INT,
  mech VARCHAR(256),
  blocked VARCHAR(256),
  INDEX (srctype, srcid),
  PRIMARY KEY (dsId)
);
ALTER TABLE Audience AUTO_INCREMENT = 2020;

CREATE TABLE ActivitySummary (  -- Stats by profile/theme
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  refp VARCHAR(256) NOT NULL UNIQUE,
  tstart VARCHAR(256) NOT NULL,
  tuntil VARCHAR(256) NOT NULL,
  reqbyid INT NOT NULL,
  reqbyht INT NOT NULL,
  reqbypm INT NOT NULL,
  reqbyrs INT NOT NULL,
  reqdets LONGTEXT,
  newmembics INT NOT NULL,
  edited INT NOT NULL,
  removed INT NOT NULL,
  INDEX (refp, tuntil DESC),
  PRIMARY KEY (dsId)
);
ALTER TABLE ActivitySummary AUTO_INCREMENT = 2020;

CREATE TABLE ConnectionService (  -- Supporting service auth
  dsId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  created VARCHAR(256) NOT NULL,
  modified VARCHAR(256) NOT NULL,
  name VARCHAR(256) NOT NULL UNIQUE,
  ckey VARCHAR(256),
  secret VARCHAR(256),
  data LONGTEXT,
  PRIMARY KEY (dsId)
);
ALTER TABLE ConnectionService AUTO_INCREMENT = 2020;

