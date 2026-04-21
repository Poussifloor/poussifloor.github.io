const H = 20;
const L = 40;
const gridSize = H * L;
const SYMBOLS = {
  head:  'O',
  body:  'x',
  apple: '@',
  empty: '.',
};

let grid, snake, food, direction, score, gameActive, loopInterval;

function snakeInit() {
  grid       = Array(gridSize).fill(SYMBOLS.empty);
  snake      = [Math.floor(H / 2) * L + Math.floor(L / 2)];
  direction  = 'RIGHT';
  score      = 0;
  gameActive = true;
  snakeSpawnFood();
  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(snakeLoop, 150);
}

function snakeSpawnFood() {
  let pos;
  do { pos = Math.floor(Math.random() * gridSize); }
  while (snake.includes(pos));
  food = pos;
}

function snakeSpeedUp() {
  clearInterval(loopInterval);
  const delay = Math.max(60, 150 * Math.pow(0.95, score)); // faster each point, min 60ms
  loopInterval = setInterval(snakeLoop, delay);
}


function snakeMove() {
  const head = snake[0];
  let next;
  if (direction === 'UP')    next = head - L;
  if (direction === 'DOWN')  next = head + L;
  if (direction === 'LEFT')  next = head - 1;
  if (direction === 'RIGHT') next = head + 1;
  snake.unshift(next);
  snakeSpeedUp();
  if (next === food) { score++; snakeSpawnFood(); }
  else snake.pop();
}

function snakeCheckOver() {
  const head = snake[0];
  const col  = head % L;
  if (head < 0 || head >= gridSize)          return true;
  if (col === L - 1 && direction === 'RIGHT') return true;
  if (col === 0     && direction === 'LEFT')  return true;
  for (let i = 1; i < snake.length; i++) {
    if (snake[i] === head) return true;
  }
  return false;
}

function snakeRender() {
  grid = Array(gridSize).fill(SYMBOLS.empty);
  grid[food] = SYMBOLS.apple;
  for (let i = 1; i < snake.length; i++) grid[snake[i]] = SYMBOLS.body;
  grid[snake[0]] = SYMBOLS.head;

  let out = 'score: ' + score + '\n\n';
  for (let i = 0; i < H; i++) {
    out += grid.slice(i * L, i * L + L).join('') + '\n';
  }
  out += '\narrows to move  |  q to quit';
  window.SNAKE_OUTPUT(out);
}

function snakeOver() {
  clearInterval(loopInterval);
  gameActive = false;
  window.SNAKE_OUTPUT(
    'GAME OVER\nscore: ' + score + '\n\n' + "type 'snake run' to play again"
  );
  setTimeout(() => { if (window.SNAKE_DONE) window.SNAKE_DONE(); }, 2000);
}

function snakeLoop() {
  snakeMove();
  if (snakeCheckOver()) { snakeOver(); return; }
  snakeRender();
}

window.addEventListener('keydown', e => {
  if (!gameActive) return;
  const dirs = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  if (dirs.includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowUp'    && direction !== 'DOWN')  direction = 'UP';
  if (e.key === 'ArrowDown'  && direction !== 'UP')    direction = 'DOWN';
  if (e.key === 'ArrowLeft'  && direction !== 'RIGHT') direction = 'LEFT';
  if (e.key === 'ArrowRight' && direction !== 'LEFT')  direction = 'RIGHT';
  if (e.key === 'q' || e.key === 'Q') snakeOver();
});

window.snakeStart = snakeInit;