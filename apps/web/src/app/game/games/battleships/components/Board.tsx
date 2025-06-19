"use client";

import React from 'react';
import { BoardGrid, Coordinate } from '../utils/types';
import Cell from './Cell';
import styles from '../Battleships.module.css';

interface BoardProps {
    grid: BoardGrid;
    onCellClick: (coord: Coordinate) => void;
    isPlayerBoardDuringSetup?: boolean;
    isOpponentBoard?: boolean;
    disabled?: boolean;
    // New props for preview and right-click rotation
    onCellHover?: (coord: Coordinate) => void;
    onCellLeave?: () => void;
    onCellRightClick?: () => void; // For rotating ship
    previewCells?: Coordinate[] | null;
    isPreviewPlacementValid?: boolean;
}

const Board: React.FC<BoardProps> = ({
    grid,
    onCellClick,
    isPlayerBoardDuringSetup = false,
    isOpponentBoard = false,
    disabled = false,
    onCellHover,
    onCellLeave,
    onCellRightClick,
    previewCells,
    isPreviewPlacementValid,
}) => {
    return (
        <div
            className={`${styles.board} ${isOpponentBoard ? styles.opponentBoard : ''}`}
            style={{ gridTemplateColumns: `repeat(${grid.length}, 1fr)` }}
            onMouseLeave={onCellLeave} // Handle mouse leaving the entire board for preview reset
        >
            {grid.map((row, rowIndex) =>
                row.map((cellData, colIndex) => {
                    const coord = { row: rowIndex, col: colIndex };
                    const isPreviewingCell = previewCells?.some(pCell => pCell.row === rowIndex && pCell.col === colIndex) || false;

                    return (
                        <Cell
                            key={cellData.id}
                            data={cellData}
                            onClick={() => onCellClick(coord)}
                            isOpponentCell={isOpponentBoard}
                            disabled={
                                disabled ||
                                (isOpponentBoard && (cellData.state === 'hit' || cellData.state === 'miss' || cellData.state === 'sunk')) ||
                                (!isPlayerBoardDuringSetup && !isOpponentBoard)
                            }
                            // Pass preview and right-click props
                            onHover={isPlayerBoardDuringSetup && onCellHover ? () => onCellHover(coord) : undefined}
                            // onLeave will be handled by board's onMouseLeave for simplicity
                            onRightClick={isPlayerBoardDuringSetup && onCellRightClick ? onCellRightClick : undefined}
                            isPreviewing={isPreviewingCell}
                            isPlacementValid={isPreviewPlacementValid ?? true} // Default to true if undefined
                        />
                    );
                })
            )}
        </div>
    );
};

export default Board;