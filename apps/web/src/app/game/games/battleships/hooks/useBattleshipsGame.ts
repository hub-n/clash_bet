"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    BoardGrid,
    Ship,
    GameState,
    Player,
    Coordinate,
    CellState,
    ShipOrientation,
} from '../utils/types';
import {
    createInitialBoard,
    createInitialShips,
    placeShipsRandomly,
    checkWinCondition,
    canPlaceShip,
    BOARD_SIZE
} from '../utils/gameLogic';

const PLAYER_ID = 'player1';
const AI_ID = 'ai';

export function useBattleshipsGame() {
    const [gameState, setGameState] = useState<GameState>(() => {
        const initialPlayerShips = createInitialShips();
        const initialPlayerBoard = createInitialBoard(BOARD_SIZE);
        const initialAiShips = createInitialShips();
        const initialAiBoard = createInitialBoard(BOARD_SIZE);

        return {
            phase: 'setup',
            currentPlayerId: PLAYER_ID,
            players: {
                [PLAYER_ID]: { id: PLAYER_ID, name: 'You', board: initialPlayerBoard, ships: initialPlayerShips, isTurn: true },
                [AI_ID]: { id: AI_ID, name: 'Computer', board: initialAiBoard, ships: initialAiShips, isTurn: false },
            },
            winnerId: null,
            boardSize: BOARD_SIZE,
            selectedShipIdForPlacement: initialPlayerShips.find(s => !s.isPlaced)?.id || null,
            shipPlacementOrientation: 'horizontal',
            previewCells: null, // Initialize preview state
            isPreviewPlacementValid: true, // Default to true
            currentHoveredCellForPreview: null,
        };
    });

    const { players, currentPlayerId, phase, boardSize, selectedShipIdForPlacement, shipPlacementOrientation, currentHoveredCellForPreview } = gameState;
    const player = players[PLAYER_ID];
    const opponent = players[AI_ID];
    const allPlayerShipsPlaced = player.ships.every(ship => ship.isPlaced);

    // --- Preview Logic ---
    const updatePlacementPreview = useCallback((hoverCoord: Coordinate | null, currentOrientation: ShipOrientation) => {
        if (phase !== 'setup' || !selectedShipIdForPlacement || !hoverCoord) {
            setGameState(prev => ({ ...prev, previewCells: null, isPreviewPlacementValid: true, currentHoveredCellForPreview: hoverCoord }));
            return;
        }

        const shipToPreview = player.ships.find(s => s.id === selectedShipIdForPlacement);
        if (!shipToPreview || shipToPreview.isPlaced) {
            setGameState(prev => ({ ...prev, previewCells: null, isPreviewPlacementValid: true, currentHoveredCellForPreview: hoverCoord }));
            return;
        }

        const { canPlace, positions } = canPlaceShip(player.board, shipToPreview, hoverCoord, currentOrientation);
        setGameState(prev => ({
            ...prev,
            previewCells: positions,
            isPreviewPlacementValid: canPlace,
            currentHoveredCellForPreview: hoverCoord,
        }));
    }, [phase, selectedShipIdForPlacement, player.ships, player.board]);


    const handleCellHoverForPreview = useCallback((coord: Coordinate) => {
        if (phase === 'setup') {
            updatePlacementPreview(coord, shipPlacementOrientation);
        }
    }, [phase, shipPlacementOrientation, updatePlacementPreview]);

    const handleCellLeavePreview = useCallback(() => {
        if (phase === 'setup') {
            setGameState(prev => ({ ...prev, previewCells: null, currentHoveredCellForPreview: null }));
        }
    }, [phase]);


    // --- Setup Phase Logic ---
    const handleSelectShipForPlacement = useCallback((shipId: string) => {
        setGameState(prev => {
            const newState = { ...prev, selectedShipIdForPlacement: shipId };
            // If a cell is currently hovered, update preview for the new ship
            if (prev.currentHoveredCellForPreview) {
                 const shipToPreview = prev.players[PLAYER_ID].ships.find(s => s.id === shipId);
                 if (shipToPreview && !shipToPreview.isPlaced) {
                     const { canPlace, positions } = canPlaceShip(
                         prev.players[PLAYER_ID].board,
                         shipToPreview,
                         prev.currentHoveredCellForPreview,
                         prev.shipPlacementOrientation
                     );
                     newState.previewCells = positions;
                     newState.isPreviewPlacementValid = canPlace;
                 } else {
                     newState.previewCells = null;
                     newState.isPreviewPlacementValid = true;
                 }
            }
            return newState;
        });
    }, []);

    const handleToggleShipOrientation = useCallback(() => {
        setGameState(prev => {
            const newOrientation = prev.shipPlacementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
            const newState = { ...prev, shipPlacementOrientation: newOrientation };

            // Update preview if a cell is currently hovered
            if (prev.currentHoveredCellForPreview && prev.selectedShipIdForPlacement) {
                const shipToPreview = prev.players[PLAYER_ID].ships.find(s => s.id === prev.selectedShipIdForPlacement);
                if (shipToPreview && !shipToPreview.isPlaced) {
                    const { canPlace, positions } = canPlaceShip(
                        prev.players[PLAYER_ID].board,
                        shipToPreview,
                        prev.currentHoveredCellForPreview,
                        newOrientation // Use new orientation
                    );
                    newState.previewCells = positions;
                    newState.isPreviewPlacementValid = canPlace;
                } else {
                    newState.previewCells = null;
                    newState.isPreviewPlacementValid = true;
                }
            }
            return newState;
        });
    }, []);


    const handlePlaceShip = useCallback((coord: Coordinate) => {
        if (phase !== 'setup' || !selectedShipIdForPlacement) return;

         const shipToPlace = player.ships.find(s => s.id === selectedShipIdForPlacement);
         if (!shipToPlace || shipToPlace.isPlaced) return;

         const { canPlace, positions } = canPlaceShip(player.board, shipToPlace, coord, shipPlacementOrientation);

         if (canPlace) {
             setGameState(prev => {
                 const newPlayers = { ...prev.players };
                 const updatedPlayer = { ...newPlayers[PLAYER_ID] };
                 const newBoard = JSON.parse(JSON.stringify(updatedPlayer.board)) as BoardGrid;

                 positions.forEach(pos => {
                     newBoard[pos.row][pos.col].state = 'ship';
                     newBoard[pos.row][pos.col].shipId = shipToPlace.id;
                 });

                 updatedPlayer.board = newBoard;
                 updatedPlayer.ships = updatedPlayer.ships.map(s =>
                     s.id === shipToPlace.id ? { ...s, isPlaced: true, positions } : s
                 );
                 newPlayers[PLAYER_ID] = updatedPlayer;

                 const nextShipToPlace = updatedPlayer.ships.find(s => !s.isPlaced);
                 const newSelectedShipId = nextShipToPlace ? nextShipToPlace.id : null;

                 let newPreviewCells = null;
                 let newIsPreviewValid = true;
                 if(newSelectedShipId && prev.currentHoveredCellForPreview){
                     const nextShipToPreview = updatedPlayer.ships.find(s => s.id === newSelectedShipId);
                     if(nextShipToPreview){
                          const { canPlace: canPreviewPlace, positions: previewPositions } = canPlaceShip(
                             newBoard,
                             nextShipToPreview,
                             prev.currentHoveredCellForPreview,
                             prev.shipPlacementOrientation
                         );
                         newPreviewCells = previewPositions;
                         newIsPreviewValid = canPreviewPlace;
                     }
                 }


                 return {
                     ...prev,
                     players: newPlayers,
                     selectedShipIdForPlacement: newSelectedShipId,
                     previewCells: newPreviewCells,
                     isPreviewPlacementValid: newIsPreviewValid,
                 };
             });
         } else {
             console.warn("Cannot place ship here.");
         }
    }, [phase, player, selectedShipIdForPlacement, shipPlacementOrientation]);


    const handleConfirmSetup = useCallback(() => {
         if (phase !== 'setup' || !allPlayerShipsPlaced) return;
         setGameState(prev => {
             const newPlayers = { ...prev.players };
             const { newBoard: placedAiBoard, newShips: finalAiShips } = placeShipsRandomly(
                 newPlayers[AI_ID].board,
                 newPlayers[AI_ID].ships
             );
             newPlayers[AI_ID] = { ...newPlayers[AI_ID], board: placedAiBoard, ships: finalAiShips };
             return {
                 ...prev,
                 players: newPlayers,
                 phase: 'playing',
                 currentPlayerId: PLAYER_ID,
                 previewCells: null, // Clear preview when starting game
                 currentHoveredCellForPreview: null,
             };
         });
    }, [phase, allPlayerShipsPlaced]);

     const handlePlayerAttack = useCallback((coord: Coordinate) => {
         if (phase !== 'playing' || currentPlayerId !== PLAYER_ID || gameState.winnerId) return;
          setGameState(prev => {
             const newPlayers = { ...prev.players };
             const aiPlayer = { ...newPlayers[AI_ID] };
             const targetCell = aiPlayer.board[coord.row][coord.col];

             if (targetCell.state === 'hit' || targetCell.state === 'miss' || targetCell.state === 'sunk') {
                 return prev;
             }
             let newCellState: CellState = 'miss';
             if (targetCell.state === 'ship') {
                 newCellState = 'hit';
                 const shipId = targetCell.shipId;
                 if (shipId) {
                     aiPlayer.ships = aiPlayer.ships.map(ship => {
                         if (ship.id === shipId) {
                             const newHits = ship.hits + 1;
                             const isSunk = newHits === ship.size;
                             return { ...ship, hits: newHits, isSunk };
                         }
                         return ship;
                     });
                     const sunkShip = aiPlayer.ships.find(s => s.id === shipId && s.isSunk);
                     if (sunkShip) {
                         sunkShip.positions.forEach(pos => {
                             aiPlayer.board[pos.row][pos.col].state = 'sunk';
                         });
                         newCellState = 'sunk';
                     }
                 }
             }
             aiPlayer.board[coord.row][coord.col].state = newCellState;
             newPlayers[AI_ID] = aiPlayer;
             if (checkWinCondition(aiPlayer.ships)) {
                 return { ...prev, players: newPlayers, phase: 'gameOver', winnerId: PLAYER_ID };
             }
             return { ...prev, players: newPlayers, currentPlayerId: AI_ID };
         });
     }, [phase, currentPlayerId, gameState.winnerId]);

     useEffect(() => {
         if (phase === 'playing' && currentPlayerId === AI_ID && !gameState.winnerId) {
             const timer = setTimeout(() => {
                 setGameState(prev => {
                     const newPlayers = { ...prev.players };
                     const humanPlayer = { ...newPlayers[PLAYER_ID] };
                     let attackCoord: Coordinate;
                     let validAttack = false;
                     do {
                         attackCoord = {
                             row: Math.floor(Math.random() * boardSize),
                             col: Math.floor(Math.random() * boardSize),
                         };
                         const targetCell = humanPlayer.board[attackCoord.row][attackCoord.col];
                         if (targetCell.state !== 'hit' && targetCell.state !== 'miss' && targetCell.state !== 'sunk') {
                             validAttack = true;
                         }
                     } while (!validAttack);

                     const targetCell = humanPlayer.board[attackCoord.row][attackCoord.col];
                     let newCellState: CellState = 'miss';
                     if (targetCell.state === 'ship') {
                         newCellState = 'hit';
                         const shipId = targetCell.shipId;
                         if (shipId) {
                             humanPlayer.ships = humanPlayer.ships.map(ship => {
                                 if (ship.id === shipId) {
                                     const newHits = ship.hits + 1;
                                     const isSunk = newHits === ship.size;
                                     return { ...ship, hits: newHits, isSunk };
                                 }
                                 return ship;
                             });
                             const sunkShip = humanPlayer.ships.find(s => s.id === shipId && s.isSunk);
                             if (sunkShip) {
                                 sunkShip.positions.forEach(pos => {
                                     humanPlayer.board[pos.row][pos.col].state = 'sunk';
                                 });
                                 newCellState = 'sunk';
                             }
                         }
                     }
                     humanPlayer.board[attackCoord.row][attackCoord.col].state = newCellState;
                     newPlayers[PLAYER_ID] = humanPlayer;
                     if (checkWinCondition(humanPlayer.ships)) {
                         return { ...prev, players: newPlayers, phase: 'gameOver', winnerId: AI_ID };
                     }
                     return { ...prev, players: newPlayers, currentPlayerId: PLAYER_ID };
                 });
             }, 1000);
             return () => clearTimeout(timer);
         }
     }, [currentPlayerId, phase, boardSize, gameState.winnerId]);


    const resetGame = () => {
         const initialPlayerShips = createInitialShips();
         const initialPlayerBoard = createInitialBoard(BOARD_SIZE);
         const initialAiShips = createInitialShips();
         const initialAiBoard = createInitialBoard(BOARD_SIZE);

         setGameState({
             phase: 'setup',
             currentPlayerId: PLAYER_ID,
             players: {
                 [PLAYER_ID]: { id: PLAYER_ID, name: 'You', board: initialPlayerBoard, ships: initialPlayerShips, isTurn: true },
                 [AI_ID]: { id: AI_ID, name: 'Computer', board: initialAiBoard, ships: initialAiShips, isTurn: false },
             },
             winnerId: null,
             boardSize: BOARD_SIZE,
             selectedShipIdForPlacement: initialPlayerShips.find(s => !s.isPlaced)?.id || null,
             shipPlacementOrientation: 'horizontal',
             previewCells: null,
             isPreviewPlacementValid: true,
             currentHoveredCellForPreview: null,
         });
    };

    return {
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
    };
}