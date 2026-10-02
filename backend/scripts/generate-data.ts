/**
 * Generates the mock JSON files in data/. Run with `npm run data:generate`.
 * Output is deterministic (seeded RNG) so the demo looks the same every time.
 * Everything here is DEMO DATA: plausible, not authoritative.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'data');
mkdirSync(OUT, { recursive: true });

function write(name: string, data: unknown) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote data/${name}`);
}

// Small deterministic PRNG (mulberry32).
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261002);
const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

// ---------------------------------------------------------------- places
type PlaceType = 'AREA' | 'AIRPORT' | 'STATION' | 'BUS_STAND' | 'LANDMARK' | 'MALL' | 'OFFICE';
const P = (
  id: string,
  name: string,
  city: string,
  lat: number,
  lng: number,
  type: PlaceType,
  aliases: string[] = [],
) => ({ id, name, city, lat, lng, type, aliases });

const places = [
  // Pune
  P('kothrud', 'Kothrud', 'Pune', 18.5074, 73.8077, 'AREA', ['kothrud', 'karve road']),
  P('hinjewadi', 'Hinjewadi Phase 1', 'Pune', 18.5913, 73.7389, 'OFFICE', [
    'hinjewadi',
    'hinjawadi',
    'rajiv gandhi infotech park',
    'infotech park',
  ]),
  P('hinjewadi-3', 'Hinjewadi Phase 3', 'Pune', 18.5826, 73.6862, 'OFFICE', [
    'hinjewadi phase 3',
    'megapolis',
  ]),
  P('shivajinagar', 'Shivajinagar', 'Pune', 18.5308, 73.8475, 'AREA', [
    'shivajinagar',
    'shivaji nagar',
  ]),
  P('deccan', 'Deccan Gymkhana', 'Pune', 18.5167, 73.8414, 'AREA', ['deccan', 'deccan gymkhana']),
  P('fc-road', 'FC Road', 'Pune', 18.5236, 73.8416, 'LANDMARK', [
    'fc road',
    'fergusson college road',
    'fergusson college',
  ]),
  P('koregaon-park', 'Koregaon Park', 'Pune', 18.5362, 73.894, 'AREA', ['koregaon park', 'kp']),
  P('kalyani-nagar', 'Kalyani Nagar', 'Pune', 18.5486, 73.902, 'AREA', ['kalyani nagar']),
  P('viman-nagar', 'Viman Nagar', 'Pune', 18.5679, 73.9143, 'AREA', ['viman nagar']),
  P('pune-airport', 'Pune Airport (PNQ)', 'Pune', 18.5821, 73.9197, 'AIRPORT', [
    'pune airport',
    'lohegaon airport',
    'pnq',
    'lohegaon',
  ]),
  P('pune-station', 'Pune Railway Station', 'Pune', 18.5289, 73.8744, 'STATION', [
    'pune station',
    'pune junction',
    'pune railway station',
    'railway station',
  ]),
  P('swargate', 'Swargate Bus Stand', 'Pune', 18.5018, 73.8636, 'BUS_STAND', ['swargate']),
  P(
    'shivajinagar-bus',
    'Shivajinagar Bus Stand (Wakdewadi)',
    'Pune',
    18.5378,
    73.8505,
    'BUS_STAND',
    ['shivajinagar bus stand', 'wakdewadi'],
  ),
  P('hadapsar', 'Hadapsar', 'Pune', 18.5089, 73.926, 'AREA', ['hadapsar']),
  P('magarpatta', 'Magarpatta City', 'Pune', 18.5158, 73.9272, 'OFFICE', [
    'magarpatta',
    'magarpatta city',
  ]),
  P('kharadi', 'Kharadi (EON IT Park)', 'Pune', 18.5515, 73.945, 'OFFICE', [
    'kharadi',
    'eon it park',
    'eon',
  ]),
  P('baner', 'Baner', 'Pune', 18.559, 73.7868, 'AREA', ['baner']),
  P('aundh', 'Aundh', 'Pune', 18.558, 73.8075, 'AREA', ['aundh']),
  P('wakad', 'Wakad', 'Pune', 18.5987, 73.765, 'AREA', ['wakad']),
  P('pimpri', 'Pimpri', 'Pune', 18.6279, 73.8009, 'AREA', ['pimpri', 'pcmc', 'pimpri chinchwad']),
  P('chinchwad', 'Chinchwad', 'Pune', 18.6447, 73.7846, 'AREA', ['chinchwad']),
  P('katraj', 'Katraj', 'Pune', 18.4575, 73.8679, 'AREA', ['katraj']),
  P('camp', 'Camp (MG Road)', 'Pune', 18.5158, 73.879, 'AREA', [
    'camp',
    'pune camp',
    'mg road pune',
  ]),
  P('phoenix', 'Phoenix Marketcity', 'Pune', 18.5622, 73.9167, 'MALL', [
    'phoenix marketcity',
    'phoenix mall',
    'phoenix',
  ]),
  P('amanora', 'Amanora Mall', 'Pune', 18.5185, 73.9346, 'MALL', ['amanora', 'amanora mall']),
  P('sb-road', 'Senapati Bapat Road', 'Pune', 18.5302, 73.829, 'AREA', [
    'sb road',
    'senapati bapat road',
  ]),
  P('bavdhan', 'Bavdhan', 'Pune', 18.5156, 73.7774, 'AREA', ['bavdhan']),
  P('warje', 'Warje', 'Pune', 18.4834, 73.8024, 'AREA', ['warje']),
  P('yerawada', 'Yerawada', 'Pune', 18.5528, 73.889, 'AREA', ['yerawada', 'yerwada']),
  P('pune-university', 'Savitribai Phule Pune University', 'Pune', 18.5541, 73.8248, 'LANDMARK', [
    'pune university',
    'sppu',
    'university',
  ]),
  P('balewadi', 'Balewadi High Street', 'Pune', 18.5704, 73.7796, 'LANDMARK', [
    'balewadi',
    'balewadi high street',
  ]),
  P('shaniwar-wada', 'Shaniwar Wada', 'Pune', 18.5195, 73.8553, 'LANDMARK', [
    'shaniwar wada',
    'shaniwarwada',
  ]),
  // Around Pune / Maharashtra
  P('lonavala', 'Lonavala', 'Lonavala', 18.7546, 73.4062, 'AREA', ['lonavala', 'lonavla']),
  P('mahabaleshwar', 'Mahabaleshwar', 'Mahabaleshwar', 17.9237, 73.6586, 'AREA', ['mahabaleshwar']),
  P('panchgani', 'Panchgani', 'Panchgani', 17.9244, 73.8007, 'AREA', ['panchgani']),
  P('satara', 'Satara', 'Satara', 17.6805, 74.0183, 'AREA', ['satara']),
  P('nashik', 'Nashik', 'Nashik', 19.9975, 73.7898, 'AREA', ['nashik', 'nasik']),
  P('kolhapur', 'Kolhapur', 'Kolhapur', 16.705, 74.2433, 'AREA', ['kolhapur']),
  P('panaji', 'Panaji, Goa', 'Goa', 15.4909, 73.8278, 'AREA', ['goa', 'panaji', 'panjim']),
  P('hyderabad', 'Hyderabad', 'Hyderabad', 17.385, 78.4867, 'AREA', ['hyderabad']),
  // Delhi
  P('connaught-place', 'Connaught Place', 'Delhi', 28.6315, 77.2167, 'LANDMARK', [
    'connaught place',
    'cp',
    'rajiv chowk',
    'connaught place delhi',
  ]),
  P('igi-t1', 'IGI Airport T1', 'Delhi', 28.5654, 77.121, 'AIRPORT', [
    'igi t1',
    'terminal 1',
    'delhi airport t1',
  ]),
  P('igi-t3', 'IGI Airport T3', 'Delhi', 28.555, 77.0866, 'AIRPORT', [
    'igi t3',
    'igi airport',
    'delhi airport',
    'del',
    'indira gandhi airport',
  ]),
  P('new-delhi-station', 'New Delhi Railway Station', 'Delhi', 28.643, 77.2194, 'STATION', [
    'new delhi station',
    'new delhi railway station',
    'ndls',
  ]),
  P('nizamuddin', 'Hazrat Nizamuddin Station', 'Delhi', 28.5884, 77.2539, 'STATION', [
    'nizamuddin',
    'hazrat nizamuddin',
  ]),
  P('india-gate', 'India Gate', 'Delhi', 28.6129, 77.2295, 'LANDMARK', ['india gate']),
  P('aerocity', 'Aerocity', 'Delhi', 28.5488, 77.1205, 'AREA', ['aerocity']),
  P('karol-bagh', 'Karol Bagh', 'Delhi', 28.6519, 77.1909, 'AREA', ['karol bagh']),
  // Mumbai
  P('mumbai-csmt', 'Mumbai CSMT', 'Mumbai', 18.9398, 72.8355, 'STATION', [
    'csmt',
    'cst',
    'mumbai cst',
    'chhatrapati shivaji terminus',
  ]),
  P('dadar', 'Dadar', 'Mumbai', 19.0178, 72.8478, 'AREA', ['dadar']),
  P('mumbai-airport', 'Mumbai Airport T2', 'Mumbai', 19.0974, 72.8742, 'AIRPORT', [
    'mumbai airport',
    'bom',
  ]),
  P('bkc', 'Bandra Kurla Complex', 'Mumbai', 19.066, 72.8679, 'OFFICE', [
    'bkc',
    'bandra kurla complex',
  ]),
  // Bengaluru
  P('blr-airport', 'Kempegowda Airport (BLR)', 'Bengaluru', 13.1989, 77.7068, 'AIRPORT', [
    'bengaluru airport',
    'bangalore airport',
    'blr',
    'kempegowda airport',
  ]),
  P('mg-road-blr', 'MG Road, Bengaluru', 'Bengaluru', 12.9756, 77.6066, 'AREA', [
    'bengaluru',
    'bangalore',
    'mg road bengaluru',
  ]),
];
write('places.json', places);

// --------------------------------------------------------------- transit
const S = (id: string, name: string, lat: number, lng: number) => ({ id, name, lat, lng });

const transit = {
  pune: {
    city: 'Pune',
    metro: {
      provider: 'Pune Metro',
      speedKmh: 35,
      headwayMins: 10,
      // [maxKm, fareInr]
      fareSlabs: [
        [2, 10],
        [4, 15],
        [12, 20],
        [18, 25],
        [24, 30],
        [999, 35],
      ],
      lines: [
        {
          id: 'purple',
          name: 'Purple Line',
          color: '#7B2D8E',
          stations: [
            S('pcmc', 'PCMC', 18.6298, 73.8031),
            S('sant-tukaram-nagar', 'Sant Tukaram Nagar', 18.6205, 73.8091),
            S('bhosari', 'Bhosari (Nashik Phata)', 18.6127, 73.8197),
            S('kasarwadi', 'Kasarwadi', 18.6037, 73.8226),
            S('phugewadi', 'Phugewadi', 18.5933, 73.8297),
            S('dapodi', 'Dapodi', 18.5826, 73.834),
            S('bopodi', 'Bopodi', 18.572, 73.8378),
            S('khadki', 'Khadki', 18.5634, 73.8429),
            S('range-hill', 'Range Hill', 18.5498, 73.8381),
            S('shivaji-nagar', 'Shivaji Nagar', 18.5313, 73.851),
            S('civil-court', 'Civil Court', 18.5276, 73.8562),
            S('budhwar-peth', 'Budhwar Peth', 18.5168, 73.8565),
            S('mandai', 'Mandai', 18.512, 73.856),
            S('swargate-metro', 'Swargate', 18.5018, 73.8636),
          ],
        },
        {
          id: 'aqua',
          name: 'Aqua Line',
          color: '#00A3C4',
          stations: [
            S('vanaz', 'Vanaz', 18.5074, 73.8053),
            S('anand-nagar', 'Anand Nagar', 18.51, 73.8135),
            S('ideal-colony', 'Ideal Colony', 18.5126, 73.8222),
            S('nal-stop', 'Nal Stop', 18.5115, 73.8302),
            S('garware-college', 'Garware College', 18.5146, 73.8381),
            S('deccan-gymkhana', 'Deccan Gymkhana', 18.519, 73.843),
            S('sambhaji-udyan', 'Chhatrapati Sambhaji Udyan', 18.5222, 73.8478),
            S('pmc', 'PMC', 18.5256, 73.8536),
            S('civil-court', 'Civil Court', 18.5276, 73.8562),
            S('mangalwar-peth', 'Mangalwar Peth', 18.5296, 73.868),
            S('pune-railway-station', 'Pune Railway Station', 18.5289, 73.8744),
            S('ruby-hall', 'Ruby Hall Clinic', 18.533, 73.879),
            S('bund-garden', 'Bund Garden', 18.5385, 73.8858),
            S('yerawada-metro', 'Yerawada', 18.548, 73.893),
            S('kalyani-nagar-metro', 'Kalyani Nagar', 18.548, 73.903),
            S('ramwadi', 'Ramwadi', 18.5525, 73.9127),
          ],
        },
      ],
    },
    bus: {
      provider: 'PMPML',
      speedKmh: 18,
      minFare: 10,
      farePerKm: 2,
      maxFare: 35,
      routes: [
        {
          id: '2',
          name: 'Katraj – Shivajinagar',
          frequencyMins: 12,
          stops: [
            S('katraj-bus', 'Katraj', 18.4575, 73.8679),
            S('padmavati', 'Padmavati', 18.487, 73.858),
            S('swargate-bus', 'Swargate', 18.5018, 73.8636),
            S('mandai-bus', 'Mandai', 18.512, 73.856),
            S('deccan-bus', 'Deccan', 18.5167, 73.8414),
            S('shivajinagar-stop', 'Shivajinagar', 18.5308, 73.8475),
          ],
        },
        {
          id: '94',
          name: 'Kothrud Depot – Pune Station',
          frequencyMins: 15,
          stops: [
            S('kothrud-depot', 'Kothrud Depot', 18.505, 73.793),
            S('karve-putala', 'Karve Putala', 18.5073, 73.8077),
            S('paud-phata', 'Paud Phata', 18.5094, 73.827),
            S('deccan-bus', 'Deccan', 18.5167, 73.8414),
            S('shivajinagar-stop', 'Shivajinagar', 18.5308, 73.8475),
            S('pune-station-bus', 'Pune Station', 18.5289, 73.8744),
          ],
        },
        {
          id: '103',
          name: 'Kothrud Depot – Hadapsar',
          frequencyMins: 20,
          stops: [
            S('kothrud-depot', 'Kothrud Depot', 18.505, 73.793),
            S('nal-stop-bus', 'Nal Stop', 18.5115, 73.8302),
            S('swargate-bus', 'Swargate', 18.5018, 73.8636),
            S('pulgate', 'Pulgate', 18.502, 73.89),
            S('hadapsar-bus', 'Hadapsar Gadital', 18.5089, 73.926),
          ],
        },
        {
          id: '115P',
          name: 'Hinjewadi Phase 3 – Pune Station',
          frequencyMins: 15,
          stops: [
            S('hinjewadi-3-bus', 'Hinjewadi Phase 3', 18.5826, 73.6862),
            S('hinjewadi-1-bus', 'Hinjewadi Phase 1', 18.5913, 73.7389),
            S('wakad-bus', 'Wakad Chowk', 18.5987, 73.765),
            S('aundh-bus', 'Aundh', 18.558, 73.8075),
            S('university-bus', 'Pune University', 18.5541, 73.8248),
            S('shivajinagar-stop', 'Shivajinagar', 18.5308, 73.8475),
            S('pune-station-bus', 'Pune Station', 18.5289, 73.8744),
          ],
        },
        {
          id: '148',
          name: 'Pune Station – Pune Airport',
          frequencyMins: 20,
          stops: [
            S('pune-station-bus', 'Pune Station', 18.5289, 73.8744),
            S('bund-garden-bus', 'Bund Garden', 18.5385, 73.8858),
            S('yerawada-bus', 'Yerawada', 18.5528, 73.889),
            S('viman-nagar-bus', 'Viman Nagar', 18.5679, 73.9143),
            S('airport-bus', 'Pune Airport', 18.5821, 73.9197),
          ],
        },
        {
          id: '158',
          name: 'Swargate – Kharadi',
          frequencyMins: 18,
          stops: [
            S('swargate-bus', 'Swargate', 18.5018, 73.8636),
            S('camp-bus', 'Camp', 18.5158, 73.879),
            S('koregaon-park-bus', 'Koregaon Park', 18.5362, 73.894),
            S('kalyani-nagar-bus', 'Kalyani Nagar', 18.5486, 73.902),
            S('kharadi-bus', 'Kharadi', 18.5515, 73.945),
          ],
        },
        {
          id: '201',
          name: 'Pimpri – Swargate',
          frequencyMins: 15,
          stops: [
            S('pimpri-bus', 'Pimpri', 18.6279, 73.8009),
            S('dapodi-bus', 'Dapodi', 18.5826, 73.834),
            S('shivajinagar-stop', 'Shivajinagar', 18.5308, 73.8475),
            S('swargate-bus', 'Swargate', 18.5018, 73.8636),
          ],
        },
        {
          id: '11',
          name: 'Balewadi – Deccan',
          frequencyMins: 20,
          stops: [
            S('balewadi-bus', 'Balewadi High Street', 18.5704, 73.7796),
            S('baner-bus', 'Baner', 18.559, 73.7868),
            S('university-bus', 'Pune University', 18.5541, 73.8248),
            S('sb-road-bus', 'SB Road', 18.5302, 73.829),
            S('deccan-bus', 'Deccan', 18.5167, 73.8414),
          ],
        },
        {
          id: '226',
          name: 'Kothrud Depot – Hinjewadi Phase 1',
          frequencyMins: 25,
          stops: [
            S('kothrud-depot', 'Kothrud Depot', 18.505, 73.793),
            S('chandni-chowk', 'Chandni Chowk', 18.511, 73.775),
            S('bavdhan-bus', 'Bavdhan', 18.5156, 73.7774),
            S('wakad-bridge', 'Wakad Bridge', 18.5915, 73.756),
            S('hinjewadi-1-bus', 'Hinjewadi Phase 1', 18.5913, 73.7389),
          ],
        },
        {
          id: '64',
          name: 'Katraj – Magarpatta',
          frequencyMins: 20,
          stops: [
            S('katraj-bus', 'Katraj', 18.4575, 73.8679),
            S('kondhwa-bus', 'Kondhwa', 18.47, 73.89),
            S('fatimanagar', 'Fatimanagar', 18.5015, 73.902),
            S('hadapsar-bus', 'Hadapsar Gadital', 18.5089, 73.926),
            S('magarpatta-bus', 'Magarpatta', 18.5158, 73.9272),
          ],
        },
      ],
    },
  },
  delhi: {
    city: 'Delhi',
    metro: {
      provider: 'Delhi Metro',
      speedKmh: 40,
      headwayMins: 8,
      fareSlabs: [
        [2, 11],
        [5, 21],
        [12, 32],
        [21, 43],
        [32, 54],
        [999, 64],
      ],
      lines: [
        {
          id: 'airport-express',
          name: 'Airport Express',
          color: '#E96F1E',
          stations: [
            S('igi-t3-metro', 'IGI Airport T3', 28.5553, 77.087),
            S('aerocity-metro', 'Delhi Aerocity', 28.5488, 77.1205),
            S('dhaula-kuan', 'Dhaula Kuan', 28.5918, 77.1615),
            S('shivaji-stadium', 'Shivaji Stadium', 28.629, 77.2112),
            S('new-delhi-metro', 'New Delhi', 28.6431, 77.2223),
          ],
        },
        {
          id: 'yellow',
          name: 'Yellow Line',
          color: '#F2C200',
          stations: [
            S('kashmere-gate', 'Kashmere Gate', 28.6675, 77.2282),
            S('chandni-chowk-metro', 'Chandni Chowk', 28.6578, 77.2301),
            S('chawri-bazar', 'Chawri Bazar', 28.6492, 77.2263),
            S('new-delhi-metro', 'New Delhi', 28.6431, 77.2223),
            S('rajiv-chowk', 'Rajiv Chowk', 28.6328, 77.2197),
            S('patel-chowk', 'Patel Chowk', 28.6229, 77.2141),
            S('central-secretariat', 'Central Secretariat', 28.6148, 77.2118),
            S('udyog-bhawan', 'Udyog Bhawan', 28.6113, 77.2118),
            S('lok-kalyan-marg', 'Lok Kalyan Marg', 28.5975, 77.2108),
            S('ina', 'INA', 28.5753, 77.2096),
            S('hauz-khas', 'Hauz Khas', 28.5433, 77.2066),
          ],
        },
      ],
    },
  },
};
write('transit.json', transit);

// ----------------------------------------------------------- intercity
const trains = [
  {
    serviceNo: '12124',
    name: 'Deccan Queen',
    from: 'pune-station',
    to: 'mumbai-csmt',
    departs: '07:15',
    durationMins: 195,
    classes: [
      { code: '2S', fare: 105 },
      { code: 'CC', fare: 390 },
    ],
  },
  {
    serviceNo: '12126',
    name: 'Pragati Express',
    from: 'pune-station',
    to: 'mumbai-csmt',
    departs: '07:50',
    durationMins: 200,
    classes: [
      { code: '2S', fare: 100 },
      { code: 'CC', fare: 375 },
    ],
  },
  {
    serviceNo: '11008',
    name: 'Deccan Express',
    from: 'pune-station',
    to: 'mumbai-csmt',
    departs: '15:15',
    durationMins: 230,
    classes: [
      { code: '2S', fare: 95 },
      { code: 'CC', fare: 350 },
    ],
  },
  {
    serviceNo: '12128',
    name: 'Intercity Express',
    from: 'pune-station',
    to: 'mumbai-csmt',
    departs: '17:55',
    durationMins: 190,
    classes: [
      { code: '2S', fare: 105 },
      { code: 'CC', fare: 390 },
    ],
  },
  {
    serviceNo: '12263',
    name: 'Pune – Nizamuddin Duronto',
    from: 'pune-station',
    to: 'nizamuddin',
    departs: '11:10',
    durationMins: 1185,
    classes: [
      { code: '3A', fare: 2640 },
      { code: '2A', fare: 3720 },
      { code: '1A', fare: 6250 },
    ],
  },
  {
    serviceNo: '12779',
    name: 'Goa Express',
    from: 'pune-station',
    to: 'nizamuddin',
    departs: '15:55',
    durationMins: 1500,
    classes: [
      { code: 'SL', fare: 790 },
      { code: '3A', fare: 2085 },
      { code: '2A', fare: 2990 },
    ],
  },
  {
    serviceNo: '11077',
    name: 'Jhelum Express',
    from: 'pune-station',
    to: 'new-delhi-station',
    departs: '17:20',
    durationMins: 1650,
    classes: [
      { code: 'SL', fare: 745 },
      { code: '3A', fare: 1990 },
      { code: '2A', fare: 2870 },
    ],
  },
  {
    serviceNo: '22685',
    name: 'Pune – Delhi SF Express',
    from: 'pune-station',
    to: 'new-delhi-station',
    departs: '20:30',
    durationMins: 1420,
    classes: [
      { code: 'SL', fare: 810 },
      { code: '3A', fare: 2150 },
    ],
  },
];
write('trains.json', trains);

const flights = [
  {
    serviceNo: '6E-2141',
    airline: 'IndiGo',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '06:05',
    durationMins: 130,
    fare: 5420,
  },
  {
    serviceNo: 'AI-852',
    airline: 'Air India',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '08:40',
    durationMins: 130,
    fare: 6180,
  },
  {
    serviceNo: 'QP-1342',
    airline: 'Akasa Air',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '11:15',
    durationMins: 130,
    fare: 4890,
  },
  {
    serviceNo: '6E-6172',
    airline: 'IndiGo',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '13:40',
    durationMins: 130,
    fare: 5150,
  },
  {
    serviceNo: '6E-512',
    airline: 'IndiGo',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '15:30',
    durationMins: 130,
    fare: 5680,
  },
  {
    serviceNo: 'QP-1406',
    airline: 'Akasa Air',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '16:10',
    durationMins: 125,
    fare: 6240,
  },
  {
    serviceNo: 'SG-8169',
    airline: 'SpiceJet',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '18:45',
    durationMins: 130,
    fare: 4620,
  },
  {
    serviceNo: 'AI-2496',
    airline: 'Air India',
    from: 'pune-airport',
    to: 'igi-t3',
    departs: '21:20',
    durationMins: 130,
    fare: 4350,
  },
  {
    serviceNo: '6E-6327',
    airline: 'IndiGo',
    from: 'pune-airport',
    to: 'blr-airport',
    departs: '07:00',
    durationMins: 95,
    fare: 3980,
  },
  {
    serviceNo: 'QP-1525',
    airline: 'Akasa Air',
    from: 'pune-airport',
    to: 'blr-airport',
    departs: '12:20',
    durationMins: 95,
    fare: 4120,
  },
  {
    serviceNo: 'AI-2731',
    airline: 'Air India',
    from: 'pune-airport',
    to: 'blr-airport',
    departs: '19:05',
    durationMins: 100,
    fare: 4450,
  },
];
write('flights.json', flights);

const buses = [
  {
    serviceNo: 'MSRTC-SHV-DDR',
    operator: 'MSRTC Shivneri',
    from: 'shivajinagar-bus',
    to: 'dadar',
    departures: ['06:00', '08:00', '10:00', '13:00', '16:00', '19:00', '22:00'],
    durationMins: 210,
    fare: 525,
  },
  {
    serviceNo: 'MSRTC-MBL',
    operator: 'MSRTC',
    from: 'swargate',
    to: 'mahabaleshwar',
    departures: ['07:00', '09:30', '13:00', '16:30'],
    durationMins: 210,
    fare: 260,
  },
  {
    serviceNo: 'PP-NSK',
    operator: 'Prasanna Purple',
    from: 'shivajinagar-bus',
    to: 'nashik',
    departures: ['07:30', '14:00', '23:00'],
    durationMins: 270,
    fare: 450,
  },
  {
    serviceNo: 'NT-KOP',
    operator: 'Neeta Travels',
    from: 'swargate',
    to: 'kolhapur',
    departures: ['06:30', '12:30', '22:30'],
    durationMins: 240,
    fare: 550,
  },
  {
    serviceNo: 'VRL-GOA',
    operator: 'VRL Travels',
    from: 'swargate',
    to: 'panaji',
    departures: ['19:30', '21:00'],
    durationMins: 660,
    fare: 1150,
  },
  {
    serviceNo: 'IC-HYD',
    operator: 'IntrCity SmartBus',
    from: 'wakad',
    to: 'hyderabad',
    departures: ['18:00', '21:30'],
    durationMins: 690,
    fare: 1350,
  },
];
write('buses.json', buses);

// -------------------------------------------------------------- chargers
const operators = [
  'Tata Power EZ Charge',
  'Statiq',
  'ChargeZone',
  'Jio-bp pulse',
  'Zeon Charging',
  'Glida',
  'MSEDCL',
];
const chargerSites: [string, number, number][] = [
  // Pune city (33)
  ['Kothrud Depot', 18.5048, 73.7935],
  ['Karve Road', 18.5071, 73.8155],
  ['Paud Road', 18.5086, 73.8012],
  ['Deccan Gymkhana', 18.5172, 73.8402],
  ['FC Road', 18.5243, 73.8411],
  ['Shivajinagar', 18.5303, 73.8492],
  ['Model Colony', 18.5333, 73.8358],
  ['Baner Road', 18.5596, 73.7899],
  ['Balewadi High Street', 18.5708, 73.7788],
  ['Aundh ITI Road', 18.5603, 73.8104],
  ['Hinjewadi Phase 1', 18.5918, 73.7402],
  ['Hinjewadi Phase 2', 18.5867, 73.7121],
  ['Hinjewadi Phase 3', 18.5831, 73.6874],
  ['Wakad', 18.5995, 73.7631],
  ['Pimple Saudagar', 18.5947, 73.7966],
  ['Pimpri', 18.6271, 73.8023],
  ['Chinchwad', 18.6442, 73.7859],
  ['Nigdi', 18.6514, 73.7693],
  ['Koregaon Park', 18.5371, 73.8936],
  ['Kalyani Nagar', 18.5491, 73.9018],
  ['Viman Nagar', 18.5672, 73.9129],
  ['Pune Airport', 18.5809, 73.9186],
  ['Phoenix Marketcity', 18.5617, 73.9171],
  ['Kharadi', 18.5521, 73.9437],
  ['Magarpatta', 18.5149, 73.9281],
  ['Amanora', 18.5178, 73.9339],
  ['Hadapsar', 18.5095, 73.9248],
  ['Camp', 18.5162, 73.8781],
  ['Pune Station', 18.5294, 73.8751],
  ['Swargate', 18.5011, 73.8642],
  ['Katraj', 18.4583, 73.8667],
  ['Kondhwa', 18.4712, 73.8893],
  ['Warje', 18.4839, 73.8011],
  // Highways out of Pune (7) — Pune–Satara (NH48) towards Mahabaleshwar, and the Expressway
  ['Khed Shivapur (NH48)', 18.322, 73.853],
  ['Shirwal (NH48)', 18.153, 73.979],
  ['Wai', 17.953, 73.891],
  ['Panchgani', 17.9251, 73.8012],
  ['Mahabaleshwar', 17.9241, 73.6579],
  ['Talegaon', 18.735, 73.676],
  ['Lonavala Expressway Food Mall', 18.77, 73.395],
];
// Exactly 70% WORKING, 15% BUSY, 15% BROKEN, shuffled deterministically.
// The Pune–Mahabaleshwar corridor is pinned to WORKING/BUSY so the EV demo always has a stop.
const statusPool = [
  ...Array(28).fill('WORKING'),
  ...Array(6).fill('BUSY'),
  ...Array(6).fill('BROKEN'),
];
for (let i = statusPool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
}
const pinned: Record<string, string> = {
  'Khed Shivapur (NH48)': 'WORKING',
  'Shirwal (NH48)': 'WORKING',
  Wai: 'BUSY',
};
for (const [site, status] of Object.entries(pinned)) {
  const idx = chargerSites.findIndex(([n]) => n === site);
  const swap = statusPool.findIndex(
    (s, k) => s === status && chargerSites[k][0] && !(chargerSites[k][0] in pinned),
  );
  [statusPool[idx], statusPool[swap]] = [statusPool[swap], statusPool[idx]];
}

const chargerKinds = [
  { powerKw: 60, connectors: ['CCS2'], price: 21 },
  { powerKw: 30, connectors: ['CCS2', 'Type2'], price: 19 },
  { powerKw: 120, connectors: ['CCS2'], price: 24 },
  { powerKw: 22, connectors: ['Type2'], price: 16 },
  { powerKw: 7.4, connectors: ['Type2'], price: 14 },
  { powerKw: 15, connectors: ['Bharat AC001', 'GBT'], price: 15 },
  { powerKw: 50, connectors: ['CCS2', 'CHAdeMO'], price: 22 },
];
const now = Date.UTC(2026, 9, 2, 6, 0);
const chargers = chargerSites.map(([site, lat, lng], i) => {
  const kind =
    site.includes('NH48') || site.includes('Expressway')
      ? chargerKinds[2]
      : chargerKinds[Math.floor(rand() * chargerKinds.length)];
  const operator = operators[Math.floor(rand() * operators.length)];
  return {
    id: `chg-${String(i + 1).padStart(3, '0')}`,
    name: `${operator} – ${site}`,
    operator,
    lat: round(lat),
    lng: round(lng),
    powerKw: kind.powerKw,
    connectors: kind.connectors,
    status: statusPool[i],
    pricePerKwh: kind.price + Math.round(rand() * 3),
    lastVerified: new Date(now - Math.round(rand() * 72) * 3600_000).toISOString(),
  };
});
write('chargers.pune.json', chargers);

// --------------------------------------------------------------- parking
const patterns = {
  mall: [
    0.05, 0.03, 0.02, 0.02, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.28, 0.4, 0.52, 0.58, 0.6, 0.62,
    0.68, 0.78, 0.9, 0.95, 0.92, 0.75, 0.45, 0.18,
  ],
  office: [
    0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.1, 0.25, 0.55, 0.8, 0.92, 0.95, 0.93, 0.9, 0.92, 0.94,
    0.9, 0.85, 0.6, 0.35, 0.2, 0.12, 0.08, 0.06,
  ],
  transit: [
    0.55, 0.5, 0.48, 0.5, 0.6, 0.7, 0.78, 0.82, 0.85, 0.85, 0.83, 0.8, 0.8, 0.82, 0.83, 0.85, 0.88,
    0.9, 0.92, 0.9, 0.85, 0.78, 0.7, 0.62,
  ],
  street: [
    0.2, 0.15, 0.12, 0.12, 0.15, 0.2, 0.3, 0.45, 0.65, 0.75, 0.8, 0.82, 0.8, 0.78, 0.78, 0.8, 0.85,
    0.9, 0.92, 0.9, 0.8, 0.6, 0.4, 0.28,
  ],
};
type Profile = keyof typeof patterns;
const lots: [string, number, number, string, Profile, number, number, boolean][] = [
  // name, lat, lng, type, profile, totalSpots, ratePerHour, hasEvCharging
  ['Phoenix Marketcity Parking', 18.5619, 73.9163, 'MALL', 'mall', 1500, 40, true],
  ['Amanora Mall Parking', 18.5183, 73.9343, 'MALL', 'mall', 1200, 40, true],
  ['Seasons Mall Parking', 18.5193, 73.9318, 'MALL', 'mall', 700, 30, false],
  ['Pavilion Mall Parking, SB Road', 18.5326, 73.8296, 'MALL', 'mall', 450, 40, true],
  ['Westend Mall Parking, Aundh', 18.5617, 73.8077, 'MALL', 'mall', 900, 40, true],
  ['Pune Railway Station Parking', 18.5293, 73.8737, 'STATION', 'transit', 400, 20, false],
  ['Pune Airport Multilevel Car Park', 18.5815, 73.9205, 'AIRPORT', 'transit', 1100, 80, true],
  ['Swargate Bus Stand Parking', 18.5022, 73.8629, 'STATION', 'transit', 250, 15, false],
  ['Shivaji Nagar Metro Parking', 18.5317, 73.8503, 'STATION', 'transit', 180, 15, false],
  ['Vanaz Metro Parking', 18.5078, 73.8049, 'STATION', 'transit', 150, 10, true],
  ['Ramwadi Metro Parking', 18.5529, 73.9121, 'STATION', 'transit', 160, 10, false],
  ['Kothrud Multilevel Parking (PMC)', 18.5068, 73.8091, 'MULTILEVEL', 'street', 320, 15, true],
  ['Deccan Multilevel Parking', 18.5175, 73.8409, 'MULTILEVEL', 'street', 280, 20, false],
  ['Hinjewadi Phase 1 IT Park Parking', 18.5909, 73.7381, 'MULTILEVEL', 'office', 800, 25, true],
  ['Magarpatta Cybercity Parking', 18.5152, 73.9265, 'MULTILEVEL', 'office', 900, 25, true],
  ['EON IT Park Parking, Kharadi', 18.5519, 73.9447, 'MULTILEVEL', 'office', 750, 30, true],
  ['Baner Business Bay Parking', 18.5602, 73.7872, 'MULTILEVEL', 'office', 300, 30, false],
  ['FC Road Street Parking', 18.5232, 73.8414, 'STREET', 'street', 120, 20, false],
  ['Laxmi Road Street Parking', 18.5161, 73.8555, 'STREET', 'street', 90, 20, false],
  ['Koregaon Park Lane 7 Parking', 18.5375, 73.8951, 'STREET', 'street', 70, 30, false],
  ['Camp MG Road Parking', 18.5163, 73.8794, 'STREET', 'street', 110, 25, false],
  ['Balewadi High Street Parking', 18.5701, 73.7792, 'STREET', 'street', 140, 30, true],
  ['Viman Nagar Datta Mandir Parking', 18.5671, 73.9136, 'STREET', 'street', 80, 20, false],
  ['Kalyani Nagar Parking Plaza', 18.5482, 73.9024, 'MULTILEVEL', 'street', 200, 25, false],
  ['Shaniwar Wada Visitor Parking', 18.5191, 73.8561, 'STREET', 'street', 100, 20, false],
];
const parking = lots.map(
  ([name, lat, lng, type, profile, totalSpots, ratePerHour, hasEvCharging], i) => ({
    id: `prk-${String(i + 1).padStart(3, '0')}`,
    name,
    lat,
    lng,
    totalSpots,
    ratePerHour,
    type,
    // Jitter each lot a little so two malls don't look identical.
    hourlyPattern: patterns[profile].map((v) =>
      round(Math.min(0.98, Math.max(0.01, v + (rand() - 0.5) * 0.06)), 2),
    ),
    hasEvCharging,
  }),
);
write('parking.pune.json', parking);
