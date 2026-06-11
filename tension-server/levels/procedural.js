function rnd(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const QUESTION_BANKS = [
  { id: 1, text: 'What is 8 x 9?',             options: ['63','72','81','56'],              answer: '72' },
  { id: 2, text: 'What is the square root of 64?', options: ['6','7','8','9'],              answer: '8' },
  { id: 3, text: 'How many planets are in our solar system?', options: ['7','8','9','10'], answer: '8' },
  { id: 4, text: 'What is 15% of 200?',         options: ['25','30','35','40'],             answer: '30' },
  { id: 5, text: 'What is H2O?',                options: ['Salt','Water','Air','Sugar'],    answer: 'Water' },
  { id: 6, text: 'What is 2 to the power of 8?', options: ['128','256','512','64'],         answer: '256' },
  { id: 7, text: 'What planet has rings?',       options: ['Jupiter','Mars','Saturn','Neptune'], answer: 'Saturn' },
  { id: 8, text: 'What is 3/4 as a decimal?',   options: ['0.5','0.6','0.7','0.75'],       answer: '0.75' },
];

const COLORS = [0x6ab4f5, 0xf5a623, 0xe94560, 0x9b59b6, 0x2ecc71, 0xcc6633, 0x1abc9c, 0xe67e22];

function generateSection(startZ, startY, type, color) {
  const blocks = [];
  let z = startZ;
  let y = startY;

  if (type === 'gaps') {
    for (let i = 0; i < 5; i++) {
      const w = rnd(3, 6);
      const xOffset = rnd(-4, 4);
      blocks.push({ type: 'platform', x: xOffset, y, z, w, h: 1, d: rnd(3, 5), color });
      z += rnd(6, 10);
    }
  } else if (type === 'rising') {
    for (let i = 0; i < 5; i++) {
      const xOffset = rnd(-4, 4);
      blocks.push({ type: 'platform', x: xOffset, y, z, w: rnd(3, 5), h: 1, d: rnd(3, 5), color });
      z += rnd(7, 11);
      y += rnd(1, 3);
    }
  } else if (type === 'moving') {
    for (let i = 0; i < 4; i++) {
      const axis = pick(['x', 'z']);
      blocks.push({
        type: 'moving', x: 0, y, z, w: rnd(3, 5), h: 1, d: rnd(3, 5), color,
        move: { axis, range: rnd(4, 10), speed: rnd(2, 5) },
      });
      z += rnd(8, 12);
      y += rnd(0, 2);
    }
  } else if (type === 'narrow') {
    for (let i = 0; i < 3; i++) {
      const xOffset = rnd(-3, 3);
      blocks.push({ type: 'platform', x: xOffset, y, z, w: 1.5, h: 1, d: rnd(8, 14), color });
      z += rnd(10, 16);
      y += rnd(0, 3);
    }
  }

  return { blocks, endZ: z, endY: y };
}

function generate(seed = Date.now()) {
  Math.random = (() => {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  })();

  const blocks = [];
  const questions = [];
  let z = 0;
  let y = 0;
  const sectionTypes = ['gaps', 'rising', 'moving', 'narrow', 'moving', 'gaps', 'rising'];
  const numCheckpoints = sectionTypes.length;
  const usedQuestions = [...QUESTION_BANKS].sort(() => Math.random() - 0.5).slice(0, numCheckpoints);

  // Start platform
  blocks.push({ type: 'platform', x: 0, y: 0, z: 0, w: 12, h: 1, d: 12, color: 0x5dbb63 });
  z = 12;

  sectionTypes.forEach((type, i) => {
    const color = COLORS[i % COLORS.length];
    const result = generateSection(z, y, type, color);
    blocks.push(...result.blocks);
    z = result.endZ;
    y = result.endY;

    // Platform + checkpoint + platform + question after each section
    const q = usedQuestions[i];
    questions.push(q);
    blocks.push({ type: 'platform',   x: 0, y, z,     w: 6, h: 1, d: 6, color: 0x2ecc71 });
    blocks.push({ type: 'checkpoint', id: i + 1, x: 0, y, z,     w: 4, h: 3, d: 4 });
    blocks.push({ type: 'platform',   x: 0, y, z: z + 7, w: 6, h: 1, d: 6, color: 0x3498db });
    blocks.push({ type: 'question',   id: i + 1, questionId: q.id, x: 0, y, z: z + 7, w: 4, h: 3, d: 4 });
    z += 14;
  });

  // Finish
  blocks.push({ type: 'finish', x: 0, y, z, w: 10, h: 1, d: 10, color: 0xffd700 });

  return {
    id: `proc_${seed}`,
    name: 'Random Obby',
    type: 'procedural',
    start: { x: 0, y: 2, z: 0 },
    finish: { x: 0, y: y + 1.5, z: z + 5 },
    questions,
    blocks,
  };
}

module.exports = { generate };
