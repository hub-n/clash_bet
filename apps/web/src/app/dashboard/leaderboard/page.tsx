"use client";
import { useState, useEffect, useCallback } from "react";
import LeaderboardTable from "./components/Table";
import LeaderboardGraph from "./components/LeaderboardGraph";
import styles from "./leaderboard.module.css";
import { useRouter } from "next/navigation";

const USE_SAMPLE_DATA_FOR_GRAPH_TESTING = false;

const SAMPLE_CURRENT_USER = {
  UserID: 101,
  Username: "MyPlayer123",
};
const SAMPLE_LEADERBOARD_RECORDS: LeaderboardRecord[] = [
  { username: "TopGun", wins: 150, winRatio: 0.75, matchesCount: 200 },
  { username: "MyPlayer123", wins: 80, winRatio: 0.55, matchesCount: 145 },
  { username: "ProGamer", wins: 120, winRatio: 0.6, matchesCount: 200 },
  { username: "RookieStar", wins: 50, winRatio: 0.5, matchesCount: 100 },
  { username: "CasualJoe", wins: 20, winRatio: 0.4, matchesCount: 50 },
];
const generateTimeSeriesData = (
  startDate: Date,
  days: number,
  startRatio: number,
  trend: number,
  volatility: number
): PlayerTimeDataPoint[] => {
  const data: PlayerTimeDataPoint[] = [];
  let currentRatio = startRatio;
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    currentRatio += trend + (Math.random() - 0.5) * volatility;
    currentRatio = Math.max(0, Math.min(1, currentRatio));
    data.push({
      date: date.toISOString().split("T")[0],
      winRatio: parseFloat(currentRatio.toFixed(3)),
    });
  }
  return data;
};
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const SAMPLE_GRAPH_DATA: GraphData = {
  loggedInPlayer: generateTimeSeriesData(thirtyDaysAgo, 30, 0.5, 0.002, 0.05),
  topPlayer: generateTimeSeriesData(thirtyDaysAgo, 30, 0.7, 0.001, 0.03),
};

interface LeaderboardRecord {
  username: string;
  wins: number;
  winRatio: number;
  matchesCount: number;
}

interface PlayerTimeDataPoint {
  date: string;
  winRatio: number;
}
interface GraphData {
  loggedInPlayer?: PlayerTimeDataPoint[];
  topPlayer?: PlayerTimeDataPoint[];
}

const ROWS_PER_PAGE = 5;

const getTotalRecords = async (): Promise<{ totalRecords: number }> => {
  const res = await fetch("/api/player-stats/leaderboard-total", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch total leaderboard records");
  }
  return await res.json();
};

