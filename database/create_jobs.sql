BEGIN
  DBMS_SCHEDULER.CREATE_JOB (
    job_name        => 'JOB_POPULATE_DAILY_SUMMARIES',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN
                          DBMS_OUTPUT.PUT_LINE(''Scheduler job JOB_POPULATE_DAILY_SUMMARIES starting at '' || TO_CHAR(SYSTIMESTAMP, ''YYYY-MM-DD HH24:MI:SS.FF''));
                          POPULATE_GAME_TYPE_DAILY_SUMMARY(TRUNC(SYSDATE - 1));
                          POPULATE_PLATFORM_DAILY_SUMMARY(TRUNC(SYSDATE - 1));
                          DBMS_OUTPUT.PUT_LINE(''Scheduler job JOB_POPULATE_DAILY_SUMMARIES finished at '' || TO_CHAR(SYSTIMESTAMP, ''YYYY-MM-DD HH24:MI:SS.FF''));
                        END;',
    start_date      => TRUNC(SYSDATE) + INTERVAL '1' DAY + INTERVAL '1' HOUR,
    repeat_interval => 'FREQ=DAILY; BYHOUR=1; BYMINUTE=0; BYSECOND=0;',       -- Run daily at 1:00 AM
    enabled         => TRUE,
    comments        => 'Populates daily summary tables (GameTypeDailySummary and PlatformDailySummary) for the previous day.'
  );
  DBMS_OUTPUT.PUT_LINE('Job JOB_POPULATE_DAILY_SUMMARIES created.');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -27477 THEN -- ORA-27477: "JOB_NAME" already exists
      DBMS_OUTPUT.PUT_LINE('Job JOB_POPULATE_DAILY_SUMMARIES already exists.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('Error creating job: ' || SQLERRM);
      RAISE;
    END IF;
END;
/