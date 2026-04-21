window.SNAKE = { H: 20, L: 40, s: 5, fps_min: 60 };

const SYMBOLS = {
  head:  'O',
  body:  'x',
  apple: '@',
  empty: '.',
};

let grid, snake, food, direction, score, gameActive, loopInterval;

function snakeInit() {
  grid       = Array(window.SNAKE.H * window.SNAKE.L).fill(SYMBOLS.empty);
  snake      = [Math.floor(window.SNAKE.H / 2) * window.SNAKE.L + Math.floor(window.SNAKE.L / 2)];
  direction  = 'RIGHT';
  score      = 0;
  gameActive = true;
  snakeSpawnFood();
  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(snakeLoop, 150);
}

function snakeSpawnFood() {
  let pos;
  do { pos = Math.floor(Math.random() * window.SNAKE.H * window.SNAKE.L); }
  while (snake.includes(pos));
  food = pos;
}

function snakeSpeedUp() {
  clearInterval(loopInterval);
  const delay = Math.max(window.SNAKE.fps_min, 150 * Math.pow(1-window.SNAKE.s/100, score)); // faster each point, min fps_min ms
  loopInterval = setInterval(snakeLoop, delay);
}


function snakeMove() {
  const head = snake[0];
  let next;
  if (direction === 'UP')    next = head - window.SNAKE.L;
  if (direction === 'DOWN')  next = head + window.SNAKE.L;
  if (direction === 'LEFT')  next = head - 1;
  if (direction === 'RIGHT') next = head + 1;
  snake.unshift(next);
  if (next === food) { score++; snakeSpeedUp(); snakeSpawnFood(); }
  else snake.pop();
}

function snakeCheckOver() {
  const head = snake[0];
  const col  = head % window.SNAKE.L;
  if (head < 0 || head >= window.SNAKE.H * window.SNAKE.L)  return true;
  if (col === window.SNAKE.L - 1 && direction === 'RIGHT')  return true;
  if (col === 0     && direction === 'LEFT')                return true;
  for (let i = 1; i < snake.length; i++) {
    if (snake[i] === head)                                  return true;
  }
  return false;
}

function snakeRender() {
  grid = Array(window.SNAKE.H * window.SNAKE.L).fill(SYMBOLS.empty);
  grid[food] = SYMBOLS.apple;
  for (let i = 1; i < snake.length; i++) grid[snake[i]] = SYMBOLS.body;
  grid[snake[0]] = SYMBOLS.head;

  let out = 'score: ' + score + '\n\n';
  for (let i = 0; i < window.SNAKE.H; i++) {
    out += grid.slice(i * window.SNAKE.L, i * window.SNAKE.L + window.SNAKE.L).join('') + '\n';
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
  if (snakeCheckOver()) { snakeOver(); return; }
  snakeMove();
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