import React from 'react';

const Cell = ({ value, row, col, isFixed, isIncorrect, onChange }) => {
  const handleChange = (e) => {
    const newValue = parseInt(e.target.value, 10) || '';
    onChange(row, col, newValue);
  };

  return (
    <input
      className={`sudoku-cell ${isFixed ? 'fixed-cell' : ''} ${isIncorrect ? 'incorrect-cell' : ''}`}
      type="text"
      value={value || ''}
      onChange={handleChange}
      maxLength={1}
      disabled={isFixed}
    />
  );
};

export default Cell;
