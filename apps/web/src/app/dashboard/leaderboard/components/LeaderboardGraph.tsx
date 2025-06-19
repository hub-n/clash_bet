// {
//   "LOGGED_IN_USER_ID": [
//     { "date": "2023-10-01", "winRatio": 0.55 },
//     { "date": "2023-10-02", "winRatio": 0.56 },
//     // ...
//   ],
//   "TOP_PLAYER_ID": [
//     { "date": "2023-10-01", "winRatio": 0.78 },
//     { "date": "2023-10-02", "winRatio": 0.79 },
//     // ...
//   ]
// }

"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  ChartData,
} from "chart.js";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface PlayerDataPoint {
  date: string;
  winRatio: number;
}

interface GraphDataset {
  label: string;
  data: { x: string; y: number }[];
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  tension?: number;
}

interface LeaderboardGraphProps {
  loggedInPlayerData?: PlayerDataPoint[];
  topPlayerData?: PlayerDataPoint[];
  loggedInPlayerName: string;
  topPlayerName: string;
}

const LeaderboardGraph: React.FC<LeaderboardGraphProps> = ({
  loggedInPlayerData,
  topPlayerData,
  loggedInPlayerName,
  topPlayerName,
}) => {
  const datasets: GraphDataset[] = [];

  if (loggedInPlayerData && loggedInPlayerData.length > 0) {
    datasets.push({
      label: `${loggedInPlayerName}'s Win Ratio`,
      data: loggedInPlayerData.map(p => ({ x: p.date, y: p.winRatio })),
      borderColor: "rgb(75, 192, 192)",
      backgroundColor: "rgba(75, 192, 192, 0.5)",
      fill: false,
      tension: 0.1,
    });
  }

  if (topPlayerData && topPlayerData.length > 0 && topPlayerName !== loggedInPlayerName) {
    datasets.push({
      label: `${topPlayerName}'s Win Ratio (Top Player)`,
      data: topPlayerData.map(p => ({ x: p.date, y: p.winRatio })),
      borderColor: "rgb(255, 99, 132)",
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      fill: false,
      tension: 0.1,
    });
  } else if (topPlayerData && topPlayerData.length > 0 && topPlayerName === loggedInPlayerName) {
    if (datasets.length > 0) {
        datasets[0].label = `${loggedInPlayerName}'s Win Ratio (You are Top Player!)`
    }
  }


  const chartData: ChartData<"line"> = {
    datasets: datasets,
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Win Ratio Over Time",
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += (context.parsed.y * 100).toFixed(1) + '%';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
          tooltipFormat: "MMM dd, yyyy",
          displayFormats: {
             day: 'MMM dd'
          }
        },
        title: {
          display: true,
          text: "Date",
        },
      },
      y: {
        beginAtZero: true,
        max: 1,
        title: {
          display: true,
          text: "Win Ratio",
        },
        ticks: {
          callback: function (value) {
            return (Number(value) * 100).toFixed(0) + "%";
          },
        },
      },
    },
  };

  if (datasets.length === 0) {
    return <p>Not enough data to display the graph.</p>;
  }

  return (
    <div style={{ height: "400px", width: "100%" }}>
      <Line options={options} data={chartData} />
    </div>
  );
};

export default LeaderboardGraph;