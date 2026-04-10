export const AIRPORT_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  // 台灣
  TPE: { lat: 25.0777, lng: 121.2328, city: "台北桃園" },
  TSA: { lat: 25.0698, lng: 121.5521, city: "台北松山" },
  KHH: { lat: 22.5771, lng: 120.3497, city: "高雄" },
  RMQ: { lat: 24.2647, lng: 120.6208, city: "台中" },
  // 日本
  NRT: { lat: 35.772, lng: 140.3929, city: "東京成田" },
  HND: { lat: 35.5494, lng: 139.7798, city: "東京羽田" },
  KIX: { lat: 34.4272, lng: 135.244, city: "大阪關西" },
  ITM: { lat: 34.7849, lng: 135.4386, city: "大阪伊丹" },
  CTS: { lat: 42.7752, lng: 141.6921, city: "札幌新千歲" },
  FUK: { lat: 33.5846, lng: 130.4511, city: "福岡" },
  KMJ: { lat: 32.8373, lng: 130.8554, city: "熊本" },
  OIT: { lat: 33.4794, lng: 131.7369, city: "大分" },
  KOJ: { lat: 31.8034, lng: 130.7186, city: "鹿兒島" },
  OKA: { lat: 26.1958, lng: 127.6461, city: "沖繩那霸" },
  NGO: { lat: 34.8583, lng: 136.8054, city: "名古屋中部" },
  // 韓國
  ICN: { lat: 37.4602, lng: 126.4407, city: "首爾仁川" },
  GMP: { lat: 37.5584, lng: 126.7942, city: "首爾金浦" },
  PUS: { lat: 35.1795, lng: 128.9384, city: "釜山" },
  // 中國
  PEK: { lat: 40.0799, lng: 116.6031, city: "北京首都" },
  PKX: { lat: 39.5098, lng: 116.4105, city: "北京大興" },
  PVG: { lat: 31.1443, lng: 121.8083, city: "上海浦東" },
  SHA: { lat: 31.198, lng: 121.3364, city: "上海虹橋" },
  CAN: { lat: 23.3924, lng: 113.2988, city: "廣州白雲" },
  SZX: { lat: 22.6393, lng: 113.8107, city: "深圳" },
  CTU: { lat: 30.5785, lng: 103.9467, city: "成都天府" },
  // 香港 / 澳門
  HKG: { lat: 22.308, lng: 113.9185, city: "香港" },
  MFM: { lat: 22.1496, lng: 113.5918, city: "澳門" },
  // 東南亞
  SIN: { lat: 1.3644, lng: 103.9915, city: "新加坡樟宜" },
  BKK: { lat: 13.6811, lng: 100.7477, city: "曼谷素萬那普" },
  DMK: { lat: 13.9126, lng: 100.6069, city: "曼谷廊曼" },
  KUL: { lat: 2.7456, lng: 101.7099, city: "吉隆坡" },
  CGK: { lat: -6.1256, lng: 106.6559, city: "雅加達蘇加諾" },
  DPS: { lat: -8.7467, lng: 115.1670, city: "峇里島" },
  MNL: { lat: 14.5086, lng: 121.0194, city: "馬尼拉" },
  SGN: { lat: 10.8188, lng: 106.6520, city: "胡志明市" },
  HAN: { lat: 21.2212, lng: 105.8072, city: "河內" },
  REP: { lat: 13.4107, lng: 103.8131, city: "暹粒" },
  // 南亞
  BOM: { lat: 19.0896, lng: 72.8656, city: "孟買" },
  DEL: { lat: 28.5562, lng: 77.1000, city: "新德里" },
  CMB: { lat: 7.1808, lng: 79.8841, city: "可倫坡" },
  MLE: { lat: 4.1918, lng: 73.5290, city: "馬爾地夫" },
  KTM: { lat: 27.6966, lng: 85.3591, city: "加德滿都" },
  // 中東
  IST: { lat: 41.2753, lng: 28.7519, city: "伊斯坦堡新機場" },
  SAW: { lat: 40.8987, lng: 29.3094, city: "伊斯坦堡薩比哈" },
  DXB: { lat: 25.2532, lng: 55.3657, city: "杜拜" },
  AUH: { lat: 24.433, lng: 54.6511, city: "阿布達比" },
  DOH: { lat: 25.2609, lng: 51.6138, city: "多哈" },
  TLV: { lat: 32.0114, lng: 34.8867, city: "特拉維夫" },
  AMM: { lat: 31.7226, lng: 35.9932, city: "安曼" },
  // 歐洲
  LHR: { lat: 51.47, lng: -0.4543, city: "倫敦希斯洛" },
  LGW: { lat: 51.1537, lng: -0.1821, city: "倫敦蓋特威克" },
  STN: { lat: 51.885, lng: 0.235, city: "倫敦史坦斯特" },
  CDG: { lat: 49.0097, lng: 2.5479, city: "巴黎戴高樂" },
  ORY: { lat: 48.7233, lng: 2.3794, city: "巴黎奧利" },
  AMS: { lat: 52.3105, lng: 4.7683, city: "阿姆斯特丹" },
  FRA: { lat: 50.0379, lng: 8.5622, city: "法蘭克福" },
  MUC: { lat: 48.3538, lng: 11.7861, city: "慕尼黑" },
  ZRH: { lat: 47.4647, lng: 8.5492, city: "蘇黎世" },
  VIE: { lat: 48.1102, lng: 16.5697, city: "維也納" },
  ARN: { lat: 59.6498, lng: 17.9238, city: "斯德哥爾摩阿蘭達" },
  OSL: { lat: 60.1939, lng: 11.1004, city: "奧斯陸" },
  HEL: { lat: 60.3172, lng: 24.9633, city: "赫爾辛基" },
  CPH: { lat: 55.618, lng: 12.6508, city: "哥本哈根" },
  MAD: { lat: 40.4936, lng: -3.5668, city: "馬德里" },
  BCN: { lat: 41.2971, lng: 2.0785, city: "巴塞隆納" },
  FCO: { lat: 41.8003, lng: 12.2389, city: "羅馬費米奇諾" },
  MXP: { lat: 45.6301, lng: 8.7231, city: "米蘭馬爾彭薩" },
  ATH: { lat: 37.9364, lng: 23.9445, city: "雅典" },
  BRU: { lat: 50.9010, lng: 4.4844, city: "布魯塞爾" },
  PRG: { lat: 50.1008, lng: 14.2600, city: "布拉格" },
  BUD: { lat: 47.4298, lng: 19.2611, city: "布達佩斯" },
  WAW: { lat: 52.1657, lng: 20.9671, city: "華沙" },
  KEF: { lat: 63.9850, lng: -22.6056, city: "雷克雅維克" },
  DUB: { lat: 53.4213, lng: -6.2700, city: "都柏林" },
  LIS: { lat: 38.7742, lng: -9.1342, city: "里斯本" },
  // 北美
  JFK: { lat: 40.6413, lng: -73.7781, city: "紐約甘迺迪" },
  EWR: { lat: 40.6925, lng: -74.1687, city: "紐約紐瓦克" },
  LAX: { lat: 33.9425, lng: -118.4081, city: "洛杉磯" },
  SFO: { lat: 37.6213, lng: -122.379, city: "舊金山" },
  ORD: { lat: 41.9742, lng: -87.9073, city: "芝加哥奧黑爾" },
  SEA: { lat: 47.4502, lng: -122.3088, city: "西雅圖" },
  YYZ: { lat: 43.6777, lng: -79.6248, city: "多倫多皮爾遜" },
  YVR: { lat: 49.1967, lng: -123.1815, city: "溫哥華" },
  // 大洋洲
  SYD: { lat: -33.9399, lng: 151.1753, city: "雪梨" },
  MEL: { lat: -37.669, lng: 144.841, city: "墨爾本" },
  AKL: { lat: -37.0082, lng: 174.7917, city: "奧克蘭" },
  // 非洲
  CAI: { lat: 30.1219, lng: 31.4056, city: "開羅" },
  CMN: { lat: 33.3675, lng: -7.5898, city: "卡薩布蘭加" },
  JNB: { lat: -26.1392, lng: 28.2460, city: "約翰尼斯堡" },
  NBO: { lat: -1.3192, lng: 36.9275, city: "奈洛比" },
  // 北歐
  TOS: { lat: 69.6833, lng: 18.9189, city: "特羅姆瑟" },
  BOO: { lat: 67.2692, lng: 14.3653, city: "博多" },
  EVE: { lat: 68.4913, lng: 16.6781, city: "哈斯塔/納爾維克" },
  TRD: { lat: 63.4578, lng: 10.9239, city: "特隆赫姆" },
  BGO: { lat: 60.2934, lng: 5.2181, city: "卑爾根" },
  LYR: { lat: 78.2461, lng: 15.4656, city: "朗伊爾城" },
  RVK: { lat: 64.8383, lng: 11.1461, city: "羅爾維克" },
};

