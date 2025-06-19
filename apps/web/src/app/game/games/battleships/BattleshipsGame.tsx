"use client";

import React from 'react';
import { useBattleshipsGame } from './hooks/useBattleshipsGame';
import Board from './components/Board';
import ShipPlacementControls from './components/ShipPlacementControls';
import styles from './Battleships.module.css';

interface BattleshipsGameProps {
    gameId: string;
    initialData?: any; // Replace
}

export default function BattleshipsGame({ gameId, initialData }: BattleshipsGameProps) {
    const {
        gameState,
        player,
        opponent,
        allPlayerShipsPlaced,
        handleSelectShipForPlacement,
        handleToggleShipOrientation,
        handlePlaceShip,
        handleConfirmSetup,
        handlePlayerAttack,
        resetGame,
        handleCellHoverForPreview,
        handleCellLeavePreview,
    } = useBattleshipsGame();
    // } = useBattleshipsGame({ gameId, initialData }); // Pass props to the hook

    if (!player || !opponent) {
        return <p className={styles.loadingMessage}>Initializing game components...</p>;
    }

    const isPlayerTurn = gameState.phase === 'playing' && gameState.currentPlayerId === player.id;

    return (
        <div className={styles.battleshipsContainer}>
            {gameState.phase === 'setup' && (
                <ShipPlacementControls
                    ships={player.ships}
                    selectedShipId={gameState.selectedShipIdForPlacement}
                    orientation={gameState.shipPlacementOrientation}
                    onSelectShip={handleSelectShipForPlacement}
                    onConfirmSetup={handleConfirmSetup}
                    allShipsPlaced={allPlayerShipsPlaced}
                />
            )}
            {gameState.phase === 'gameOver' && (
             <div className={styles.gameOverMessage}>
                 <h3>Game Over!</h3>
                 <p>{gameState.winnerId === player.id ? "You Win!" : "Computer Wins!"}</p>
                 <button onClick={resetGame} className={styles.resetButton}>Play Again</button>
             </div>
             )}


            <div className={styles.gameBoards}>
                <div className={styles.boardSection}>
                    {gameState.phase !== 'setup' && (
                        <h3>Your Board</h3>
                    )}
                    <Board
                        grid={player.board}
                        onCellClick={gameState.phase === 'setup' ? handlePlaceShip : () => {}}
                        isPlayerBoardDuringSetup={gameState.phase === 'setup'}
                        disabled={gameState.phase === 'playing'}
                        onCellHover={gameState.phase === 'setup' ? handleCellHoverForPreview : undefined}
                        onCellLeave={gameState.phase === 'setup' ? handleCellLeavePreview : undefined}
                        onCellRightClick={gameState.phase === 'setup' && gameState.selectedShipIdForPlacement ? handleToggleShipOrientation : undefined}
                        previewCells={gameState.previewCells}
                        isPreviewPlacementValid={gameState.isPreviewPlacementValid}
                    />
                </div>

                {gameState.phase !== 'setup' && (
                    <div className={styles.boardSection}>
                        <h3>Opponent's Board</h3>
                        <Board
                            grid={opponent.board}
                            onCellClick={handlePlayerAttack}
                            isOpponentBoard={true}
                            disabled={!isPlayerTurn || gameState.phase === 'gameOver'}
                        />
                    </div>
                )}
            </div>

            {gameState.phase === 'playing' && (
             <p className={styles.turnIndicator}>
                 {isPlayerTurn ? "Your Turn" : "Computer's Turn"}
             </p>
             )}
             {gameState.phase === 'setup' && (
                 <button onClick={resetGame} className={`${styles.controlButton} ${styles.resetButtonBottom}`}>
                     Reset Setup
                 </button>
            )}
        </div>
    );
}