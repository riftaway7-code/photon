module.exports = {
  id: 'sample',
  name: 'Classic Obby',
  type: 'teacher',
  start: { x: 0, y: 2, z: 0 },
  finish: { x: 0, y: 26, z: 170 },
  questions: [
    { id: 1, text: 'What is 6 x 7?', options: ['36', '42', '48', '56'], answer: '42' },
    { id: 2, text: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], answer: 'Carbon Dioxide' },
    { id: 3, text: 'What is 144 ÷ 12?', options: ['10', '11', '12', '13'], answer: '12' },
    { id: 4, text: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: '7' },
    { id: 5, text: 'What is the capital of France?', options: ['London', 'Berlin', 'Madrid', 'Paris'], answer: 'Paris' },
  ],
  blocks: [
    // Start platform
    { type: 'platform', x: 0,   y: 0,  z: 0,   w: 12, h: 1, d: 12, color: 0x5dbb63 },

    // Section 1: simple gaps
    { type: 'platform', x: 0,   y: 0,  z: 13,  w: 5,  h: 1, d: 5,  color: 0x6ab4f5 },
    { type: 'platform', x: 3,   y: 0,  z: 20,  w: 5,  h: 1, d: 5,  color: 0x6ab4f5 },
    { type: 'platform', x: -2,  y: 0,  z: 27,  w: 5,  h: 1, d: 5,  color: 0x6ab4f5 },
    { type: 'platform', x: 1,   y: 0,  z: 34,  w: 5,  h: 1, d: 5,  color: 0x6ab4f5 },

    // Checkpoint 1 + platform under it
    { type: 'platform',    x: 0, y: 0,  z: 40,  w: 6,  h: 1, d: 6,  color: 0x2ecc71 },
    { type: 'checkpoint',  id: 1, x: 0, y: 0,   z: 40, w: 4, h: 3,  d: 4 },
    { type: 'platform',    x: 0, y: 0,  z: 47,  w: 6,  h: 1, d: 6,  color: 0x3498db },
    { type: 'question',    id: 1, questionId: 1, x: 0, y: 0, z: 47, w: 4, h: 3, d: 4 },

    // Section 2: rising platforms
    { type: 'platform', x: 0,   y: 2,  z: 56,  w: 4,  h: 1, d: 4,  color: 0xf5a623 },
    { type: 'platform', x: -3,  y: 4,  z: 64,  w: 4,  h: 1, d: 4,  color: 0xf5a623 },
    { type: 'platform', x: 2,   y: 6,  z: 72,  w: 4,  h: 1, d: 4,  color: 0xf5a623 },
    { type: 'platform', x: 0,   y: 8,  z: 80,  w: 6,  h: 1, d: 6,  color: 0xf5a623 },

    // Checkpoint 2 + platform under it
    { type: 'platform',   x: 0, y: 8,  z: 86,  w: 6,  h: 1, d: 6,  color: 0x2ecc71 },
    { type: 'checkpoint', id: 2, x: 0, y: 8,   z: 86, w: 4, h: 3,  d: 4 },
    { type: 'platform',   x: 0, y: 8,  z: 93,  w: 6,  h: 1, d: 6,  color: 0x3498db },
    { type: 'question',   id: 2, questionId: 2, x: 0, y: 8, z: 93, w: 4, h: 3, d: 4 },

    // Section 3: moving platforms
    { type: 'moving', x: 0,  y: 10, z: 102, w: 5, h: 1, d: 5, color: 0xe94560, move: { axis: 'x', range: 6,  speed: 1.2 } },
    { type: 'moving', x: 0,  y: 12, z: 112, w: 5, h: 1, d: 5, color: 0xe94560, move: { axis: 'x', range: 5,  speed: 1.5 } },
    { type: 'moving', x: 0,  y: 14, z: 122, w: 5, h: 1, d: 5, color: 0xe94560, move: { axis: 'x', range: 7,  speed: 1.8 } },
    { type: 'platform', x: 0, y: 14, z: 130, w: 6, h: 1, d: 6, color: 0x9b59b6 },

    // Checkpoint 3 + platform under it
    { type: 'platform',   x: 0, y: 14, z: 136, w: 6,  h: 1, d: 6,  color: 0x2ecc71 },
    { type: 'checkpoint', id: 3, x: 0, y: 14,  z: 136, w: 4, h: 3, d: 4 },
    { type: 'platform',   x: 0, y: 14, z: 143, w: 6,  h: 1, d: 6,  color: 0x3498db },
    { type: 'question',   id: 3, questionId: 3, x: 0, y: 14, z: 143, w: 4, h: 3, d: 4 },

    // Section 4: narrow beams
    { type: 'platform', x: 0,  y: 16, z: 150, w: 1.5, h: 1, d: 12, color: 0xcc6633 },
    { type: 'platform', x: 3,  y: 18, z: 160, w: 1.5, h: 1, d: 8,  color: 0xcc6633 },
    { type: 'platform', x: -2, y: 20, z: 168, w: 4,   h: 1, d: 4,  color: 0xcc6633 },

    // Checkpoint 4 + platform under it
    { type: 'platform',   x: -2, y: 20, z: 174, w: 6,  h: 1, d: 6,  color: 0x2ecc71 },
    { type: 'checkpoint', id: 4, x: -2, y: 20,  z: 174, w: 4, h: 3, d: 4 },
    { type: 'platform',   x: -2, y: 20, z: 181, w: 6,  h: 1, d: 6,  color: 0x3498db },
    { type: 'question',   id: 4, questionId: 4, x: -2, y: 20, z: 181, w: 4, h: 3, d: 4 },

    // Final moving platforms
    { type: 'moving', x: -2, y: 22, z: 190, w: 5, h: 1, d: 5, color: 0x2ecc71, move: { axis: 'z', range: 4, speed: 1.5 } },
    { type: 'moving', x: 2,  y: 24, z: 200, w: 5, h: 1, d: 5, color: 0x2ecc71, move: { axis: 'z', range: 4, speed: 1.2 } },

    // Finish platform
    { type: 'finish', x: 0, y: 26, z: 210, w: 10, h: 1, d: 10, color: 0xffd700 },
  ],
};