// 非機場的常用城市座標（供火車、巴士、渡輪路線使用）
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // 台灣
  "台北": { lat: 25.0330, lng: 121.5654 }, "台中": { lat: 24.1477, lng: 120.6736 },
  "台南": { lat: 22.9998, lng: 120.2269 }, "高雄": { lat: 22.6273, lng: 120.3014 },
  "花蓮": { lat: 23.9913, lng: 121.6014 }, "台東": { lat: 22.7972, lng: 121.1016 },
  "嘉義": { lat: 23.4801, lng: 120.4491 }, "屏東": { lat: 22.6726, lng: 120.4870 },
  "宜蘭": { lat: 24.7021, lng: 121.7377 }, "基隆": { lat: 25.1276, lng: 121.7392 },
  // 日本
  "東京": { lat: 35.6762, lng: 139.6503 }, "大阪": { lat: 34.6937, lng: 135.5023 },
  "京都": { lat: 35.0116, lng: 135.7681 }, "名古屋": { lat: 35.1815, lng: 136.9066 },
  "札幌": { lat: 43.0618, lng: 141.3545 }, "福岡": { lat: 33.5904, lng: 130.4017 },
  "廣島": { lat: 34.3853, lng: 132.4553 }, "神戶": { lat: 34.6901, lng: 135.1956 },
  "仙台": { lat: 38.2682, lng: 140.8694 }, "長崎": { lat: 32.7503, lng: 129.8777 },
  "金澤": { lat: 36.5613, lng: 136.6562 }, "奈良": { lat: 34.6851, lng: 135.8049 },
  "鹿兒島": { lat: 31.5969, lng: 130.5571 }, "那霸": { lat: 26.2124, lng: 127.6809 },
  // 韓國
  "首爾": { lat: 37.5665, lng: 126.9780 }, "釜山": { lat: 35.1796, lng: 129.0756 },
  "仁川": { lat: 37.4563, lng: 126.7052 }, "大邱": { lat: 35.8714, lng: 128.6014 },
  "濟州": { lat: 33.4996, lng: 126.5312 },
  // 中國
  "北京": { lat: 39.9042, lng: 116.4074 }, "上海": { lat: 31.2304, lng: 121.4737 },
  "廣州": { lat: 23.1291, lng: 113.2644 }, "深圳": { lat: 22.5431, lng: 114.0579 },
  "成都": { lat: 30.5728, lng: 104.0668 }, "杭州": { lat: 30.2741, lng: 120.1551 },
  "南京": { lat: 32.0603, lng: 118.7969 }, "西安": { lat: 34.3416, lng: 108.9398 },
  "重慶": { lat: 29.4316, lng: 106.9123 },
  // 港澳
  "香港": { lat: 22.3193, lng: 114.1694 }, "澳門": { lat: 22.1987, lng: 113.5439 },
  // 東南亞
  "新加坡": { lat: 1.3521, lng: 103.8198 }, "曼谷": { lat: 13.7563, lng: 100.5018 },
  "吉隆坡": { lat: 3.1390, lng: 101.6869 }, "雅加達": { lat: -6.2088, lng: 106.8456 },
  "胡志明市": { lat: 10.8231, lng: 106.6297 }, "河內": { lat: 21.0285, lng: 105.8542 },
  "馬尼拉": { lat: 14.5995, lng: 120.9842 }, "峇里": { lat: -8.3405, lng: 115.0920 },
  // 南亞
  "孟買": { lat: 19.0760, lng: 72.8777 }, "德里": { lat: 28.6139, lng: 77.2090 },
  "加德滿都": { lat: 27.7172, lng: 85.3240 },
  // 中東
  "杜拜": { lat: 25.2048, lng: 55.2708 }, "伊斯坦堡": { lat: 41.0082, lng: 28.9784 },
  "特拉維夫": { lat: 32.0853, lng: 34.7818 },
  // 歐洲
  "倫敦": { lat: 51.5074, lng: -0.1278 }, "巴黎": { lat: 48.8566, lng: 2.3522 },
  "阿姆斯特丹": { lat: 52.3676, lng: 4.9041 }, "法蘭克福": { lat: 50.1109, lng: 8.6821 },
  "慕尼黑": { lat: 48.1351, lng: 11.5820 }, "柏林": { lat: 52.5200, lng: 13.4050 },
  "羅馬": { lat: 41.9028, lng: 12.4964 }, "米蘭": { lat: 45.4654, lng: 9.1859 },
  "威尼斯": { lat: 45.4408, lng: 12.3155 }, "佛羅倫斯": { lat: 43.7696, lng: 11.2558 },
  "巴塞隆納": { lat: 41.3851, lng: 2.1734 }, "馬德里": { lat: 40.4168, lng: -3.7038 },
  "里斯本": { lat: 38.7169, lng: -9.1395 }, "維也納": { lat: 48.2082, lng: 16.3738 },
  "布拉格": { lat: 50.0755, lng: 14.4378 }, "布達佩斯": { lat: 47.4979, lng: 19.0402 },
  "華沙": { lat: 52.2297, lng: 21.0122 }, "哥本哈根": { lat: 55.6761, lng: 12.5683 },
  "斯德哥爾摩": { lat: 59.3293, lng: 18.0686 }, "赫爾辛基": { lat: 60.1699, lng: 24.9384 },
  "奧斯陸": { lat: 59.9139, lng: 10.7522 }, "雅典": { lat: 37.9838, lng: 23.7275 },
  "蘇黎世": { lat: 47.3769, lng: 8.5417 }, "布魯塞爾": { lat: 50.8503, lng: 4.3517 },
  "都柏林": { lat: 53.3498, lng: -6.2603 }, "愛丁堡": { lat: 55.9533, lng: -3.1883 },
  // 美洲
  "紐約": { lat: 40.7128, lng: -74.0060 }, "洛杉磯": { lat: 34.0522, lng: -118.2437 },
  "舊金山": { lat: 37.7749, lng: -122.4194 }, "芝加哥": { lat: 41.8781, lng: -87.6298 },
  "多倫多": { lat: 43.6532, lng: -79.3832 }, "溫哥華": { lat: 49.2827, lng: -123.1207 },
  "墨西哥城": { lat: 19.4326, lng: -99.1332 },
  // 澳洲 / 紐西蘭
  "雪梨": { lat: -33.8688, lng: 151.2093 }, "墨爾本": { lat: -37.8136, lng: 144.9631 },
  "奧克蘭": { lat: -36.8509, lng: 174.7645 },
  // 非洲
  "開羅": { lat: 30.0444, lng: 31.2357 }, "奈洛比": { lat: -1.2921, lng: 36.8219 },
};

