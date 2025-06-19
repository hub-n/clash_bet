"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import styles from "./profile.module.css";
import { FaSave, FaKey, FaTrash, FaUserEdit, FaImage } from "react-icons/fa";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string | null;
  profilePictureUrl: string | null;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<
    string | null
  >(null);
  const [currentProfilePictureUrl, setCurrentProfilePictureUrl] = useState<
    string | null
  >(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const performAuthCheck = async () => {
      setAuthCheckLoading(true);
      try {
        const authRes = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (!authData?.authenticated) {
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
    if (authCheckLoading) return;

    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/user/me", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch user profile");
        const user = await res.json();
        setName(user.UserFullName || "");
        setUsername(user.Username);
        setEmail(user.Email);
        setBio(user.UserBio || "");
        setCurrentProfilePictureUrl(user.profilePictureUrl);
        setProfilePicturePreview(user.profilePictureUrl);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setMessage({
          type: "error",
          text: "Failed to load profile. Please try again later.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [authCheckLoading]);

  const handleProfilePictureChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const updateResponse = await fetch("/api/user/update-user-info", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          newUserFullName: name,
          newUserBio: bio,
        }),
      });
      if (!updateResponse.ok) {
        throw new Error("Failed to update user info");
      }
      if (profilePicture) {
        setCurrentProfilePictureUrl(profilePicturePreview);
      }
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = () => {
    alert("Navigate to Change Password page/modal (not implemented).");
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      alert("Account deletion process initiated (not implemented).");
    }
  };

  if (authCheckLoading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.settingsContent}>
        <h1 className={styles.title}>Profile Settings</h1>
        {message && (
          <div
            className={`${styles.message} ${
              message.type === "success" ? styles.success : styles.error
            }`}
          >
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className={styles.formLayout}>
          <div className={styles.profilePictureColumn}>
            <div className={styles.avatarContainer}>
              {profilePicturePreview || currentProfilePictureUrl ? (
                <Image
                  src={profilePicturePreview || currentProfilePictureUrl || ""}
                  alt="Profile Preview"
                  width={150}
                  height={150}
                  className={styles.profileImage}
                  priority
                />
              ) : (
                <div className={styles.defaultAvatar}>
                  <span role="img" aria-label="Default profile icon">
                    👤
                  </span>
                </div>
              )}
            </div>
            <label
              htmlFor="profilePictureInput"
              className={styles.uploadButton}
            >
              Change Picture
            </label>
            <input
              type="file"
              id="profilePictureInput"
              accept="image/png, image/jpeg, image/gif"
              onChange={handleProfilePictureChange}
              style={{ display: "none" }}
              disabled={isSaving}
            />
            <p className={styles.imageHint}>PNG, JPG, GIF up to 5MB.</p>
          </div>
          <div className={styles.formFieldsColumn}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  title="Enter your full name (Optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isSaving}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  readOnly
                  className={styles.readOnlyInput}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                readOnly
                className={styles.readOnlyInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us a little about yourself"
                disabled={isSaving}
              />
            </div>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
        <div className={styles.actionsSection}>
          <h2 className={styles.actionsTitle}>Account Management</h2>
          <div className={styles.actionButtonsContainer}>
            <button
              onClick={handleChangePassword}
              className={styles.actionButton}
              disabled={isSaving}
            >
              Change Password
            </button>
            <button
              onClick={handleDeleteAccount}
              className={`${styles.actionButton} ${styles.dangerButton}`}
              disabled={isSaving}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
