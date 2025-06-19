SET SERVEROUTPUT ON;
-- -----------------------------------------------------------------------------
-- Procedure: POPULATE_GAME_TYPE_DAILY_SUMMARY
-- Description: Populates or updates daily summary statistics for each game type.
-- Parameters:
--   p_summary_date: The date for which to generate the summary.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE POPULATE_GAME_TYPE_DAILY_SUMMARY (
    p_summary_date IN DATE
)
IS
    v_summary_date_trunc DATE := TRUNC(p_summary_date);
BEGIN
    DBMS_OUTPUT.PUT_LINE('Starting POPULATE_GAME_TYPE_DAILY_SUMMARY for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD'));

    MERGE INTO GAME_TYPE_DAILY_SUMMARY gtds
    USING (
        SELECT
            gt.GameTypeID,
            v_summary_date_trunc AS SummaryDate,
            COUNT(m.MatchID) AS MatchesPlayedCount,
            COUNT(DISTINCT p.PlayerID) AS UniquePlayerCount,
            NVL(SUM(m.EntryFee), 0) AS TotalEntryFeesCollected,
            NVL(SUM(
                (SELECT NVL(SUM(t.Amount),0)
                   FROM TRANSACTIONS t
                  WHERE t.MatchID = m.MatchID
                    AND t.TransactionType = 'PAYOUT_WINNER'
                    AND t.Status = 'COMPLETED'
                    AND TRUNC(t.Timestamp) = v_summary_date_trunc)
            ), 0) AS TotalPayoutsMade,
            ROUND(NVL(AVG( (m.EndTime - m.StartTime) * 24 * 60 * 60 ), 0)) AS AverageMatchDurationSeconds
        FROM
            MATCHES m
        JOIN
            GAME_TYPES gt ON m.GameTypeID = gt.GameTypeID
        CROSS JOIN LATERAL (
            SELECT m.Player1ID AS PlayerID FROM DUAL WHERE m.Player1ID IS NOT NULL
            UNION ALL
            SELECT m.Player2ID AS PlayerID FROM DUAL WHERE m.Player2ID IS NOT NULL
        ) p
        WHERE
            TRUNC(m.EndTime) = v_summary_date_trunc -- Matches completed on this day
            AND m.MatchState = 'COMPLETED'
        GROUP BY
            gt.GameTypeID, v_summary_date_trunc
    ) source_data
    ON (gtds.GameTypeID = source_data.GameTypeID AND gtds.SummaryDate = source_data.SummaryDate)
    WHEN MATCHED THEN
        UPDATE SET
            MatchesPlayedCount          = source_data.MatchesPlayedCount,
            UniquePlayerCount           = source_data.UniquePlayerCount,
            TotalEntryFeesCollected     = source_data.TotalEntryFeesCollected,
            TotalPayoutsMade            = source_data.TotalPayoutsMade,
            AverageMatchDurationSeconds = source_data.AverageMatchDurationSeconds
    WHEN NOT MATCHED THEN
        INSERT (
            SummaryID, GameTypeID, SummaryDate, MatchesPlayedCount,
            UniquePlayerCount, TotalEntryFeesCollected, TotalPayoutsMade,
            AverageMatchDurationSeconds
        ) VALUES (
            SEQ_GAME_TYPE_SUMMARY_ID.NEXTVAL,
            source_data.GameTypeID, source_data.SummaryDate, source_data.MatchesPlayedCount,
            source_data.UniquePlayerCount, source_data.TotalEntryFeesCollected,
            source_data.TotalPayoutsMade, source_data.AverageMatchDurationSeconds
        );

    DBMS_OUTPUT.PUT_LINE('POPULATE_GAME_TYPE_DAILY_SUMMARY: ' || SQL%ROWCOUNT || ' rows merged for GameTypeDailySummary.');
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('POPULATE_GAME_TYPE_DAILY_SUMMARY completed for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD'));
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error in POPULATE_GAME_TYPE_DAILY_SUMMARY for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD') || ': ' || SQLERRM);
        ROLLBACK;
        RAISE;
END POPULATE_GAME_TYPE_DAILY_SUMMARY;
/

