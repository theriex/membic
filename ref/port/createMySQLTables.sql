CREATE TABLE MUser (  -- Membic User account.
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
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
  coops LONGTEXT,
  created VARCHAR(256),
  modified VARCHAR(256),
  lastwrite VARCHAR(256),
  preb LONGTEXT,
  PRIMARY KEY (id)
);

CREATE TABLE Theme (  -- A cooperative theme.
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  importid BIGINT UNIQUE,
  name VARCHAR(256) NOT NULL,
  name_c VARCHAR(256) NOT NULL UNIQUE,
  modhist VARCHAR(256),
  modified VARCHAR(256),
  lastwrite VARCHAR(256),
  hashtag VARCHAR(256) UNIQUE,
  description LONGTEXT,
  picture LONGBLOB,
  founders LONGTEXT,
  moderators LONGTEXT,
  members LONGTEXT,
  seeking LONGTEXT,
  rejects LONGTEXT,
  adminlog LONGTEXT,
  people LONGTEXT,
  cliset LONGTEXT,
  keywords LONGTEXT,
  preb LONGTEXT,
  PRIMARY KEY (id)
);

CREATE TABLE Membic (  -- A URL with a reason why it's memorable.
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  importid BIGINT UNIQUE,
  revtype VARCHAR(256) NOT NULL,
  penid BIGINT NOT NULL,
  ctmid BIGINT NOT NULL,
  rating INT NOT NULL,
  srcrev BIGINT NOT NULL,
  cankey VARCHAR(256) NOT NULL,
  modified VARCHAR(256),
  modhist VARCHAR(256),
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
  name VARCHAR(256),
  title VARCHAR(256),
  url LONGTEXT,
  rurl LONGTEXT,
  artist VARCHAR(256),
  author VARCHAR(256),
  publisher VARCHAR(256),
  album VARCHAR(256),
  starring VARCHAR(256),
  address VARCHAR(256),
  year VARCHAR(256),
  INDEX (ctmid, modified DESC),
  INDEX (ctmid, penid, modified DESC),
  PRIMARY KEY (id)
);

CREATE TABLE Overflow (  -- extra preb membics
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  dbkind VARCHAR(256) NOT NULL,
  dbkeyid BIGINT NOT NULL,
  overcount INT NOT NULL,
  preb LONGTEXT,
  PRIMARY KEY (id)
);

CREATE TABLE MailNotice (  -- Broadcast email tracking
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  name VARCHAR(256) NOT NULL UNIQUE,
  subject VARCHAR(256),
  uidcsv LONGTEXT,
  lastupd VARCHAR(256),
  PRIMARY KEY (id)
);

CREATE TABLE ActivitySummary (  -- Stats by profile/theme
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  refp VARCHAR(256) NOT NULL UNIQUE,
  tstart VARCHAR(256) NOT NULL,
  tuntil VARCHAR(256) NOT NULL,
  reqbyid INT NOT NULL,
  reqbyht INT NOT NULL,
  reqbypm INT NOT NULL,
  reqbyrs INT NOT NULL,
  reqdets LONGTEXT,
  created INT NOT NULL,
  edited INT NOT NULL,
  removed INT NOT NULL,
  INDEX (refp, tuntil DESC),
  PRIMARY KEY (id)
);

CREATE TABLE ConnectionService (  -- Supporting service auth
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  name VARCHAR(256) NOT NULL UNIQUE,
  ckey VARCHAR(256),
  secret VARCHAR(256),
  data LONGTEXT,
  PRIMARY KEY (id)
);

