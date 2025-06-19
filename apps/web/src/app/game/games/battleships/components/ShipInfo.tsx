"use client";
import React from 'react';
import { Ship } from '../utils/types';
import styles from '../Battleships.module.css';

interface ShipInfoProps {
    ships: Ship[];
    title: string;
}

const ShipInfo: React.FC<ShipInfoProps> = ({ ships, title }) => {
    if (!ships || ships.length === 0) {
        return <p>No ship data available.</p>;
    }
    return (
        <div className={styles.shipInfoContainer}>
            <h4>{title}</h4>
            <ul>
                {ships.map(ship => (
                    <li key={ship.id} className={ship.isSunk ? styles.sunkShipInfo : ''}>
                        {ship.name} ({ship.size}) - Hits: {ship.hits} {ship.isSunk ? "- SUNK!" : ""}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ShipInfo;