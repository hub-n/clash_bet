"use client";

import React from 'react';
import { Ship, ShipOrientation } from '../utils/types';
import styles from '../Battleships.module.css';

interface ShipPlacementControlsProps {
    ships: Ship[];
    selectedShipId: string | null;
    orientation: ShipOrientation;
    onSelectShip: (shipId: string) => void;
    onConfirmSetup: () => void;
    allShipsPlaced: boolean;
}

const ShipPlacementControls: React.FC<ShipPlacementControlsProps> = ({
    ships,
    selectedShipId,
    orientation,
    onSelectShip,
    onConfirmSetup,
    allShipsPlaced,
}) => {
    return (
        <div className={styles.shipPlacementControls}>
            <h3>Place Your Ships</h3>
            <div className={styles.shipSelectionList}>
                {ships.map(ship => (
                    <button
                        key={ship.id}
                        onClick={() => onSelectShip(ship.id)}
                        className={`${styles.shipSelectItem} ${ship.id === selectedShipId ? styles.selected : ''} ${ship.isPlaced ? styles.placed : ''}`}
                        disabled={ship.isPlaced}
                        title={`${ship.name} - Length: ${ship.size}${ship.isPlaced ? ' (Placed)' : ''}`}
                    >
                        {ship.name} ({ship.size}) {ship.isPlaced ? "✓" : ""}
                    </button>
                ))}
            </div>

            <button
                onClick={onConfirmSetup}
                className={`${styles.controlButton} ${styles.confirmButton}`}
                disabled={!allShipsPlaced}
                title={allShipsPlaced ? "Start the game" : "Place all your ships to start"}
            >
                Confirm Setup & Start Game
            </button>
        </div>
    );
};

export default ShipPlacementControls;