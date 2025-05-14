import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import Board from './components/Board';
import { generateSudoku } from './utils/sudoku';
import './styles/App.css';

function App() {
  const { t, i18n } = useTranslation();

  const [languageSelected, setLanguageSelected] = useState(false);
  const [board, setBoard] = useState([]);
  const [initialBoard, setInitialBoard] = useState([]);
  const [solution, setSolution] = useState([]);
  const [incorrectCells, setIncorrectCells] = useState([]);
  const [message, setMessage] = useState('');
  const [difficulty, setDifficulty] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setLanguageSelected(true);
  };

  const startGame = (level) => {
    const { solution, puzzle } = generateSudoku(level);
    setSolution(solution);
    setBoard(puzzle);
    setInitialBoard(puzzle);
    setIncorrectCells([]);
    setMessage('');
    setDifficulty(level);
    setGameStarted(true);
  };

  const handleCellChange = (row, col, value) => {
    const newBoard = board.map((r, rowIndex) =>
      r.map((cell, colIndex) => (rowIndex === row && colIndex === col ? value : cell))
    );
    setBoard(newBoard);

    setIncorrectCells((prev) =>
      prev.filter((cell) => !(cell.row === row && cell.col === col))
    );
  };

  const handleCheckAnswer = () => {
    const newIncorrectCells = [];

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const userInput = board[row][col];
        const correctAnswer = solution[row][col];

        if (userInput === '') {
          newIncorrectCells.push({ row, col });
        } else if (parseInt(userInput, 10) !== correctAnswer) {
          newIncorrectCells.push({ row, col });
        }
      }
    }

    setIncorrectCells(newIncorrectCells);
    setMessage(newIncorrectCells.length === 0 ? t('correct') : t('incorrect'));
  };

  const handleResetGame = () => {
    if (window.confirm(t('confirmReset'))) {
      setGameStarted(false);
      setBoard([]);
      setSolution([]);
      setInitialBoard([]);
      setIncorrectCells([]);
      setMessage('');
    }
  };

  const handleClearInputs = () => {
    if (window.confirm(t('confirmClearInputs'))) {
      const clearedBoard = board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (initialBoard[rowIndex][colIndex] === '' ? '' : cell))
      );
      setBoard(clearedBoard);
      setIncorrectCells([]);
      setMessage('');
    }
  };

  if (!languageSelected) {
    return (
      <div className="App">
        <h1>스도쿠 퍼즐 <br /> 数独パズル</h1>
        <p>원하는 언어를 선택하세요 / 言語を選んでください</p>
        <div className="language-buttons">
          <button onClick={() => changeLanguage('ko')}>한국어 / 韓国語</button>
          <button onClick={() => changeLanguage('ja')}>日本語 / 일본어</button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>{t('title')}</h1>

      {!gameStarted ? (
        <>
          <p>{t('selectLevel')}</p>
          <div className="difficulty-buttons">
            <button onClick={() => startGame('easy')}>{t('easy')}</button>
            <button onClick={() => startGame('normal')}>{t('normal')}</button>
            <button onClick={() => startGame('hard')}>{t('hard')}</button>
          </div>
        </>
      ) : (
        <>
          <p>{t('currentLevel')}: {t(difficulty)}</p>

          <Board
            boardData={board}
            initialBoard={initialBoard}
            incorrectCells={incorrectCells}
            onCellChange={handleCellChange}
          />

          <div className="buttons">
            <button onClick={handleCheckAnswer}>{t('checkAnswer')}</button>
            <button onClick={handleClearInputs}>{t('clearInputs')}</button>
            <button onClick={handleResetGame}>{t('reset')}</button>
          </div>

          {message && <p className="result-message">{message}</p>}
        </>
      )}
    </div>
  );
}

export default App;
