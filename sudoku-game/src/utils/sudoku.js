// src/utils/sudoku.js

// 배열 섞기 유틸 (Fisher-Yates)
const shuffle = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 유효한 값인지 체크
const isSafe = (board, row, col, num) => {
  for (let i = 0; i < 9; i++) {
    if (
      board[row][i] === num || // 가로 체크
      board[i][col] === num || // 세로 체크
      board[3 * Math.floor(row / 3) + Math.floor(i / 3)][
        3 * Math.floor(col / 3) + (i % 3)
      ] === num // 3x3 박스 체크
    ) {
      return false;
    }
  }
  return true;
};

// 스도쿠 풀이 (백트래킹 재귀)
export const solveBoard = (board) => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === '') {
        for (let num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isSafe(board, row, col, num)) {
            board[row][col] = num;
            if (solveBoard(board)) return true;
            board[row][col] = '';
          }
        }
        return false;
      }
    }
  }
  return true;
};

// 정답 보드 생성
export const createSolutionBoard = () => {
  const board = Array(9).fill(0).map(() => Array(9).fill(''));
  solveBoard(board); // 완성된 정답 보드 생성
  return board;
};

// 빈칸 만들기 (난이도 조절)
export const removeCells = (board, difficulty = 'easy') => {
  const newBoard = board.map(row => [...row]);
  let attempts = difficulty === 'hard' ? 55 : difficulty === 'normal' ? 45 : 35;

  while (attempts > 0) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);

    if (newBoard[row][col] !== '') {
      newBoard[row][col] = '';
      attempts--;
    }
  }

  return newBoard;
};

// 퍼즐 전체 생성 (정답 + 퍼즐 반환)
export const generateSudoku = (difficulty = 'easy') => {
  const solutionBoard = createSolutionBoard();
  const puzzleBoard = removeCells(solutionBoard, difficulty);

  return {
    solution: solutionBoard,
    puzzle: puzzleBoard
  };
};