// 英文城市名對照（key 一律小寫，resolveLocation 查詢時轉小寫比對）
const EN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // 台灣
  "taipei": { lat: 25.0330, lng: 121.5654 }, "taichung": { lat: 24.1477, lng: 120.6736 },
  "tainan": { lat: 22.9998, lng: 120.2269 }, "kaohsiung": { lat: 22.6273, lng: 120.3014 },
  "hualien": { lat: 23.9913, lng: 121.6014 }, "keelung": { lat: 25.1276, lng: 121.7392 },
  // 日本
  "tokyo": { lat: 35.6762, lng: 139.6503 }, "osaka": { lat: 34.6937, lng: 135.5023 },
  "kyoto": { lat: 35.0116, lng: 135.7681 }, "nagoya": { lat: 35.1815, lng: 136.9066 },
  "sapporo": { lat: 43.0618, lng: 141.3545 }, "fukuoka": { lat: 33.5904, lng: 130.4017 },
  "hiroshima": { lat: 34.3853, lng: 132.4553 }, "kobe": { lat: 34.6901, lng: 135.1956 },
  "nara": { lat: 34.6851, lng: 135.8049 }, "kanazawa": { lat: 36.5613, lng: 136.6562 },
  "sendai": { lat: 38.2682, lng: 140.8694 }, "nagasaki": { lat: 32.7503, lng: 129.8777 },
  "kagoshima": { lat: 31.5969, lng: 130.5571 }, "naha": { lat: 26.2124, lng: 127.6809 },
  "nikko": { lat: 36.7198, lng: 139.6983 }, "hakone": { lat: 35.2329, lng: 139.1069 },
  "kamakura": { lat: 35.3197, lng: 139.5467 }, "hakata": { lat: 33.5904, lng: 130.4017 },
  // 韓國
  "seoul": { lat: 37.5665, lng: 126.9780 }, "busan": { lat: 35.1796, lng: 129.0756 },
  "jeju": { lat: 33.4996, lng: 126.5312 }, "incheon": { lat: 37.4563, lng: 126.7052 },
  "daegu": { lat: 35.8714, lng: 128.6014 },
  // 中國 / 港澳
  "beijing": { lat: 39.9042, lng: 116.4074 }, "shanghai": { lat: 31.2304, lng: 121.4737 },
  "guangzhou": { lat: 23.1291, lng: 113.2644 }, "shenzhen": { lat: 22.5431, lng: 114.0579 },
  "chengdu": { lat: 30.5728, lng: 104.0668 }, "hong kong": { lat: 22.3193, lng: 114.1694 },
  "macau": { lat: 22.1987, lng: 113.5439 }, "xi'an": { lat: 34.3416, lng: 108.9398 },
  "xian": { lat: 34.3416, lng: 108.9398 },
  // 東南亞
  "singapore": { lat: 1.3521, lng: 103.8198 }, "bangkok": { lat: 13.7563, lng: 100.5018 },
  "kuala lumpur": { lat: 3.1390, lng: 101.6869 }, "jakarta": { lat: -6.2088, lng: 106.8456 },
  "ho chi minh city": { lat: 10.8231, lng: 106.6297 }, "hanoi": { lat: 21.0285, lng: 105.8542 },
  "manila": { lat: 14.5995, lng: 120.9842 }, "bali": { lat: -8.3405, lng: 115.0920 },
  "chiang mai": { lat: 18.7883, lng: 98.9853 }, "phuket": { lat: 7.8804, lng: 98.3923 },
  // 中東
  "dubai": { lat: 25.2048, lng: 55.2708 }, "istanbul": { lat: 41.0082, lng: 28.9784 },
  "tel aviv": { lat: 32.0853, lng: 34.7818 }, "doha": { lat: 25.2854, lng: 51.5310 },
  "abu dhabi": { lat: 24.4539, lng: 54.3773 },
  // 歐洲 — 西歐
  "london": { lat: 51.5074, lng: -0.1278 }, "paris": { lat: 48.8566, lng: 2.3522 },
  "amsterdam": { lat: 52.3676, lng: 4.9041 }, "frankfurt": { lat: 50.1109, lng: 8.6821 },
  "munich": { lat: 48.1351, lng: 11.5820 }, "berlin": { lat: 52.5200, lng: 13.4050 },
  "hamburg": { lat: 53.5753, lng: 10.0153 }, "cologne": { lat: 50.9333, lng: 6.9500 },
  "rome": { lat: 41.9028, lng: 12.4964 }, "milan": { lat: 45.4654, lng: 9.1859 },
  "venice": { lat: 45.4408, lng: 12.3155 }, "florence": { lat: 43.7696, lng: 11.2558 },
  "naples": { lat: 40.8518, lng: 14.2681 }, "bologna": { lat: 44.4949, lng: 11.3426 },
  "barcelona": { lat: 41.3851, lng: 2.1734 }, "madrid": { lat: 40.4168, lng: -3.7038 },
  "seville": { lat: 37.3891, lng: -5.9845 }, "valencia": { lat: 39.4699, lng: -0.3763 },
  "lisbon": { lat: 38.7169, lng: -9.1395 }, "porto": { lat: 41.1579, lng: -8.6291 },
  "vienna": { lat: 48.2082, lng: 16.3738 }, "salzburg": { lat: 47.8095, lng: 13.0550 },
  "zurich": { lat: 47.3769, lng: 8.5417 }, "geneva": { lat: 46.2044, lng: 6.1432 },
  "bern": { lat: 46.9480, lng: 7.4474 }, "interlaken": { lat: 46.6863, lng: 7.8632 },
  "brussels": { lat: 50.8503, lng: 4.3517 }, "bruges": { lat: 51.2093, lng: 3.2247 },
  "dublin": { lat: 53.3498, lng: -6.2603 }, "edinburgh": { lat: 55.9533, lng: -3.1883 },
  "glasgow": { lat: 55.8642, lng: -4.2518 },
  // 歐洲 — 中東歐
  "prague": { lat: 50.0755, lng: 14.4378 }, "brno": { lat: 49.1951, lng: 16.6068 },
  "budapest": { lat: 47.4979, lng: 19.0402 }, "warsaw": { lat: 52.2297, lng: 21.0122 },
  "krakow": { lat: 50.0647, lng: 19.9450 }, "athens": { lat: 37.9838, lng: 23.7275 },
  "thessaloniki": { lat: 40.6401, lng: 22.9444 }, "dubrovnik": { lat: 42.6507, lng: 18.0944 },
  "split": { lat: 43.5081, lng: 16.4402 }, "zagreb": { lat: 45.8150, lng: 15.9819 },
  "ljubljana": { lat: 46.0569, lng: 14.5058 }, "bratislava": { lat: 48.1486, lng: 17.1077 },
  "bucharest": { lat: 44.4268, lng: 26.1025 }, "sofia": { lat: 42.6977, lng: 23.3219 },
  "tallinn": { lat: 59.4370, lng: 24.7536 }, "riga": { lat: 56.9460, lng: 24.1059 },
  "vilnius": { lat: 54.6872, lng: 25.2797 },
  // 北歐
  "stockholm": { lat: 59.3293, lng: 18.0686 }, "gothenburg": { lat: 57.7089, lng: 11.9746 },
  "malmo": { lat: 55.6050, lng: 13.0038 }, "malmö": { lat: 55.6050, lng: 13.0038 },
  "oslo": { lat: 59.9139, lng: 10.7522 }, "bergen": { lat: 60.3913, lng: 5.3221 },
  "trondheim": { lat: 63.4305, lng: 10.3951 }, "tromsø": { lat: 69.6489, lng: 18.9551 },
  "tromso": { lat: 69.6489, lng: 18.9551 }, "narvik": { lat: 68.4385, lng: 17.4279 },
  "lofoten": { lat: 68.1547, lng: 13.9997 }, "ålesund": { lat: 62.4722, lng: 6.1495 },
  "alesund": { lat: 62.4722, lng: 6.1495 }, "flåm": { lat: 60.8632, lng: 7.1193 },
  "flam": { lat: 60.8632, lng: 7.1193 }, "geilo": { lat: 60.5333, lng: 8.2000 },
  "helsinki": { lat: 60.1699, lng: 24.9384 }, "tampere": { lat: 61.4978, lng: 23.7610 },
  "turku": { lat: 60.4518, lng: 22.2666 }, "rovaniemi": { lat: 66.5039, lng: 25.7294 },
  "copenhagen": { lat: 55.6761, lng: 12.5683 }, "aarhus": { lat: 56.1629, lng: 10.2039 },
  "reykjavik": { lat: 64.1355, lng: -21.8954 },
  // 北極圈特殊地點
  "abisko": { lat: 68.3558, lng: 18.8298 }, "kiruna": { lat: 67.8557, lng: 20.2253 },
  "longyearbyen": { lat: 78.2232, lng: 15.6267 }, "svalbard": { lat: 78.2232, lng: 15.6267 },
  // 美洲
  "new york": { lat: 40.7128, lng: -74.0060 }, "los angeles": { lat: 34.0522, lng: -118.2437 },
  "san francisco": { lat: 37.7749, lng: -122.4194 }, "chicago": { lat: 41.8781, lng: -87.6298 },
  "toronto": { lat: 43.6532, lng: -79.3832 }, "vancouver": { lat: 49.2827, lng: -123.1207 },
  "montreal": { lat: 45.5017, lng: -73.5673 }, "mexico city": { lat: 19.4326, lng: -99.1332 },
  "buenos aires": { lat: -34.6037, lng: -58.3816 }, "rio de janeiro": { lat: -22.9068, lng: -43.1729 },
  // 澳洲 / 紐西蘭
  "sydney": { lat: -33.8688, lng: 151.2093 }, "melbourne": { lat: -37.8136, lng: 144.9631 },
  "auckland": { lat: -36.8509, lng: 174.7645 }, "queenstown": { lat: -45.0312, lng: 168.6626 },
  // 非洲
  "cairo": { lat: 30.0444, lng: 31.2357 }, "nairobi": { lat: -1.2921, lng: 36.8219 },
  "cape town": { lat: -33.9249, lng: 18.4241 }, "marrakech": { lat: 31.6295, lng: -7.9811 },
};