const getRecords = async (
  offset: number,
  limit: number
): Promise<{ records: LeaderboardRecord[] }> => {
  const res = await fetch(
    `/api/player-stats/leaderboard-range?offset=${offset}&limit=${limit}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch leaderboard records");
  }
  const data = await res.json();
  return data;
};

let currentUserForGraphData: { UserID: number; Username: string } | null = null;

const getGraphData = async (
  loggedInUserId: number,
  topPlayerUsername?: string
): Promise<GraphData> => {
  let userIdsParam = `${loggedInUserId}`;
  if (
    topPlayerUsername &&
    topPlayerUsername !== currentUserForGraphData?.Username
  ) {
    userIdsParam += `,${topPlayerUsername}`;
  }

  const res = await fetch(
    `/api/player-stats/win-ratio-history?userIds=${userIdsParam}&range=last30days`,
    { credentials: "include" }
  );
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      "Failed to fetch graph data. Status:",
      res.status,
      "Body:",
      errorBody
    );
    throw new Error(`Failed to fetch graph data: ${res.statusText}`);
  }
  const rawData = await res.json();

  const loggedInPlayerData = rawData[loggedInUserId.toString()] || [];
  let topPlayerData = [];

  if (topPlayerUsername && rawData[topPlayerUsername]) {
    topPlayerData = rawData[topPlayerUsername] || [];
  } else if (
    topPlayerUsername &&
    topPlayerUsername === currentUserForGraphData?.Username
  ) {
    topPlayerData = loggedInPlayerData;
  }

  return {
    loggedInPlayer: loggedInPlayerData,
    topPlayer: topPlayerData,
  };
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [authCheckLoading, setAuthCheckLoading] = useState(true);
  const [localCurrentUser, setLocalCurrentUser] = useState<{
    UserID: number;
    Username: string;
  } | null>(null);

  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [initialTableLoading, setInitialTableLoading] =
    useState<boolean>(false);
  const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);

  const [activeView, setActiveView] = useState<"table" | "graph">("table");

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState<boolean>(false);
  const [graphError, setGraphError] = useState<string | null>(null);

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
            currentUserForGraphData = {
              UserID: authData.user.UserID,
              Username: authData.user.Username,
            };
            setLocalCurrentUser({
              UserID: authData.user.UserID,
              Username: authData.user.Username,
            });
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
  }, [router]);

  useEffect(() => {
    if (authCheckLoading || !localCurrentUser) return;

    const initialFetch = async () => {
      setInitialTableLoading(true);
      try {
        const totalData = await getTotalRecords();
        setTotalRecords(totalData.totalRecords);
        if (totalData.totalRecords > 0) {
          const recordsData = await getRecords(0, ROWS_PER_PAGE);
          setRecords(recordsData.records);
        }
        setOffset(0);
      } catch (e) {
        console.error("Failed to fetch initial leaderboard data", e);
      } finally {
        setInitialTableLoading(false);
      }
    };
    initialFetch();
  }, [authCheckLoading, localCurrentUser]);

  useEffect(() => {
    if (activeView !== "graph" || authCheckLoading || !localCurrentUser) {
      return;
    }

    const currentEffectUser = localCurrentUser;

    if (USE_SAMPLE_DATA_FOR_GRAPH_TESTING) {
      console.log("GRAPH TEST MODE: Using sample graph data.");
      setGraphData(SAMPLE_GRAPH_DATA);
      setGraphLoading(false);
      setGraphError(null);
      return;
    }

    const fetchGraphDataForView = async () => {
      if (!currentEffectUser) return;

      setGraphLoading(true);
      setGraphError(null);
      try {
        const topLeaderboardPlayerRecord =
          records.length > 0 ? records[0] : null;
        const topPlayerUsernameForAPI = topLeaderboardPlayerRecord?.username;

        console.log(
          `Fetching graph data for: LoggedInUser ID: ${currentEffectUser.UserID}, TopPlayer Username: ${topPlayerUsernameForAPI}`
        );

        const data = await getGraphData(
          currentEffectUser.UserID,
          topPlayerUsernameForAPI
        );
        setGraphData(data);
      } catch (error) {
        console.error("Failed to fetch graph data:", error);
        setGraphError(
          error instanceof Error
            ? error.message
            : "Unknown error fetching graph data"
        );
        setGraphData(null);
      } finally {
        setGraphLoading(false);
      }
    };

    fetchGraphDataForView();
  }, [activeView, authCheckLoading, localCurrentUser, records]);

  const fetchMoreRecords = async (
    newOffset: number,
    limit: number
  ): Promise<void> => {
    setIsFetchingMore(true);
    try {
      const data = await getRecords(newOffset, limit);
      setRecords(data.records);
      setOffset(newOffset);
    } catch (error) {
      console.error("Failed to fetch more records", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleNext = (): void => {
    if (offset + ROWS_PER_PAGE < totalRecords) {
      fetchMoreRecords(offset + ROWS_PER_PAGE, ROWS_PER_PAGE);
    }
  };

  const handlePrevious = (): void => {
    if (offset > 0) {
      fetchMoreRecords(Math.max(0, offset - ROWS_PER_PAGE), ROWS_PER_PAGE);
    }
  };

  const getRankedData = (): (LeaderboardRecord & { rank: number })[] => {
    return records.map((record, index) => ({
      ...record,
      rank: offset + index + 1,
    }));
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
    <div className={styles.leaderboardContainer}>
      <h1 className={styles.pageTitle}>Leaderboard</h1>

      <div className={styles.viewToggleContainer}>
        <button
          onClick={() => setActiveView("table")}
          className={`${styles.toggleButton} ${
            activeView === "table" ? styles.toggleButtonActive : ""
          }`}
          disabled={initialTableLoading || graphLoading}
        >
          Table View
        </button>
        <button
          onClick={() => setActiveView("graph")}
          className={`${styles.toggleButton} ${
            activeView === "graph" ? styles.toggleButtonActive : ""
          }`}
          disabled={initialTableLoading || graphLoading}
        >
          Graph View
        </button>
      </div>

      <div className={styles.leaderboardSection}>
        {activeView === "table" && (
          <>
            {initialTableLoading ? (
              <div className={styles.loading}>Loading Leaderboard Data...</div>
            ) : records.length > 0 ? (
              <LeaderboardTable data={getRankedData()} />
            ) : (
              <p className={styles.noDataMessage}>
                No leaderboard data available.
              </p>
            )}
          </>
        )}

        {activeView === "graph" && (
          <>
            {graphLoading && (
              <div className={styles.loading}>Loading Graph Data...</div>
            )}
            {graphError && (
              <p className={styles.errorMessage}>Error: {graphError}</p>
            )}
            {!graphLoading && !graphError && graphData && localCurrentUser && (
              <LeaderboardGraph
                loggedInPlayerData={graphData.loggedInPlayer}
                topPlayerData={graphData.topPlayer}
                loggedInPlayerName={
                  USE_SAMPLE_DATA_FOR_GRAPH_TESTING && SAMPLE_CURRENT_USER
                    ? SAMPLE_CURRENT_USER.Username
                    : localCurrentUser.Username
                }
                topPlayerName={
                  USE_SAMPLE_DATA_FOR_GRAPH_TESTING &&
                  SAMPLE_LEADERBOARD_RECORDS.length > 0
                    ? SAMPLE_LEADERBOARD_RECORDS[0].username
                    : records.length > 0
                    ? records[0].username
                    : "Top Player"
                }
              />
            )}
            {!graphLoading && !graphError && !graphData && (
              <p className={styles.noDataMessage}>
                Graph data is not available.
              </p>
            )}
          </>
        )}
      </div>

      {activeView === "table" && records.length > 0 && !initialTableLoading && (
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationButton}
            onClick={handlePrevious}
            disabled={offset === 0 || isFetchingMore}
          >
            Previous
          </button>
          <button
            className={styles.paginationButton}
            onClick={handleNext}
            disabled={offset + ROWS_PER_PAGE >= totalRecords || isFetchingMore}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
