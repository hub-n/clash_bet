"use client";

import Link from "next/link";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import mainPageStyles from "../page.module.css";
import joinStyles from "./join.module.css";

export default function JoinPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (!username || !email || !password) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || `Error: ${response.status} ${response.statusText}`
        );
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      router.push("/dashboard");
    } catch (err) {
      console.error("Registration request failed:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
      return;
    }
  };

  return (
    <main className={mainPageStyles.container}>
      <div className={joinStyles.joinFormContainer}>
        <h1 className={joinStyles.formTitle}>Create Your Account</h1>
        <p className={joinStyles.formSubtitle}>
          Embark on your coding journey with us.
        </p>

        {error && <div className={joinStyles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={joinStyles.form}>
          <div className={joinStyles.inputGroup}>
            <label htmlFor="username" className={joinStyles.label}>
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className={joinStyles.inputField}
              placeholder="Choose a unique username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className={joinStyles.inputGroup}>
            <label htmlFor="email" className={joinStyles.label}>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={joinStyles.inputField}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className={joinStyles.inputGroup}>
            <label htmlFor="password" className={joinStyles.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className={joinStyles.inputField}
              placeholder="Create a strong password (min. 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className={joinStyles.inputGroup}>
            <label htmlFor="confirmPassword" className={joinStyles.label}>
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className={joinStyles.inputField}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`${joinStyles.buttonBase} ${joinStyles.submitButton}`}
            disabled={isLoading}
          >
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className={joinStyles.linksContainer}>
          <p className={joinStyles.signInText}>
            Already have an account?{" "}
            <Link href="/login" className={joinStyles.formLinkStrong}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
