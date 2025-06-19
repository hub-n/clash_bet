"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dashboardPageSpecificStyles from "./dashboard.module.css";

const gameCards = [
  {
    id: "rock-paper-scissors",
    title: "Rock, Paper, Scissors",
    description:
      "Outsmart your rival in a classic game of quick choices and sharp instincts.",
    icon: "⚔️",
  },
  {
    id: "battleships",
    title: "Battleships",
    description:
      "Guess your opponent’s ship locations and sink them before they sink yours.",
    icon: "🛥️",
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    description:
      "Uncover safe tiles and avoid hidden mines using logic and deduction.",
    icon: "🧩",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      setIsAuthLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (!data?.authenticated) {
            router.replace("/");
            return;
          }
        } else {
          router.replace("/");
          return;
        }
      } catch (err) {
        console.error("Session check failed:", err);
        router.replace("/");
        return;
      }
      setIsAuthLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isAuthLoading) {
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
    <div className={dashboardPageSpecificStyles.dashboardContent}>
      <h1 className={dashboardPageSpecificStyles.dashboardTitle}>
        Quick Match
      </h1>
      <p className={dashboardPageSpecificStyles.dashboardSubtitle}>
        Choose your challenge or jump into a random game.
      </p>

      <div className={dashboardPageSpecificStyles.cardsContainer}>
        {gameCards.map((card) => (
          <Link
            key={card.id}
            href={{
              pathname: "/dashboard/waitroom",
              query: { gameId: card.id },
            }}
            className={dashboardPageSpecificStyles.cardLink}
          >
            <div className={dashboardPageSpecificStyles.card}>
              <div className={dashboardPageSpecificStyles.cardIcon}>
                {card.icon}
              </div>
              <h2 className={dashboardPageSpecificStyles.cardTitle}>
                {card.title}
              </h2>
              <p className={dashboardPageSpecificStyles.cardDescription}>
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
