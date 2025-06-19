"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated) {
            router.replace("/dashboard");
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    checkAuth();
  }, [router]);
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>
        <span className={styles.titlePrimary}>Clash</span>
        <span className={styles.titleSecondary}>Bet</span>
      </h1>
      <p className={styles.subtitle}>
        Sharpen your strategic thinking and earn real rewards by competing in
        fast-paced 1v1 online games - where every move could bring victory and
        cash.
      </p>

      <div className={styles.buttonContainer}>
        <Link
          href="/login"
          className={`${styles.buttonBase} ${styles.buttonSecondary}`}
        >
          Login
        </Link>

        <Link
          href="/join"
          className={`${styles.buttonBase} ${styles.buttonPrimary}`}
        >
          Join
        </Link>
      </div>
    </main>
  );
}