-- -----------------------------------------------------------------------------
-- Procedure: POPULATE_PLATFORM_DAILY_SUMMARY
-- Description: Populates or updates daily summary statistics for the entire platform.
-- Parameters:
--   p_summary_date: The date for which to generate the summary.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE POPULATE_PLATFORM_DAILY_SUMMARY (
    p_summary_date IN DATE
)
IS
    v_summary_date_trunc DATE := TRUNC(p_summary_date);
    v_new_users_count NUMBER;
    v_active_users_count NUMBER;
    v_total_matches_played NUMBER;
    v_total_transaction_volume NUMBER;
    v_net_revenue NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('Starting POPULATE_PLATFORM_DAILY_SUMMARY for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD'));

    -- 1. New Users Count
    SELECT COUNT(UserID)
    INTO v_new_users_count
    FROM USERS
    WHERE TRUNC(CreatedAt) = v_summary_date_trunc;
    DBMS_OUTPUT.PUT_LINE('New Users Count: ' || v_new_users_count);

    -- 2. Total Matches Played
    SELECT COUNT(MatchID)
    INTO v_total_matches_played
    FROM MATCHES
    WHERE TRUNC(EndTime) = v_summary_date_trunc
      AND MatchState = 'COMPLETED';
    DBMS_OUTPUT.PUT_LINE('Total Matches Played: ' || v_total_matches_played);

    -- 3. Active Users Count (Users who played a match or made a transaction on that day)
    SELECT COUNT(DISTINCT UserID)
    INTO v_active_users_count
    FROM (
        SELECT Player1ID AS UserID FROM MATCHES WHERE TRUNC(EndTime) = v_summary_date_trunc AND MatchState = 'COMPLETED' AND Player1ID IS NOT NULL
        UNION -- Using UNION for distinctness implicitly before COUNT(DISTINCT)
        SELECT Player2ID AS UserID FROM MATCHES WHERE TRUNC(EndTime) = v_summary_date_trunc AND MatchState = 'COMPLETED' AND Player2ID IS NOT NULL
        UNION
        SELECT UserID FROM TRANSACTIONS WHERE TRUNC(Timestamp) = v_summary_date_trunc AND Status = 'COMPLETED' AND UserID IS NOT NULL
    ) active_users_subquery;
    DBMS_OUTPUT.PUT_LINE('Active Users Count: ' || v_active_users_count);

    -- 4. Total Transaction Volume (Sum of absolute transaction amounts)
    SELECT NVL(SUM(ABS(Amount)), 0)
    INTO v_total_transaction_volume
    FROM TRANSACTIONS
    WHERE TRUNC(Timestamp) = v_summary_date_trunc
      AND Status = 'COMPLETED';
    DBMS_OUTPUT.PUT_LINE('Total Transaction Volume: ' || v_total_transaction_volume);

    SELECT NVL(SUM(
        CASE
            WHEN TransactionType = 'ENTRY_FEE' THEN Amount
            WHEN TransactionType = 'COMMISSION' THEN Amount
            WHEN TransactionType = 'PAYOUT_WINNER' THEN -ABS(Amount)
            ELSE 0
        END
    ), 0)
    INTO v_net_revenue
    FROM TRANSACTIONS
    WHERE TRUNC(Timestamp) = v_summary_date_trunc
      AND Status = 'COMPLETED';
    DBMS_OUTPUT.PUT_LINE('Net Revenue (from transactions): ' || v_net_revenue);

    MERGE INTO PLATFORM_DAILY_SUMMARY pds
    USING (
        SELECT
            v_summary_date_trunc AS SummaryDate,
            NVL(v_new_users_count, 0) AS NewUsersCount,
            NVL(v_active_users_count, 0) AS ActiveUsersCount,
            NVL(v_total_matches_played, 0) AS TotalMatchesPlayed,
            NVL(v_total_transaction_volume, 0) AS TotalTransactionVolume,
            NVL(v_net_revenue, 0) AS NetRevenue
        FROM DUAL
    ) source_data
    ON (pds.SummaryDate = source_data.SummaryDate)
    WHEN MATCHED THEN
        UPDATE SET
            NewUsersCount          = source_data.NewUsersCount,
            ActiveUsersCount       = source_data.ActiveUsersCount,
            TotalMatchesPlayed     = source_data.TotalMatchesPlayed,
            TotalTransactionVolume = source_data.TotalTransactionVolume,
            NetRevenue             = source_data.NetRevenue
    WHEN NOT MATCHED THEN
        INSERT (
            SummaryDate, NewUsersCount, ActiveUsersCount,
            TotalMatchesPlayed, TotalTransactionVolume, NetRevenue
        ) VALUES (
            source_data.SummaryDate, source_data.NewUsersCount, source_data.ActiveUsersCount,
            source_data.TotalMatchesPlayed, source_data.TotalTransactionVolume, source_data.NetRevenue
        );

    DBMS_OUTPUT.PUT_LINE('POPULATE_PLATFORM_DAILY_SUMMARY: ' || SQL%ROWCOUNT || ' rows merged for PlatformDailySummary.');
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('POPULATE_PLATFORM_DAILY_SUMMARY completed for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD'));
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error in POPULATE_PLATFORM_DAILY_SUMMARY for ' || TO_CHAR(v_summary_date_trunc, 'YYYY-MM-DD') || ': ' || SQLERRM);
        ROLLBACK;
        RAISE;
