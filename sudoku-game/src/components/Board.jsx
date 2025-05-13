import React from 'react';
import Cell from './Cell';
import '../styles/Board.css';  // 경로 맞게 수정

const Board = ({ boardData, initialBoard, incorrectCells, onCellChange }) => {
  return (
    <div className="sudoku-board">
      {boardData.map((row, rowIndex) => (
        <div className="sudoku-row" key={rowIndex}>
          {row.map((cellValue, colIndex) => {
            const isFixed = initialBoard[rowIndex][colIndex] !== '';  // 초기 고정 셀
            const isIncorrect = incorrectCells.some(
              (cell) => cell.row === rowIndex && cell.col === colIndex
            );  // 틀린 셀 여부

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
          })}
        </div>
      ))}
    </div>
  );
};

export default Board;
