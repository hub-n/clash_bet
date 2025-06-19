"use client";

import React, { useState, useRef } from "react";
import DropdownMenu from "./DropdownMenu";
import styles from "./UserProfileButton.module.css";
import { useRouter } from "next/navigation";

interface UserProfileButtonProps {}

export default function UserProfileButton({}: /* onClick */ UserProfileButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 200);
  };

  const handleLogout = async () => {
    console.log("Logout action initiated from UserProfileButton");
    setIsMenuOpen(false);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div
      className={styles.userProfileWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={styles.userProfileButton}
        aria-label="User menu"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        <span role="img" aria-label="User Profile Icon">
          👤
        </span>
      </button>

      <div
        className={`${styles.dropdownContainer} ${
          isMenuOpen ? styles.dropdownVisible : ""
        }`}
      >
        {isMenuOpen && <DropdownMenu onLogout={handleLogout} />}
      </div>
    </div>
  );
}
