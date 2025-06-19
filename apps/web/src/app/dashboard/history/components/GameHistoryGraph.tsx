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
  Filler,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { parseISO, min as minDate, max as maxDate } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

interface BalanceDataPoint {
  datetime: string;
  balance: number;
}

interface GameHistoryGraphProps {
  balanceHistoryData?: BalanceDataPoint[];
  currencySymbol?: string;
}

const GameHistoryGraph: React.FC<GameHistoryGraphProps> = ({
  balanceHistoryData,
  currencySymbol = "💎",
}) => {
  if (!balanceHistoryData || balanceHistoryData.length === 0) {
    return <p>Not enough data to display the balance graph.</p>;
  }

  const allDatetimes: Date[] = balanceHistoryData.map((p) =>
    parseISO(p.datetime)
  );
  const minTimestamp = minDate(allDatetimes).toISOString();
  const maxTimestamp = maxDate(allDatetimes).toISOString();

  const chartData: ChartData<"line"> = {
    datasets: [
      {
        label: "Account Balance",
        data: balanceHistoryData.map((p) => ({ x: p.datetime, y: p.balance })),
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        fill: true,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Account Balance Over Time",
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += `${currencySymbol}${context.parsed.y.toFixed(2)}`;
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        min: minTimestamp,
        max: maxTimestamp,
        time: {
          unit: balanceHistoryData.length > 50 ? "day" : "hour",
          tooltipFormat: "MMM dd, yyyy HH:mm",
          displayFormats: {
            hour: "HH:mm",
            day: "MMM dd",
          },
        },
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        title: {
          display: true,
          text: `Balance`,
        },
        ticks: {
          callback: function (value) {
            return `${currencySymbol}${Number(value).toFixed(0)}`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: "400px", width: "100%" }}>
      <Line options={options} data={chartData} />
    </div>
  );
};

export default GameHistoryGraph;
