const initBoardData = () => {
  const rows = 6;
  const cols = 7;
  const array2D = new Array(rows);

  for (let i = 0; i < rows; i++) {
    array2D[i] = new Array(cols).fill(0);
  }

  return array2D;
};

export default initBoardData;