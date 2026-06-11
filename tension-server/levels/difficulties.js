const QUESTION_BANKS = [
  { id: 1,  text: 'What is 8 x 9?',                    options: ['63','72','81','56'],                         answer: '72' },
  { id: 2,  text: 'Square root of 64?',                 options: ['6','7','8','9'],                             answer: '8' },
  { id: 3,  text: 'How many planets in our solar system?', options: ['7','8','9','10'],                         answer: '8' },
  { id: 4,  text: 'What is 15% of 200?',                options: ['25','30','35','40'],                         answer: '30' },
  { id: 5,  text: 'What is H2O?',                       options: ['Salt','Water','Air','Sugar'],                answer: 'Water' },
  { id: 6,  text: '2 to the power of 8?',               options: ['128','256','512','64'],                     answer: '256' },
  { id: 7,  text: 'What planet has rings?',              options: ['Jupiter','Mars','Saturn','Neptune'],        answer: 'Saturn' },
  { id: 8,  text: '3/4 as a decimal?',                  options: ['0.5','0.6','0.7','0.75'],                   answer: '0.75' },
  { id: 9,  text: 'Capital of Japan?',                  options: ['Seoul','Beijing','Tokyo','Bangkok'],         answer: 'Tokyo' },
  { id: 10, text: 'What is the speed of light (km/s)?', options: ['150,000','200,000','300,000','400,000'],     answer: '300,000' },
  { id: 11, text: 'How many sides does a hexagon have?',options: ['5','6','7','8'],                             answer: '6' },
  { id: 12, text: 'What gas do plants produce?',        options: ['CO2','Nitrogen','Oxygen','Hydrogen'],        answer: 'Oxygen' },
  { id: 13, text: 'Largest ocean on Earth?',            options: ['Atlantic','Indian','Arctic','Pacific'],      answer: 'Pacific' },
  { id: 14, text: 'What is 17 x 17?',                  options: ['256','289','300','324'],                     answer: '289' },
  { id: 15, text: 'Chemical symbol for gold?',          options: ['Gd','Go','Au','Ag'],                        answer: 'Au' },
  { id: 16, text: 'How many bones in the human body?',  options: ['196','206','216','226'],                     answer: '206' },
  { id: 17, text: 'What is 12³?',                      options: ['1344','1728','1152','2048'],                  answer: '1728' },
  { id: 18, text: 'Year World War II ended?',           options: ['1943','1944','1945','1946'],                 answer: '1945' },
  { id: 19, text: 'Fastest land animal?',               options: ['Lion','Cheetah','Falcon','Horse'],           answer: 'Cheetah' },
  { id: 20, text: 'How many degrees in a full circle?', options: ['180','270','360','90'],                      answer: '360' },
];

const DIFFICULTY_NAMES = ['Easy', 'Medium', 'Hard', 'Expert', 'Extreme', 'Insane'];
const DIFFICULTY_COLORS = [0x2ecc71, 0x3498db, 0xf5a623, 0xe94560, 0x9b59b6, 0xff0033];

// Scale params per difficulty level (0=Easy, 5=Insane)
const DIFF = [
  { platW: [3.5, 6],  platD: [3.5, 5.5], gap: [6, 9],   rise: [1,2.5], movSpeed: [1.5,3.5], movRange: [4,8],  narrowW: 1.5,  narrowD: [8,13],  narrowGap: [10,14] },
  { platW: [3,   5],  platD: [3,   5],   gap: [7, 10],  rise: [1,3],   movSpeed: [2,4.5],   movRange: [5,9],  narrowW: 1.3,  narrowD: [8,14],  narrowGap: [11,15] },
  { platW: [2.5, 4.5],platD: [2.5, 4.5], gap: [8, 12],  rise: [1.5,3.5],movSpeed:[2.5,6],   movRange: [5,10], narrowW: 1.1,  narrowD: [9,14],  narrowGap: [12,16] },
  { platW: [2,   4],  platD: [2,   4],   gap: [9, 13],  rise: [2,4],   movSpeed: [3,7],     movRange: [6,11], narrowW: 0.9,  narrowD: [10,15], narrowGap: [13,17] },
  { platW: [1.5, 3.5],platD: [1.5, 3.5], gap: [10, 15], rise: [2,5],   movSpeed: [4,9],     movRange: [7,12], narrowW: 0.75, narrowD: [11,16], narrowGap: [14,18] },
  { platW: [1.2, 3],  platD: [1.2, 3],   gap: [12, 18], rise: [2.5,6], movSpeed: [6,13],    movRange: [8,14], narrowW: 0.6,  narrowD: [12,18], narrowGap: [15,20] },
];

