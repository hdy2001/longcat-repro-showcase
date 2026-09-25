/* ===== Furious Birds — level definitions =====
   Coordinates: y is the BOTTOM edge of a piece (it rests on y).
   GROUND surface is at y = 668. */

const LEVELS = [
  {
    name: 'The Fortress',
    birds: ['red', 'yellow', 'blue', 'red', 'yellow', 'red'],
    build() {
      const blocks = [
        makeBlock(880, 668, 260, 30, 'stone'),            // foundation
        makeBlock(795, 638, 26, 80, 'wood'),
        makeBlock(965, 638, 26, 80, 'wood'),
        makeBlock(880, 558, 250, 24, 'wood'),             // floor 1 platform
        makeBlock(810, 534, 24, 78, 'wood'),
        makeBlock(950, 534, 24, 78, 'wood'),
        makeBlock(880, 456, 240, 28, 'stone'),            // floor 2 platform
        makeBlock(830, 428, 22, 78, 'stone'),
        makeBlock(930, 428, 22, 78, 'stone'),
        makeBlock(880, 350, 200, 26, 'wood')              // roof
      ];
      const pigs = [
        makePig(830, 638), makePig(930, 638),             // ground floor
        makePig(880, 520),                                // second floor
        makePig(880, 413),                                // attic
        makePig(880, 310)                                 // rooftop
      ];
      return { blocks, pigs };
    }
  },
  {
    name: 'Stone Tower',
    birds: ['red', 'yellow', 'black', 'blue', 'red', 'yellow'],
    build() {
      const blocks = [
        makeBlock(950, 668, 200, 30, 'stone'),
        makeBlock(880, 638, 24, 120, 'wood'),
        makeBlock(1020, 638, 24, 120, 'wood'),
        makeBlock(950, 518, 220, 26, 'stone'),
        makeBlock(890, 492, 22, 120, 'wood'),
        makeBlock(1010, 492, 22, 120, 'wood'),
        makeBlock(950, 372, 210, 26, 'wood'),
        makeBlock(896, 346, 24, 120, 'stone'),
        makeBlock(1004, 346, 24, 120, 'stone'),
        makeBlock(950, 226, 190, 26, 'stone')              // top slab
      ];
      const pigs = [
        makePig(950, 623),
        makePig(950, 477),
        makePig(923, 331), makePig(977, 331),
        makePig(950, 186)
      ];
      return { blocks, pigs };
    }
  },
  {
    name: 'Twin Forts',
    birds: ['red', 'yellow', 'black', 'blue', 'red', 'yellow', 'blue'],
    build() {
      const blocks = [
        // left wooden fort
        makeBlock(770, 668, 170, 26, 'wood'),
        makeBlock(720, 642, 22, 70, 'wood'),
        makeBlock(820, 642, 22, 70, 'wood'),
        makeBlock(770, 572, 180, 22, 'wood'),
        makeBlock(728, 550, 20, 70, 'wood'),
        makeBlock(812, 550, 20, 70, 'wood'),
        makeBlock(770, 480, 170, 20, 'wood'),
        // right stone fort
        makeBlock(1010, 668, 210, 30, 'stone'),
        makeBlock(940, 638, 24, 100, 'stone'),
        makeBlock(1080, 638, 24, 100, 'stone'),
        makeBlock(1010, 538, 220, 26, 'wood'),
        makeBlock(950, 512, 22, 90, 'wood'),
        makeBlock(1070, 512, 22, 90, 'wood'),
        makeBlock(1010, 422, 200, 24, 'stone')
      ];
      const pigs = [
        makePig(770, 627),
        makePig(752, 535), makePig(788, 535),
        makePig(1010, 623),
        makePig(975, 497), makePig(1045, 497),
        makePig(1010, 384)
      ];
      return { blocks, pigs };
    }
  },
  {
    name: 'Glass House',
    birds: ['yellow', 'black', 'red', 'blue', 'yellow', 'red', 'black'],
    build() {
      const blocks = [
        makeBlock(1000, 668, 240, 30, 'stone'),
        makeBlock(920, 638, 24, 90, 'stone'),
        makeBlock(1080, 638, 24, 90, 'stone'),
        makeBlock(1000, 548, 230, 26, 'wood'),
        makeBlock(930, 522, 20, 90, 'glass'),
        makeBlock(1070, 522, 20, 90, 'glass'),
        makeBlock(1000, 432, 210, 24, 'glass'),
        makeBlock(940, 408, 22, 90, 'wood'),
        makeBlock(1060, 408, 22, 90, 'wood'),
        makeBlock(1000, 318, 200, 26, 'stone')
      ];
      const pigs = [
        makePig(1000, 623),
        makePig(960, 507), makePig(1000, 507), makePig(1040, 507),
        makePig(1000, 393),
        makePig(970, 277), makePig(1030, 277)
      ];
      return { blocks, pigs };
    }
  },
  {
    name: 'The Citadel',
    birds: ['red', 'yellow', 'black', 'blue', 'black', 'yellow', 'red', 'blue'],
    build() {
      const blocks = [
        // left tower
        makeBlock(760, 668, 150, 26, 'wood'),
        makeBlock(715, 642, 22, 90, 'wood'),
        makeBlock(805, 642, 22, 90, 'wood'),
        makeBlock(760, 552, 160, 22, 'wood'),
        // center tower
        makeBlock(980, 668, 200, 30, 'stone'),
        makeBlock(915, 638, 24, 110, 'stone'),
        makeBlock(1045, 638, 24, 110, 'stone'),
        makeBlock(980, 528, 210, 26, 'wood'),
        makeBlock(922, 502, 22, 110, 'wood'),
        makeBlock(1038, 502, 22, 110, 'wood'),
        makeBlock(980, 392, 200, 26, 'stone'),
        makeBlock(945, 366, 20, 80, 'wood'),
        makeBlock(1015, 366, 20, 80, 'wood'),
        makeBlock(980, 286, 160, 22, 'wood'),
        // right tower
        makeBlock(1170, 668, 150, 26, 'wood'),
        makeBlock(1125, 642, 20, 80, 'glass'),
        makeBlock(1215, 642, 20, 80, 'glass'),
        makeBlock(1170, 562, 160, 22, 'wood')
      ];
      const pigs = [
        makePig(760, 627),
        makePig(760, 516),
        makePig(980, 623),
        makePig(950, 351), makePig(980, 351), makePig(1010, 351),
        makePig(980, 250),
        makePig(1170, 627)
      ];
      return { blocks, pigs };
    }
  },
  {
    name: "King's Castle",
    birds: ['black', 'yellow', 'blue', 'red', 'black', 'yellow', 'red', 'blue', 'black'],
    build() {
      const blocks = [
        makeBlock(1000, 668, 320, 30, 'stone'),           // base
        makeBlock(860, 638, 26, 150, 'stone'),            // hall walls
        makeBlock(1140, 638, 26, 150, 'stone'),
        makeBlock(1000, 488, 300, 26, 'stone'),           // hall roof
        makeBlock(900, 462, 22, 120, 'wood'),
        makeBlock(1100, 462, 22, 120, 'wood'),
        makeBlock(1000, 342, 240, 24, 'wood'),
        makeBlock(930, 318, 22, 100, 'stone'),            // turrets
        makeBlock(1070, 318, 22, 100, 'stone'),
        makeBlock(1000, 218, 220, 24, 'stone')            // top slab
      ];
      const pigs = [
        makePig(895, 623), makePig(1105, 623),             // hall guards
        makePig(1000, 638, 26, true),                     // THE KING
        makePig(1000, 447),
        makePig(960, 303), makePig(1040, 303),
        makePig(1000, 180),                               // rooftop
        makePig(860, 448), makePig(1140, 448)              // ledges
      ];
      return { blocks, pigs };
    }
  }
];
