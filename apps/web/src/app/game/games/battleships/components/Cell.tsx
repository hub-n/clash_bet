"use client";

import React from 'react';
import { CellData, Coordinate, CellState } from '../utils/types';
import styles from '../Battleships.module.css';

interface CellProps {
    data: CellData;
    onClick: () => void;
    isOpponentCell?: boolean;
    disabled?: boolean;
    onHover?: () => void;
    onRightClick?: () => void;
    isPreviewing?: boolean;
    isPlacementValid?: boolean;
}

const Cell: React.FC<CellProps> = ({
    data,
    onClick,
    isOpponentCell = false,
    disabled = false,
    onHover,
    onRightClick,
    isPreviewing = false,
    isPlacementValid = true,
}) => {
    const getCellClass = (state: CellState, isOpponent: boolean) => {
         if (isOpponent) {
             switch (state) {
                 case 'hit': return styles.hit;
                 case 'miss': return styles.miss;
                 case 'sunk': return styles.sunk;
                 default: return styles.empty;
             }
         } else {
             switch (state) {
                 case 'ship': return styles.ship;
                 case 'hit': return styles.hit; // Hit on own ship (by AI)
                 case 'miss': return styles.miss; // Should not happen directly on own board
                 case 'sunk': return styles.sunk; // Sunk own ship (by AI)
                 default: return styles.empty;
             }
         }
    };

    let cellClass = getCellClass(data.state, isOpponentCell);

    if (isPreviewing && data.state !== 'ship') { // Don't show preview over already placed ships
        cellClass += ` ${isPlacementValid ? styles.previewValid : styles.previewInvalid}`;
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        if (onRightClick) {
            e.preventDefault(); // Prevent browser context menu
            onRightClick();
        }
    };

    return (
        <button
            className={`${styles.cell} ${cellClass}`}
            onClick={onClick}
            disabled={disabled}
            aria-label={`Cell ${data.id.replace('-',', ')}, state: ${isOpponentCell && data.state === 'ship' ? 'unknown' : data.state}`}
            onMouseEnter={onHover}
            onContextMenu={handleContextMenu}
        >
        </button>
    );
};

export default Cell;