export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';
export type Coordinate = { row: number; col: number };

export interface CellData {
    id: string;
    state: CellState;
    shipId?: string; // ID of the ship occupying this cell
}

export type BoardGrid = CellData[][];

export interface Ship {
    id: string;
    name: string;
    size: number;
    positions: Coordinate[];
    hits: number;
    isSunk: boolean;
}

export type GamePhase = 'setup' | 'playing' | 'gameOver';

export interface Player {
    id: string;
    name: string;
    board: BoardGrid;
    ships: Ship[];
    isTurn: boolean;
}

export interface GameState {
    phase: GamePhase;
    currentPlayerId: string; // ID of the player whose turn it is
    players: { [playerId: string]: Player };
    winnerId?: string | null;
    boardSize: number;
}

export type ShipOrientation = 'horizontal' | 'vertical';

export interface Ship {
    id: string;
    name: string;
    size: number;
    positions: Coordinate[];
    hits: number;
    isSunk: boolean;
    isPlaced: boolean; // New property
}

export interface GameState {
    phase: GamePhase;
    currentPlayerId: string;
    players: { [playerId: string]: Player };
    winnerId?: string | null;
    boardSize: number;
    selectedShipIdForPlacement: string | null;
    shipPlacementOrientation: ShipOrientation;
}

export interface GameState {
    phase: GamePhase;
    currentPlayerId: string;
    players: { [playerId: string]: Player };
    winnerId?: string | null;
    boardSize: number;
    selectedShipIdForPlacement: string | null;
    shipPlacementOrientation: ShipOrientation;
    previewCells: Coordinate[] | null;
    isPreviewPlacementValid: boolean;
    currentHoveredCellForPreview: Coordinate | null;
}