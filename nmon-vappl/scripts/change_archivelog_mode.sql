set echo on
set feedback on
set lines 136
set pages 1000
set timing on

spool change_archivelog_mode.log

conn / as sysdba

SHUTDOWN immediate
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
ALTER SYSTEM SET DB_RECOVERY_FILE_DEST_SIZE = 100G;