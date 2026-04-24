window.GOL = { N : 5 , fps : 50};

const SYMBOLS = {
  cell:  '░',
  void:  ' ',
};

let grid, CELL, gameActive, loopInterval;

function golInit() {
  grid       = Array.from(Array(window.GOL.N), () => new Array(window.GOL.N).fill(SYMBOLS.void)); //initiating grid, an array of array
  gameActive = true;                                                          //strating simulation
  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(golLoop, window.GOL.fps);                      //setting fps
  console.log(grid);
}

function SpawnCells() {
  CELL = Array.from(Array(10*window.GOL.N), () => new Array(2));
  CELL.forEach((element) => {
    element[0] = Math.floor(Math.random() * window.GOL.N);
    element[1] = Math.floor(Math.random() * window.GOL.N);
  });
  CELL = Array.from(new Set(CELL.map(JSON.stringify)), JSON.parse);
  CELL.forEach((element) => {
      grid[element[0]][element[1]]=SYMBOLS.cell;
    });

}



function nb_voisin(x, y) {
  var s = 0 ;
  let i_,j_ ;
  for (let i = -1; i <2 ; i++) {
    for (let j = -1; j <2 ; j++) {
      if (!( i === 0 && j === 0 )) {
        i_ = Math.floor(i+x) ; j_ = Math.floor(j+y);
        if ((i_ > -1 && i_ < window.GOL.N) && (j_ > -1 && j_ < window.GOL.N)) {
          if (grid[i_][j_] === SYMBOLS.cell) s += 1;
        }
      }
    }
  }
  return s;
  //get number of neighboors
}

function vivre_ou_mourir(CELL, grid) {
  let CELL_ = [];
  let grid_ = Array.from(Array(window.GOL.N), () => new Array(window.GOL.N).fill(SYMBOLS.void));
  let i_, j_, s;
  CELL.forEach((element) => {
      for (let i = -1; i <2 ; i++) {
        for (let j = -1; j <2 ; j++) {
          if (!( i === 0 && j === 0 )) {
            i_ = Math.floor(i+element[0]) ; j_ = Math.floor(j+element[1]);
            if ((i_ > -1 && i_ < window.GOL.N) && (j_ > -1 && j_ < window.GOL.N)) {
              if (grid[i_][j_] === SYMBOLS.cell ) {
                s = nb_voisin(i_, j_);
                if (s===3 || s===2 ) {
                  grid_[i_][j_]=SYMBOLS.cell;
                  CELL_.push([i_,j_]);
                }
              }
              else {
                s = nb_voisin(i_, j_);
                  if (s===3) {
                    grid_[i_][j_]=SYMBOLS.cell;
                    CELL_.push([i_,j_]);
                  }
              }
            }
          }
        }
      }
    });
  CELL_ = Array.from(new Set(CELL_.map(JSON.stringify)), JSON.parse);
  return { grid: grid_, CELL: CELL_ }
  //does game of life
}

function renderGOL() {
  const text = grid.map(row => row.join('')).join('\n');
  window.GOL_OUTPUT(text);
}

function golLoop() {
  if (!gameActive) return;
  const result = vivre_ou_mourir(CELL, grid);
  grid = result.grid;
  CELL = result.CELL;
  renderGOL();
}

function golStart() {
  golInit();
  SpawnCells();
  renderGOL();
}
window.golStart = golStart;