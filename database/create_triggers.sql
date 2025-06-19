CREATE OR REPLACE TRIGGER TRG_MATCHES_BI
 BEFORE INSERT ON MATCHES
 FOR EACH ROW
BEGIN
 IF :NEW.MATCHID IS NULL THEN
   SELECT MATCHES_MATCHID_SEQ.NEXTVAL
     INTO :NEW.MATCHID
   FROM DUAL;
 END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_USER_LOGIN_LOG_DURATION
BEFORE UPDATE OF LogoutTimestamp ON USER_LOGIN_LOG
FOR EACH ROW
WHEN (NEW.LogoutTimestamp IS NOT NULL AND OLD.LogoutTimestamp IS NULL AND NEW.LoginTimestamp IS NOT NULL)
DECLARE
    v_duration_seconds NUMBER;
BEGIN
    v_duration_seconds := ROUND((NEW.LogoutTimestamp - NEW.LoginTimestamp) * 24 * 60 * 60);

    IF v_duration_seconds < 0 THEN
        v_duration_seconds := 0;
    END IF;

    :NEW.SessionDurationSeconds := v_duration_seconds;

EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error in TRG_USER_LOGIN_LOG_DURATION for LoginLogID ' || :NEW.LoginLogID || ': ' || SQLERRM);
END TRG_USER_LOGIN_LOG_DURATION;
/

CREATE OR REPLACE TRIGGER TRG_BALANCE_STATE_LOG
AFTER UPDATE OF BALANCE ON WALLETS
FOR EACH ROW
WHEN (NEW.BALANCE <> OLD.BALANCE)
DECLARE
   v_operation_amount NUMBER(10, 2);
BEGIN
   v_operation_amount := :NEW.BALANCE - :OLD.BALANCE;
   INSERT INTO BalanceState (
       UserID,
       Operation,
       FinalBalance,
       BalanceStateTimestamp
   ) VALUES (
       :NEW.USERID,
       v_operation_amount,
       :NEW.BALANCE,
       SYSTIMESTAMP
   );
END TRG_BALANCE_STATE_LOG;
/