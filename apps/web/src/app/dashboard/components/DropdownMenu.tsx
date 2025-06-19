import React from 'react';
import Link from 'next/link';
import styles from './DropdownMenu.module.css';

interface DropdownMenuProps {
  onLogout?: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ onLogout }) => {
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Default action
      console.log('Logout clicked');
    }
  };

  return (
    <ul className={styles.dropdown}>
      <li>
        <Link href="/dashboard/profile" className={styles.dropdownItem}>
          Profile Settings
        </Link>
      </li>
      <li>
        <hr className={styles.separator} />
      </li>
      <li>
        <button onClick={handleLogoutClick} className={`${styles.dropdownItem} ${styles.logoutButton}`}>
          Logout
        </button>
      </li>
    </ul>
  );
};

export default DropdownMenu;