END POPULATE_PLATFORM_DAILY_SUMMARY;
/

-- Example manual execution for testing:
-- BEGIN
--   DBMS_OUTPUT.ENABLE(buffer_size => NULL); -- Unlimited buffer

--   -- Populate for yesterday
--   POPULATE_GAME_TYPE_DAILY_SUMMARY(TRUNC(SYSDATE - 1));
--   POPULATE_PLATFORM_DAILY_SUMMARY(TRUNC(SYSDATE - 1));
-- END;
-- /

-- -----------------------------------------------------------------------------
-- Function: GET_ACTIVE_USER_SESSIONS
-- Description: Returns a ref cursor with information about currently active
-- user sessions (where LogoutTimestamp is NULL).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION GET_ACTIVE_USER_SESSIONS (
    p_user_id IN NUMBER DEFAULT NULL
) RETURN SYS_REFCURSOR
IS
    v_ref_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_ref_cursor FOR
        SELECT
            ull.LoginLogID,
            ull.UserID,
            u.Username,
            ull.LoginTimestamp,
            ull.IPAddress,
            ull.UserAgent,
            -- Calculate current duration for active sessions
            ROUND((SYSTIMESTAMP - ull.LoginTimestamp) * 24 * 60 * 60) AS CurrentSessionDurationSeconds
        FROM
            USER_LOGIN_LOG ull
        JOIN
            USERS u ON ull.UserID = u.UserID
        WHERE
            ull.LogoutTimestamp IS NULL -- Key condition for active sessions
            AND (p_user_id IS NULL OR ull.UserID = p_user_id)
        ORDER BY
            ull.LoginTimestamp DESC;

    RETURN v_ref_cursor;
END GET_ACTIVE_USER_SESSIONS;
/

-- Example usage of the function:
-- DECLARE
--     l_cursor SYS_REFCURSOR;
--     l_log_id NUMBER;
--     l_user_id NUMBER;
--     l_username VARCHAR2(100);
--     l_login_ts TIMESTAMP;
--     l_ip_address VARCHAR2(45);
--     l_user_agent VARCHAR2(1000);
--     l_current_duration NUMBER;
-- BEGIN
--     -- Get all active sessions
--     l_cursor := GET_ACTIVE_USER_SESSIONS();
--     -- OR Get active sessions for a specific user:
--     -- l_cursor := GET_ACTIVE_USER_SESSIONS(p_user_id => 101);

--     LOOP
--         FETCH l_cursor INTO l_log_id, l_user_id, l_username, l_login_ts, l_ip_address, l_user_agent, l_current_duration;
--         EXIT WHEN l_cursor%NOTFOUND;
--         DBMS_OUTPUT.PUT_LINE(
--             'LogID: ' || l_log_id ||
--             ', User: ' || l_username || ' (ID: ' || l_user_id || ')' ||
--             ', Login: ' || TO_CHAR(l_login_ts, 'YYYY-MM-DD HH24:MI:SS') ||
--             ', IP: ' || l_ip_address ||
--             ', Duration (sec): ' || l_current_duration
--         );
--     END LOOP;
--     CLOSE l_cursor;
-- END;
-- /