export function resolveLocation(iataOrName: string): { lat: number; lng: number } | null {
  if (!iataOrName || !iataOrName.trim()) return null;
  const trimmed = iataOrName.trim();
  const upper = trimmed.toUpperCase();

  // 1. 精確 IATA 碼比對
  if (AIRPORT_COORDS[upper]) return AIRPORT_COORDS[upper];

  // 2. 精確機場城市名比對
  const exactAirport = Object.values(AIRPORT_COORDS).find((a) => a.city === trimmed);
  if (exactAirport) return exactAirport;

  // 3. 前綴模糊比對（例如「台北」匹配「台北桃園」）
  const partialAirport = Object.values(AIRPORT_COORDS).find(
    (a) => a.city.startsWith(trimmed) || trimmed.startsWith(a.city)
  );
  if (partialAirport) return partialAirport;

  // 4. 精確城市座標比對（中文）
  if (CITY_COORDS[trimmed]) return CITY_COORDS[trimmed];

  // 5. 子字串模糊比對（中文，例如「台北車站」匹配「台北」）
  const cityEntry = Object.entries(CITY_COORDS).find(
    ([name]) => trimmed.includes(name) || name.includes(trimmed)
  );
  if (cityEntry) return cityEntry[1];

  // 6. 英文城市名（大小寫不敏感）
  const lower = trimmed.toLowerCase();
  if (EN_CITY_COORDS[lower]) return EN_CITY_COORDS[lower];

  // 7. 英文城市名子字串模糊比對（例如 "Stockholm Central" 匹配 "stockholm"）
  const enEntry = Object.entries(EN_CITY_COORDS).find(
    ([name]) => lower.includes(name) || name.includes(lower)
  );
  return enEntry ? enEntry[1] : null;
}
