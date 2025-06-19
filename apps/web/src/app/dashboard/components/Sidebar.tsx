"use client";

import Link from 'next/link';
import { useState } from 'react';
import styles from './Sidebar.module.css';

const sidebarNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: '🏆' },
  { name: 'Game History', href: '/dashboard/history', icon: '📜' },
  { name: 'Wallet', href: '/dashboard/wallet', icon: '💵' },
  { name: 'About', href: '/about', icon: 'ℹ️' },
];

export default function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside
      className={styles.sidebar}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-hovered={isHovered}
    >
      <div className={styles.header}>
        <div className={styles.logoArea}>
          <Link href="/dashboard" className={styles.logoText}>
            {isHovered ? 'ClashBet' : 'CB'}
          </Link>
        </div>
      </div>
      <nav className={styles.navigation}>
        <ul>
          {sidebarNavItems.map((item) => (
            <li key={item.name} title={!isHovered ? item.name : undefined}>
              <Link href={item.href} className={styles.navLink}>
                <span className={styles.navIcon}>{item.icon}</span>
                {isHovered && <span className={styles.navText}>{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}