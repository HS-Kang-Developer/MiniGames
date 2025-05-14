import React from 'react';
import Cell from './Cell';
import '../styles/Board.css';  // 경로 맞게 유지

const Board = ({ boardData, initialBoard, incorrectCells, onCellChange }) => {
  return (
    <div className="sudoku-board">
      {Array.from({ length: 9 }).map((_, blockIndex) => {
        const blockRow = Math.floor(blockIndex / 3);
        const blockCol = blockIndex % 3;

        return (
          <div className="sudoku-block" key={blockIndex}>
            {Array.from({ length: 3 }).map((_, innerRow) =>
              Array.from({ length: 3 }).map((_, innerCol) => {
                const rowIndex = blockRow * 3 + innerRow;
                const colIndex = blockCol * 3 + innerCol;
                const cellValue = boardData[rowIndex][colIndex];
                const isFixed = initialBoard[rowIndex][colIndex] !== '';
                const isIncorrect = incorrectCells.some(
                  (cell) => cell.row === rowIndex && cell.col === colIndex
                );

                return (
                  <Cell
                    key={`${rowIndex}-${colIndex}`}
                    value={cellValue}
                    row={rowIndex}
                    col={colIndex}
                    isFixed={isFixed}
                    isIncorrect={isIncorrect}
                    onChange={onCellChange}
                  />
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Board;