const COLORS = [0x6ab4f5, 0xf5a623, 0xe94560, 0x9b59b6, 0x2ecc71, 0xcc6633, 0x1abc9c, 0xe67e22];

function rnd(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateSection(startZ, startY, type, color, d) {
  const blocks = [];
  let z = startZ, y = startY;

  if (type === 'gaps') {
    for (let i = 0; i < 5; i++) {
      blocks.push({ type: 'platform', x: rnd(-4,4), y, z,
        w: rnd(...d.platW), h: 1, d: rnd(...d.platD), color });
      z += rnd(...d.gap);
    }
  } else if (type === 'rising') {
    for (let i = 0; i < 5; i++) {
      blocks.push({ type: 'platform', x: rnd(-4,4), y, z,
        w: rnd(...d.platW), h: 1, d: rnd(...d.platD), color });
      z += rnd(7, 11);
      y += rnd(...d.rise);
    }
  } else if (type === 'moving') {
    for (let i = 0; i < 4; i++) {
      blocks.push({ type: 'moving', x: 0, y, z,
        w: rnd(...d.platW), h: 1, d: rnd(...d.platD), color,
        move: { axis: pick(['x','z']), range: rnd(...d.movRange), speed: rnd(...d.movSpeed) } });
      z += rnd(8, 12);
      y += rnd(0, 2);
    }
  } else if (type === 'narrow') {
    for (let i = 0; i < 3; i++) {
      blocks.push({ type: 'platform', x: rnd(-3,3), y, z,
        w: d.narrowW, h: 1, d: rnd(...d.narrowD), color });
      z += rnd(...d.narrowGap);
      y += rnd(0, 3);
    }
  }

  return { blocks, endZ: z, endY: y };
}

function generateForDifficulty(rebirth) {
  const level = Math.min(rebirth, 5);
  const d = DIFF[level];
  const name = DIFFICULTY_NAMES[level];
  const startColor = DIFFICULTY_COLORS[level];

  const blocks = [];
  const questions = [];
  let z = 0, y = 0;

  const sectionTypes = ['gaps','rising','moving','narrow','moving','gaps','rising'];
  const usedQs = [...QUESTION_BANKS].sort(() => Math.random() - 0.5).slice(0, sectionTypes.length);

  // Start platform with difficulty label
  blocks.push({ type: 'platform', x: 0, y: 0, z: 0, w: 12, h: 1, d: 12, color: startColor });
  blocks.push({ type: 'difficulty_sign', label: name, x: 0, y: 1, z: 0 });
  z = 12;

  sectionTypes.forEach((type, i) => {
    const color = COLORS[i % COLORS.length];
    const result = generateSection(z, y, type, color, d);
    blocks.push(...result.blocks);
    z = result.endZ;
    y = result.endY;

    const q = usedQs[i];
    questions.push(q);
    blocks.push({ type: 'platform',   x: 0, y, z,     w: 6, h: 1, d: 6, color: 0x2ecc71 });
    blocks.push({ type: 'checkpoint', id: i + 1, x: 0, y, z, w: 4, h: 3, d: 4 });
    blocks.push({ type: 'platform',   x: 0, y, z: z+7, w: 6, h: 1, d: 6, color: 0x3498db });
    blocks.push({ type: 'question',   id: i+1, questionId: q.id, x: 0, y, z: z+7, w: 4, h: 3, d: 4 });
    z += 14;
  });

  blocks.push({ type: 'finish', x: 0, y, z, w: 10, h: 1, d: 10, color: 0xffd700 });

  return {
    id: `diff_${level}_${Date.now()}`,
    name: `${name} Obby`,
    type: 'procedural',
    difficulty: level,
    difficultyName: name,
    start: { x: 0, y: 2, z: 0 },
    finish: { x: 0, y: y + 1.5, z: z + 5 },
    questions,
    blocks,
  };
}

module.exports = { generateForDifficulty, DIFFICULTY_NAMES, DIFFICULTY_COLORS };
