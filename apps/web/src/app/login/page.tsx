"use client";

import Link from "next/link";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import mainPageStyles from "../page.module.css";
import loginStyles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
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
      console.error("Login request failed:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
      return;
    }
  };

  return (
    <main className={mainPageStyles.container}>
      <div className={loginStyles.loginFormContainer}>
        <h1 className={loginStyles.formTitle}>Welcome Back</h1>
        <p className={loginStyles.formSubtitle}>
          Sign in to continue your journey.
        </p>

        {error && <div className={loginStyles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={loginStyles.form}>
          <div className={loginStyles.inputGroup}>
            <label htmlFor="email" className={loginStyles.label}>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={loginStyles.inputField}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className={loginStyles.inputGroup}>
            <label htmlFor="password" className={loginStyles.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className={loginStyles.inputField}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`${loginStyles.buttonBase} ${loginStyles.submitButton}`}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className={loginStyles.linksContainer}>
          <Link href="/forgot-password" className={loginStyles.formLink}>
            Forgot Password?
          </Link>
          <p className={loginStyles.signUpText}>
            Don't have an account?{" "}
            <Link href="/join" className={loginStyles.formLinkStrong}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
