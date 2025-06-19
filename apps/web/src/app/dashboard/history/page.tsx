"use client";
import { useEffect, useState, useCallback } from "react";
import styles from "./gamehistory.module.css";
import GameHistoryTable from "./components/Table";
import GameHistoryGraph from "./components/GameHistoryGraph";
import { useRouter } from "next/navigation";

interface MatchRecord {
  datetime: string;
  gameType: string;
  opponent: string;
  result: string;
  betAmount: number;
}

interface BalanceDataPoint {
  datetime: string;
  balance: number;
}

const ROWS_PER_PAGE = 5;
const USE_SAMPLE_GAME_HISTORY_GRAPH_DATA = false;

const generateSampleBalanceHistory = (days: number): BalanceDataPoint[] => {
  const data: BalanceDataPoint[] = [];
  let balance = 100;
  const now = new Date();
  for (let i = days; i > 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      date.setHours(
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 60)
      );
      balance += (Math.random() - 0.45) * 20;
      balance = Math.max(0, balance);
      data.push({
        datetime: date.toISOString(),
        balance: parseFloat(balance.toFixed(2)),
      });
    }
  }
  return data.sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );
};
const SAMPLE_BALANCE_HISTORY_DATA: BalanceDataPoint[] =
  generateSampleBalanceHistory(30);

const getBalanceHistory = async (): Promise<BalanceDataPoint[]> => {
  const res = await fetch(`/api/balance-states/history`, {
    credentials: "include",
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      "Failed to fetch balance history - Status:",
      res.status,
      "Body:",
      errorBody
    );
    throw new Error(`Failed to fetch balance history: ${res.status}`);
  }
  return await res.json();
};

