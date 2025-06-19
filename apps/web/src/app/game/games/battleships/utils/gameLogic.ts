import { BoardGrid, CellData, Coordinate, Ship, CellState, ShipOrientation } from './types'; // Add ShipOrientation

export const BOARD_SIZE = 10;

export function createInitialBoard(size: number = BOARD_SIZE): BoardGrid {
    return Array(size)
        .fill(null)
        .map((_, rowIndex) =>
            Array(size)
                .fill(null)
                .map((_, colIndex) => ({
                    id: `${rowIndex}-${colIndex}`,
                    state: 'empty',
                }))
        );
}

export function createInitialShips(): Ship[] {
    return [
        { id: 'carrier', name: 'Carrier', size: 5, positions: [], hits: 0, isSunk: false, isPlaced: false },
        { id: 'battleship', name: 'Battleship', size: 4, positions: [], hits: 0, isSunk: false, isPlaced: false },
        { id: 'cruiser', name: 'Cruiser', size: 3, positions: [], hits: 0, isSunk: false, isPlaced: false },
        { id: 'submarine', name: 'Submarine', size: 3, positions: [], hits: 0, isSunk: false, isPlaced: false },
        { id: 'destroyer', name: 'Destroyer', size: 2, positions: [], hits: 0, isSunk: false, isPlaced: false },
    ];
}

export function canPlaceShip(
    board: BoardGrid,
    ship: Ship,
    startCoord: Coordinate,
    orientation: ShipOrientation
): {canPlace: boolean, positions: Coordinate[]} {
    const positions: Coordinate[] = [];
    for (let i = 0; i < ship.size; i++) {
        const row = orientation === 'horizontal' ? startCoord.row : startCoord.row + i;
        const col = orientation === 'horizontal' ? startCoord.col + i : startCoord.col;

        if (
            row >= BOARD_SIZE ||
            col >= BOARD_SIZE ||
            board[row][col].state === 'ship' // Check for overlap
        ) {
            return { canPlace: false, positions: [] };
        }
        positions.push({ row, col });
    }
    return { canPlace: true, positions };
}

// Basic random ship placement for AI or initial setup
export function placeShipsRandomly(board: BoardGrid, ships: Ship[]): { newBoard: BoardGrid; newShips: Ship[] } {
    let newBoard = JSON.parse(JSON.stringify(board)); // Deep clone
    let newShips = JSON.parse(JSON.stringify(ships)) as Ship[];

    newShips.forEach(ship => {
        if (ship.isPlaced) return;

        let placed = false;
        while (!placed) {
            const orientation: ShipOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
            const startRow = Math.floor(Math.random() * BOARD_SIZE);
            const startCol = Math.floor(Math.random() * BOARD_SIZE);

            const validation = canPlaceShip(newBoard, ship, {row: startRow, col: startCol}, orientation);

            if (validation.canPlace) {
                validation.positions.forEach(pos => {
                    newBoard[pos.row][pos.col].state = 'ship';
                    newBoard[pos.row][pos.col].shipId = ship.id;
                });
                ship.positions = validation.positions;
                ship.isPlaced = true; // Mark as placed
                placed = true;
            }
        }
    });
    return { newBoard, newShips };
}

export function checkWinCondition(ships: Ship[]): boolean {
    return ships.every(ship => ship.isSunk);
}