export default function GameHistoryPage() {
  const router = useRouter();
  const [authCheckLoading, setAuthCheckLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    UserID: number;
    Username: string;
  } | null>(null);

  const [allUserMatches, setAllUserMatches] = useState<MatchRecord[]>([]);
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [initialTableLoading, setInitialTableLoading] = useState<boolean>(true);
  const [isPaginating, setIsPaginating] = useState<boolean>(false);

  const [activeView, setActiveView] = useState<"table" | "graph">("table");

  const [balanceHistory, setBalanceHistory] = useState<
    BalanceDataPoint[] | null
  >(null);
  const [graphLoading, setGraphLoading] = useState<boolean>(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  const fetchAndSetInitialGameHistoryForTable = useCallback(
    async (uid: number) => {
      setInitialTableLoading(true);
      try {
        const response = await fetch(`/api/matches/history?userId=${uid}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch game history");
        const data = await response.json();
        const transformedData = data.map((match: any) => ({
          datetime: new Date(match.StartTime).toLocaleString(),
          gameType: match.gameType?.gameName || "Unknown",
          opponent:
            match.PlayerOneID === uid
              ? match.playerTwo?.Username || "Player " + match.PlayerTwoID
              : match.playerOne?.Username || "Player " + match.PlayerOneID,
          result:
            match.WinnerID === uid ? "Win" : match.WinnerID ? "Loss" : "Draw",
          betAmount: match.EntryFee,
        }));
        setAllUserMatches(transformedData);
        setTotalRecords(transformedData.length);
        setRecords(transformedData.slice(0, ROWS_PER_PAGE));
        setOffset(0);
      } catch (error) {
        console.error("Error fetching initial match history: ", error);
      } finally {
        setInitialTableLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const performAuthCheck = async () => {
      setAuthCheckLoading(true);
      try {
        const authRes = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData?.authenticated && authData.user) {
            setCurrentUser({
              UserID: authData.user.UserID,
              Username: authData.user.Username,
            });
            fetchAndSetInitialGameHistoryForTable(authData.user.UserID);
          } else {
            router.replace("/");
            return;
          }
        } else {
          router.replace("/");
          return;
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace("/");
        return;
      }
      setAuthCheckLoading(false);
    };
    performAuthCheck();
  }, [router, fetchAndSetInitialGameHistoryForTable]);

  // Corrected useEffect for fetching graph data
  useEffect(() => {
    if (activeView !== "graph" || authCheckLoading || !currentUser) {
      return;
    }

    if (USE_SAMPLE_GAME_HISTORY_GRAPH_DATA) {
      console.log("GAME HISTORY GRAPH TEST MODE: Using sample balance data.");
      setBalanceHistory(SAMPLE_BALANCE_HISTORY_DATA);
      setGraphLoading(false);
      setGraphError(null);
      return;
    }

    const fetchGraphData = async () => {
      setGraphLoading(true);
      setGraphError(null);
      try {
        const data = await getBalanceHistory();
        setBalanceHistory(data);
      } catch (error) {
        console.error("Failed to fetch balance history for graph:", error);
        setGraphError(error instanceof Error ? error.message : "Unknown error");
        setBalanceHistory(null);
      } finally {
        setGraphLoading(false);
      }
    };

    if (currentUser) {
      fetchGraphData();
    }
  }, [activeView, authCheckLoading, currentUser]); // This is the correct dependency array for THIS useEffect

  const updateDisplayedRecords = (newOffset: number) => {
    setIsPaginating(true);
    setRecords(allUserMatches.slice(newOffset, newOffset + ROWS_PER_PAGE));
    setOffset(newOffset);
    setIsPaginating(false);
  };

  const handleNext = () => {
    if (offset + ROWS_PER_PAGE < totalRecords) {
      updateDisplayedRecords(offset + ROWS_PER_PAGE);
    }
  };

  const handlePrev = () => {
    if (offset - ROWS_PER_PAGE >= 0) {
      updateDisplayedRecords(offset - ROWS_PER_PAGE);
    }
  };

  if (authCheckLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game History & Balance</h1>

      <div className={styles.viewToggleContainer}>
        <button
          onClick={() => setActiveView("table")}
          className={`${styles.toggleButton} ${
            activeView === "table" ? styles.toggleButtonActive : ""
          }`}
          disabled={initialTableLoading || graphLoading}
        >
          Game Log
        </button>
        <button
          onClick={() => setActiveView("graph")}
          className={`${styles.toggleButton} ${
            activeView === "graph" ? styles.toggleButtonActive : ""
          }`}
          disabled={initialTableLoading || graphLoading}
        >
          Balance Graph
        </button>
      </div>

      <div className={styles.contentSection}>
        {activeView === "table" && (
          <>
            {initialTableLoading ? (
              <div className={styles.loadingMessage}>
                Loading Game History...
              </div>
            ) : records.length > 0 ? (
              <GameHistoryTable data={records} loading={isPaginating} />
            ) : (
              <p className={styles.noDataMessage}>No game history available.</p>
            )}
          </>
        )}

        {activeView === "graph" && (
          <>
            {graphLoading && (
              <div className={styles.loadingMessage}>
                Loading Balance Graph...
              </div>
            )}
            {graphError && (
              <p className={styles.errorMessage}>Error: {graphError}</p>
            )}
            {!graphLoading &&
              !graphError &&
              balanceHistory &&
              balanceHistory.length > 0 && (
                <GameHistoryGraph
                  balanceHistoryData={balanceHistory}
                  currencySymbol="💎"
                />
              )}
            {!graphLoading &&
              !graphError &&
              (!balanceHistory || balanceHistory.length === 0) && (
                <p className={styles.noDataMessage}>
                  Balance history data is not available to display graph.
                </p>
              )}
          </>
        )}
      </div>

      {activeView === "table" && records.length > 0 && !initialTableLoading && (
        <div className={styles.pagination}>
          <button
            onClick={handlePrev}
            disabled={offset === 0 || isPaginating}
            className={styles.paginationButton}
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={offset + ROWS_PER_PAGE >= totalRecords || isPaginating}
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
