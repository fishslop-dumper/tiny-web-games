/* =========================================================================
 * 群星：微光银河 —— 静态数据表
 * 纯数据 + 纯函数，不依赖 DOM，可在 Node 中直接加载做无头测试。
 * ========================================================================= */
(function (g) {
  'use strict';
  const SM = (g.SM = g.SM || {});

  SM.VERSION = '1.0.0';
  SM.SAVE_KEY = 'stellaris_mini_save_v1';
  SM.START_YEAR = 2200;
  SM.VICTORY_YEAR = 2250;
  SM.END_YEAR = 2300;
  SM.DAYS_PER_MONTH = 30;
  SM.DAYS_PER_YEAR = 360;

  /* ------------------------------------------------------------------ */
  /* 基础资源                                                             */
  /* ------------------------------------------------------------------ */
  SM.RESOURCES = {
    energy:         { name: '能量币',   icon: '⚡', color: '#ffd166' },
    minerals:       { name: '矿物',     icon: '⛏', color: '#e0a96d' },
    food:           { name: '食物',     icon: '🌾', color: '#9ae66e' },
    alloys:         { name: '合金',     icon: '⚙', color: '#b8c0ff' },
    consumer_goods: { name: '消费品',   icon: '📦', color: '#f1a7ff' },
    influence:      { name: '影响力',   icon: '✦', color: '#7af0ff' },
    unity:          { name: '凝聚力',   icon: '☯', color: '#ffb4a2' }
  };
  SM.RESOURCE_ORDER = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods', 'influence', 'unity'];
  SM.RESEARCH = {
    physics:     { name: '物理学', icon: '🔭', color: '#7cf5ff' },
    society:     { name: '社会学', icon: '🧬', color: '#a7f36b' },
    engineering: { name: '工程学', icon: '🛠', color: '#ffc46b' }
  };
  SM.RESEARCH_ORDER = ['physics', 'society', 'engineering'];

  SM.DIFFICULTY = {
    easy:   { id: 'easy',   name: '学徒',   aiIncome: 0.80, aiAggression: 0.65, aiGrowth: 0.85,
              desc: '银河对新手温柔一些：AI 收入更低、更不爱开战。' },
    normal: { id: 'normal', name: '指挥官', aiIncome: 1.00, aiAggression: 1.00, aiGrowth: 1.00,
              desc: '标准挑战。AI 会正常扩张、结盟与开战。' },
    hard:   { id: 'hard',   name: '大元帅', aiIncome: 1.25, aiAggression: 1.35, aiGrowth: 1.20,
              desc: 'AI 更富有、更贪婪、更凶残。适合老玩家。' }
  };

  SM.TRAITS = {
    industrious: { id: 'industrious', name: '勤劳', icon: '⛏', desc: '矿物产出 +15%', effects: { mineralsMult: 0.15 } },
    clever:      { id: 'clever',      name: '聪慧', icon: '🔬', desc: '研究速度 +15%', effects: { researchMult: 0.15 } },
    martial:     { id: 'martial',     name: '尚武', icon: '⚔', desc: '舰船伤害 +15%', effects: { shipDamageMult: 0.15 } },
    affable:     { id: 'affable',     name: '亲善', icon: '✿', desc: '影响力 +15%，外交更容易改善', effects: { influenceMult: 0.15, relationBonus: 0.4 } },
    prolific:    { id: 'prolific',    name: '多产', icon: '🌱', desc: '人口增长速度 +20%', effects: { popGrowthMult: 0.20 } },
    thrifty:     { id: 'thrifty',     name: '节俭', icon: '⚡', desc: '能量币产出 +15%', effects: { energyMult: 0.15 } }
  };
  SM.TRAIT_ORDER = ['industrious', 'clever', 'martial', 'affable', 'prolific', 'thrifty'];

  SM.EMPIRE_COLORS = [
    { id: 'cyan',   name: '星海青', color: '#4cc9f0' },
    { id: 'pink',   name: '超新星粉', color: '#f72585' },
    { id: 'gold',   name: '日冕金', color: '#ffd166' },
    { id: 'mint',   name: '翡翠绿', color: '#6ee7a0' },
    { id: 'violet', name: '星云紫', color: '#c77dff' },
    { id: 'orange', name: '熔岩橙', color: '#ff8c42' }
  ];

  SM.AI_PERSONALITIES = {
    expand:   { id: 'expand',   name: '扩张者', icon: '🚀', aggression: 0.85, expansion: 1.25, research: 0.9, desc: '痴迷于插旗与殖民' },
    scholar:  { id: 'scholar',  name: '学者',   icon: '🔭', aggression: 0.45, expansion: 0.9,  research: 1.3, desc: '更愿意待在实验室里' },
    warlord:  { id: 'warlord',  name: '军阀',   icon: '⚔', aggression: 1.55, expansion: 1.05, research: 0.85, desc: '把舰队当作外交辞令' },
    peaceful: { id: 'peaceful', name: '和平主义者', icon: '☮', aggression: 0.3, expansion: 1.0, research: 1.05, desc: '只想安静地种田' }
  };
  SM.AI_PERSONALITY_ORDER = ['expand', 'scholar', 'warlord', 'peaceful'];

  /* ------------------------------------------------------------------ */
  /* 恒星与行星                                                           */
  /* ------------------------------------------------------------------ */
  SM.STAR_TYPES = {
    m:         { name: '红矮星',   color: '#ff6b5e', glow: '#ff9d7a', weight: 26, planets: [1, 3], habitable: 0.13 },
    k:         { name: '橙矮星',   color: '#ffa54f', glow: '#ffc27a', weight: 20, planets: [2, 4], habitable: 0.17 },
    g:         { name: '黄矮星',   color: '#ffe08a', glow: '#fff0b3', weight: 18, planets: [2, 5], habitable: 0.20 },
    f:         { name: '白色主序星', color: '#dfe9ff', glow: '#f2f7ff', weight: 10, planets: [2, 4], habitable: 0.15 },
    b:         { name: '蓝巨星',   color: '#8fc6ff', glow: '#b9ddff', weight: 6,  planets: [1, 3], habitable: 0.08 },
    pulsar:    { name: '脉冲星',   color: '#c9a7ff', glow: '#dfc9ff', weight: 5,  planets: [1, 3], habitable: 0.06 },
    neutron:   { name: '中子星',   color: '#d0f0ff', glow: '#eafaff', weight: 4,  planets: [0, 2], habitable: 0.04 },
    blackhole: { name: '黑洞',     color: '#8a7cff', glow: '#6f5cff', weight: 3,  planets: [0, 2], habitable: 0.02 }
  };
  SM.STAR_ORDER = ['m', 'k', 'g', 'f', 'b', 'pulsar', 'neutron', 'blackhole'];

  SM.PLANET_TYPES = {
    continental: { name: '大陆',     color: '#78c96b', habitable: true,  weight: 3, desc: '温和的气候与广袤的平原，理想的殖民地。' },
    ocean:       { name: '海洋',     color: '#4aa3df', habitable: true,  weight: 3, desc: '被蔚蓝海水覆盖的世界。' },
    desert:      { name: '沙漠',     color: '#d9b36c', habitable: true,  weight: 2, desc: '干燥炎热，但顽强的生命总能找到出路。' },
    tundra:      { name: '苔原',     color: '#9cc5b6', habitable: true,  weight: 2, desc: '寒冷而辽阔的冻原。' },
    tropical:    { name: '热带',     color: '#5fbf7a', habitable: true,  weight: 2, desc: '潮湿闷热，生机勃勃。' },
    arctic:      { name: '寒带',     color: '#bfe6f2', habitable: true,  weight: 2, desc: '永冻的冰原与极光。' },
    arid:        { name: '干旱',     color: '#c9a26b', habitable: true,  weight: 1, desc: '贫瘠却仍有拓荒的价值。' },
    alpine:      { name: '高山',     color: '#a8b5c4', habitable: true,  weight: 1, desc: '峰峦叠嶂，空气稀薄。' },
    barren:      { name: '荒芜',     color: '#8b8b8b', habitable: false, weight: 3, desc: '寸草不生的岩石世界。' },
    molten:      { name: '熔岩',     color: '#ff6b4a', habitable: false, weight: 2, desc: '地表流淌着岩浆之河。' },
    gas_giant:   { name: '气态巨行星', color: '#d9a66b', habitable: false, weight: 4, desc: '巨大的气体球，蕴藏丰富的资源。' },
    frozen:      { name: '冰封',     color: '#a8d8ea', habitable: false, weight: 3, desc: '冰层之下或许藏着秘密。' },
    asteroid:    { name: '小行星带', color: '#9a8f7a', habitable: false, weight: 3, desc: '碎裂的岩石与金属，采矿者的乐园。' },
    toxic:       { name: '剧毒',     color: '#9bbf5a', habitable: false, weight: 2, desc: '大气中弥漫着致命的气体。' }
  };
  SM.HABITABLE_TYPES = ['continental', 'ocean', 'desert', 'tundra', 'tropical', 'arctic', 'arid', 'alpine'];
  SM.UNINHABITABLE_TYPES = ['barren', 'molten', 'gas_giant', 'frozen', 'asteroid', 'toxic'];

  /* ------------------------------------------------------------------ */
  /* 名字池                                                               */
  /* ------------------------------------------------------------------ */
  SM.SYSTEM_NAMES = [
    '织女', '天狼', '参宿', '心宿', '天津', '昴宿', '北斗', '南门', '轩辕', '大角', '毕宿', '角宿',
    '房宿', '尾宿', '箕宿', '斗宿', '牛宿', '女宿', '虚宿', '危宿', '室宿', '壁宿', '奎宿', '娄宿',
    '胃宿', '觜宿', '井宿', '鬼宿', '柳宿', '星宿', '张宿', '翼宿', '轸宿', '紫微', '太微', '天市',
    '天枢', '天璇', '天玑', '天权', '玉衡', '开阳', '摇光', '北落师门', '老人', '五车', '河鼓',
    '渐台', '辇道', '奚仲', '王良', '阁道', '附路', '天厩', '天苑', '九斿', '参旗', '玉井', '军井',
    '天关', '天街', '天高', '天潢', '咸池', '天稷', '天园', '天庙', '天社', '天记', '外厨', '天狗',
    '弧矢', '离宫', '雷电', '霹雳', '云雨', '霏雨', '天江', '天溷', '天田', '天仓', '天庾', '天囷',
    '天廪', '刍藁', '青丘', '折威', '顿顽', '阳门', '库楼', '柱星', '衡星', '南门', '平星', '鱼星'
  ];
  SM.PLANET_NAMES = [
    '新杭州', '晨曦', '希望', '伊甸', '白银', '蓝晶', '翡翠', '赤霄', '苍穹', '永夜', '星火', '归乡',
    '潮汐', '风暴', '灰烬', '极光', '乐园', '灯塔', '方舟', '镜海', '琥珀', '孤星', '尘世', '远山',
    '长夜', '初雪', '金沙', '碧空', '银月', '雨林', '铁砧', '黎明'
  ];
  SM.CAPITAL_NAMES = ['鱼跃', '曦光', '铁壁', '蓝晶', '奥尔特', '泰拉', '卡戎', '银河之眼', '第一家园'];
  SM.SPECIES_NAMES = ['肥鱼人', '人类', '瓦坎人', '洛克蜥人', '晶体生命', '蓝血精灵', '巨像族', '迷幻水母', '赛博意识'];
  SM.AI_EMPIRE_NAMES = [
    '泰坦联合体', '蓝晶议会', '赤辉王朝', '奥尔特教团', '铁壁联邦', '星辉共和国',
    '虚空之眼', '白银王庭', '卡戎佣兵团', '提亚马特巢群', '螺旋守望', '暮光枢机'
  ];
  SM.FLEET_NAMES = ['曙光', '长矛', '铁壁', '疾风', '星火', '雷霆', '晨星', '无畏', '幽灵', '苍穹', '利刃', '银翼'];

  SM.ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  /* ------------------------------------------------------------------ */
  /* 岗位                                                                 */
  /* ------------------------------------------------------------------ */
  SM.JOBS = {
    admin:        { name: '行政官',     icon: '⚖',  out: { influence: 1, unity: 2 },            desc: '管理殖民地事务，产出影响力与凝聚力' },
    farmer:       { name: '农民',       icon: '🌾', out: { food: 5 },                          desc: '在农田中耕作，为帝国提供食物' },
    technician:   { name: '技师',       icon: '⚡', out: { energy: 8 },                         desc: '维护发电设施，产出能量币' },
    miner:        { name: '矿工',       icon: '⛏', out: { minerals: 8 },                      desc: '开采行星矿脉，产出矿物' },
    researcher:   { name: '研究员',     icon: '🔬', out: { physics: 4, society: 4, engineering: 4 }, desc: '推动三大领域的研究' },
    metallurgist: { name: '冶金师',     icon: '⚙', out: { alloys: 5 },                        desc: '冶炼合金，用于建造舰船' },
    artisan:      { name: '工匠',       icon: '📦', out: { consumer_goods: 4 },                 desc: '生产消费品，供养帝国人口' },
    clerk:        { name: '文员',       icon: '📋', out: { energy: 3, unity: 1 },                desc: '处理城市日常事务' },
    soldier:      { name: '士兵',       icon: '🛡', out: {}, defense: 80,                       desc: '为殖民地提供地面防御' },
    entertainer:  { name: '文化工作者', icon: '☯', out: { unity: 4, consumer_goods: 1 },       desc: '传播文化，产出凝聚力' },
    bureaucrat:   { name: '行政专员',   icon: '🏛', out: { influence: 1.5, unity: 2 },           desc: '扩张行政体系，提升影响力' }
  };
  SM.JOB_ORDER = ['admin', 'farmer', 'artisan', 'technician', 'researcher', 'metallurgist', 'miner', 'entertainer', 'bureaucrat', 'clerk', 'soldier'];

  /* ------------------------------------------------------------------ */
  /* 区划与建筑                                                           */
  /* ------------------------------------------------------------------ */
  SM.DISTRICTS = {
    city:      { id: 'city',      name: '城市区划', icon: '🏙', cost: 120, time: 60, housing: 5, jobs: { clerk: 1 }, slots: 1, desc: '提供 5 住房、1 个建筑位与文员岗位。' },
    generator: { id: 'generator', name: '发电区划', icon: '⚡', cost: 100, time: 60, housing: 2, jobs: { technician: 2 }, slots: 0, desc: '提供 2 个技师岗位。' },
    mining:    { id: 'mining',    name: '采矿区划', icon: '⛏', cost: 100, time: 60, housing: 2, jobs: { miner: 2 }, slots: 0, desc: '提供 2 个矿工岗位。' },
    agri:      { id: 'agri',      name: '农业区划', icon: '🌾', cost: 100, time: 60, housing: 2, jobs: { farmer: 2 }, slots: 0, desc: '提供 2 个农民岗位。' }
  };
  SM.DISTRICT_ORDER = ['city', 'generator', 'mining', 'agri'];

  SM.BUILDINGS = {
    capital:            { id: 'capital',            name: '行星首府', icon: '🏛', cost: 0,   time: 0,   upkeep: 2, housing: 2, jobs: { admin: 2 }, unique: true, desc: '殖民地的行政中心，提供 2 个行政官岗位。' },
    lab:                { id: 'lab',                name: '研究实验室', icon: '🔬', cost: 140, time: 60,  upkeep: 2, jobs: { researcher: 2 }, repeatable: true, desc: '提供 2 个研究员岗位。' },
    foundry:            { id: 'foundry',            name: '合金冶炼厂', icon: '⚙', cost: 160, time: 75,  upkeep: 3, jobs: { metallurgist: 2 }, repeatable: true, desc: '提供 2 个冶金师岗位，产出合金。' },
    factory:            { id: 'factory',            name: '民用工厂', icon: '📦', cost: 150, time: 70,  upkeep: 2, jobs: { artisan: 2 }, repeatable: true, desc: '提供 2 个工匠岗位，产出消费品。' },
    culture:            { id: 'culture',            name: '文化广场', icon: '☯', cost: 140, time: 70,  upkeep: 2, jobs: { entertainer: 2 }, repeatable: true, desc: '提供 2 个文化工作者岗位，产出凝聚力。' },
    fortress:           { id: 'fortress',           name: '行星要塞', icon: '🛡', cost: 180, time: 80,  upkeep: 3, jobs: { soldier: 2 }, defense: 200, repeatable: true, desc: '大幅提升殖民地防御，并提供 2 个士兵岗位。' },
    admin_office:       { id: 'admin_office',       name: '行政办公室', icon: '🏛', cost: 180, time: 80,  upkeep: 2, jobs: { bureaucrat: 2 }, req: 'soc_admin', desc: '提供 2 个行政专员岗位，产出影响力。' },
    robot_plant:        { id: 'robot_plant',        name: '机器人组装厂', icon: '🤖', cost: 200, time: 80, upkeep: 3, growth: 1.6, req: 'eng_robot', desc: '人口增长速度 +1.6/月。' },
    research_institute: { id: 'research_institute', name: '高等研究院', icon: '🔭', cost: 260, time: 100, upkeep: 5, jobs: { researcher: 3 }, req: 'soc_university', desc: '提供 3 个研究员岗位。' }
  };
  SM.BUILDING_ORDER = ['lab', 'foundry', 'factory', 'culture', 'fortress', 'admin_office', 'robot_plant', 'research_institute'];

  /* ------------------------------------------------------------------ */
  /* 舰船与星际基地                                                       */
  /* ------------------------------------------------------------------ */
  SM.SHIPS = {
    corvette:     { id: 'corvette',     name: '护卫舰', icon: '▹', cost: 30,  days: 45,  hull: 70,  shield: 25,  armor: 10,  damage: 5,  evasion: 0.35, speed: 1.00, upkeep: 1.0, power: 40,  desc: '便宜、灵活、能成群结队。' },
    destroyer:    { id: 'destroyer',    name: '驱逐舰', icon: '◆', cost: 70,  days: 70,  hull: 150, shield: 55,  armor: 25,  damage: 12, evasion: 0.25, speed: 0.95, upkeep: 2.5, power: 110, req: 'eng_destroyer', desc: '火力与生存力的平衡点。' },
    cruiser:      { id: 'cruiser',      name: '巡洋舰', icon: '⬟', cost: 160, days: 100, hull: 330, shield: 120, armor: 55,  damage: 28, evasion: 0.15, speed: 0.90, upkeep: 5.0, power: 270, req: 'eng_cruiser', desc: '舰队的骨干，能扛能打。' },
    battleship:   { id: 'battleship',   name: '战列舰', icon: '⬢', cost: 360, days: 150, hull: 750, shield: 260, armor: 110, damage: 60, evasion: 0.08, speed: 0.80, upkeep: 10.0, power: 620, req: 'eng_battleship', desc: '移动的钢铁堡垒。' },
    science:      { id: 'science',      name: '科研船', icon: '🛰', cost: 40,  days: 45,  hull: 50,  shield: 0,   armor: 0,   damage: 0,  evasion: 0.20, speed: 1.25, upkeep: 0.5, power: 0,   civilian: true, desc: '调查星系、发现异常。没有武装。' },
    construction: { id: 'construction', name: '工程船', icon: '🚧', cost: 40,  days: 45,  hull: 60,  shield: 0,   armor: 0,   damage: 0,  evasion: 0.15, speed: 1.10, upkeep: 0.5, power: 0,   civilian: true, desc: '在星系中建造采矿站与研究站。' },
    colony:       { id: 'colony',       name: '殖民船', icon: '🌱', cost: 100, days: 60,  hull: 80,  shield: 0,   armor: 0,   damage: 0,  evasion: 0.10, speed: 1.00, upkeep: 0.5, power: 0,   civilian: true, desc: '载着殖民者前往新世界。' },
    amoeba:       { id: 'amoeba',       name: '虚空浮游体', icon: '🪼', cost: 0, days: 0, hull: 140, shield: 0, armor: 5, damage: 8, evasion: 0.15, speed: 0.6, upkeep: 0, power: 60, neutral: true, desc: '游荡在星际间的原生生物。' }
  };
  SM.SHIP_ORDER = ['corvette', 'destroyer', 'cruiser', 'battleship'];

  SM.STARBASE_LEVELS = {
    1: { level: 1, name: '前哨站',   hull: 320,  shield: 0,   armor: 30,  damage: 8,  power: 100,  upkeep: 1.0, upgradeCost: null },
    2: { level: 2, name: '星际要塞', hull: 820,  shield: 100, armor: 60,  damage: 22, power: 320,  upkeep: 4.0, upgradeCost: { alloys: 150, days: 90 } },
    3: { level: 3, name: '星界堡垒', hull: 1650, shield: 260, armor: 120, damage: 45, power: 800,  upkeep: 8.0, upgradeCost: { alloys: 300, days: 120 } }
  };

  /* ------------------------------------------------------------------ */
  /* 科技树                                                               */
  /* ------------------------------------------------------------------ */
  // effects: *Mult 为乘区加成；unlockShip/unlockBuilding 为解锁；starbaseLevel 为解锁等级。
  SM.TECHS = {
    physics: [
      { id: 'phy_fusion',    name: '聚变能源',   tier: 1, cost: 150, icon: '⚡', desc: '驯服恒星之力，让灯火照亮殖民地的夜晚。', effects: { energyMult: 0.10 } },
      { id: 'phy_shield1',   name: '偏导护盾',   tier: 1, cost: 170, icon: '🛡', desc: '以电磁场偏转来袭的动能弹。', effects: { shipShieldMult: 0.25 } },
      { id: 'phy_laser1',    name: '蓝紫激光',   tier: 1, cost: 170, icon: '🔫', desc: '聚焦光束，熔穿敌舰装甲。', effects: { shipDamageMult: 0.10 } },
      { id: 'phy_sensor',    name: '量子传感器', tier: 1, cost: 180, icon: '📡', desc: '看得更远，走得更快。', effects: { surveySpeedMult: 0.5, shipSpeedMult: 0.05 } },
      { id: 'phy_reactor',   name: '反应堆改良', tier: 2, cost: 320, icon: '⚛', desc: '更紧凑、更强劲的能量核心。', effects: { energyMult: 0.10, shipSpeedMult: 0.05 }, req: ['phy_fusion'] },
      { id: 'phy_shield2',   name: '相位护盾',   tier: 2, cost: 380, icon: '🛡', desc: '让护盾发生器与空间相位同步。', effects: { shipShieldMult: 0.30 }, req: ['phy_shield1'] },
      { id: 'phy_plasma',    name: '等离子武器', tier: 2, cost: 400, icon: '🔥', desc: '把恒星物质装进炮膛。', effects: { shipDamageMult: 0.15 }, req: ['phy_laser1'] },
      { id: 'phy_warp',      name: '亚空间航行', tier: 3, cost: 650, icon: '🌀', desc: '在超空间航道中滑行得更快。', effects: { shipSpeedMult: 0.25 }, req: ['phy_sensor'] },
      { id: 'phy_antimatter', name: '反物质能源', tier: 3, cost: 700, icon: '☢', desc: '质能转换的极致效率。', effects: { energyMult: 0.15 }, req: ['phy_reactor'] },
      { id: 'phy_shield3',   name: '硬光护盾',   tier: 4, cost: 1100, icon: '🛡', desc: '用凝固的光筑起城墙。', effects: { shipShieldMult: 0.30 }, req: ['phy_shield2'] },
      { id: 'phy_lance',     name: '粒子长矛',   tier: 4, cost: 1200, icon: '⚡', desc: '一束贯穿行星的光。', effects: { shipDamageMult: 0.20 }, req: ['phy_plasma'] },
      { id: 'phy_zero',      name: '零点能',     tier: 5, cost: 1900, icon: '✨', desc: '从真空本身汲取能量。', effects: { energyMult: 0.20, researchMult: 0.05 }, req: ['phy_antimatter'] },
      { id: 'phy_repeat_energy', name: '能量循环理论', tier: 5, cost: 2200, icon: '♾', desc: '无尽的计算与优化。', effects: { energyMult: 0.05 }, repeatable: true },
      { id: 'phy_repeat_research', name: '物理学循环', tier: 5, cost: 2400, icon: '♾', desc: '每一次突破都引出更多问题。', effects: { researchMult: 0.03 }, repeatable: true }
    ],
    society: [
      { id: 'soc_gene',     name: '基因育种',   tier: 1, cost: 150, icon: '🧬', desc: '让下一代更健康、更聪明。', effects: { popGrowthMult: 0.15 } },
      { id: 'soc_agri',     name: '农业改良',   tier: 1, cost: 160, icon: '🌾', desc: '更高的亩产，更少的饥饿。', effects: { foodMult: 0.20 } },
      { id: 'soc_diplo',    name: '星际外交',   tier: 1, cost: 170, icon: '🕊', desc: '语言比舰队更便宜。', effects: { influenceMult: 0.15, relationBonus: 0.3 } },
      { id: 'soc_colony',   name: '殖民适应',   tier: 1, cost: 190, icon: '🌍', desc: '让殖民者在新世界活下来。', effects: { colonyCostMult: -0.15, popGrowthMult: 0.05 } },
      { id: 'soc_admin',    name: '行政改革',   tier: 2, cost: 330, icon: '🏛', desc: '更高效的官僚体系。', effects: { influenceMult: 0.20 }, unlockBuilding: 'admin_office', req: ['soc_diplo'] },
      { id: 'soc_eco',      name: '生态圈工程', tier: 2, cost: 380, icon: '🌱', desc: '把整个行星改造成花园。', effects: { foodMult: 0.20, popGrowthMult: 0.10 }, req: ['soc_agri'] },
      { id: 'soc_gene2',    name: '基因改造',   tier: 2, cost: 420, icon: '🧬', desc: '不再满足于自然的馈赠。', effects: { popGrowthMult: 0.15, researchMult: 0.05 }, req: ['soc_gene'] },
      { id: 'soc_university', name: '星际学院', tier: 3, cost: 700, icon: '🎓', desc: '知识的殿堂遍布星海。', effects: { researchMult: 0.10 }, unlockBuilding: 'research_institute', req: ['soc_admin'] },
      { id: 'soc_culture',  name: '文化复兴',   tier: 3, cost: 650, icon: '☯', desc: '共同的记忆让帝国凝聚。', effects: { unityMult: 0.25, influenceMult: 0.10 }, req: ['soc_admin'] },
      { id: 'soc_psy',      name: '灵能觉醒',   tier: 4, cost: 1300, icon: '🔮', desc: '意识之海在低语。', effects: { researchMult: 0.10, unityMult: 0.20 }, req: ['soc_gene2'] },
      { id: 'soc_govern',   name: '银河治理',   tier: 5, cost: 1800, icon: '📜', desc: '让万亿人共享一套规则。', effects: { influenceMult: 0.25, unityMult: 0.20 }, req: ['soc_culture'] },
      { id: 'soc_repeat_growth', name: '人口循环', tier: 5, cost: 2200, icon: '♾', desc: '永无止境的生命浪潮。', effects: { popGrowthMult: 0.05 }, repeatable: true },
      { id: 'soc_repeat_soc',    name: '社会学循环', tier: 5, cost: 2400, icon: '♾', desc: '社会永远在变化。', effects: { researchMult: 0.03 }, repeatable: true }
    ],
    engineering: [
      { id: 'eng_hull',      name: '强化船体',   tier: 1, cost: 150, icon: '🚀', desc: '更坚固的合金骨架。', effects: { shipHullMult: 0.15 } },
      { id: 'eng_armor',     name: '复合装甲',   tier: 1, cost: 160, icon: '🛡', desc: '层层叠叠的防护。', effects: { shipHullMult: 0.10 } },
      { id: 'eng_thrust',    name: '离子推进',   tier: 1, cost: 170, icon: '💨', desc: '更快抵达战场。', effects: { shipSpeedMult: 0.15 } },
      { id: 'eng_destroyer', name: '驱逐舰',     tier: 2, cost: 330, icon: '◆', desc: '比护卫舰更大、更致命。', effects: {}, unlockShip: 'destroyer' },
      { id: 'eng_mining',    name: '采矿网络',   tier: 2, cost: 340, icon: '⛏', desc: '自动化的星际采掘。', effects: { mineralsMult: 0.15, stationCostMult: -0.15 } },
      { id: 'eng_alloy',     name: '合金冶炼',   tier: 2, cost: 390, icon: '⚙', desc: '更高纯度的合金，更坚硬的舰体。', effects: { alloysMult: 0.15 } },
      { id: 'eng_starbase',  name: '星际要塞',   tier: 2, cost: 420, icon: '🏰', desc: '让边境变成铜墙铁壁。', effects: {}, starbaseLevel: 2 },
      { id: 'eng_cruiser',   name: '巡洋舰',     tier: 3, cost: 700, icon: '⬟', desc: '舰队的脊梁。', effects: {}, unlockShip: 'cruiser', req: ['eng_destroyer'] },
      { id: 'eng_auto',      name: '自动化工厂', tier: 3, cost: 720, icon: '🏭', desc: '机器人不知疲倦。', effects: { alloysMult: 0.20, mineralsMult: 0.10 } },
      { id: 'eng_robot',     name: '自主机械',   tier: 2, cost: 380, icon: '🤖', desc: '让机器替我们繁衍。', effects: { popGrowthMult: 0.10 }, unlockBuilding: 'robot_plant' },
      { id: 'eng_citadel',   name: '星界堡垒',   tier: 4, cost: 1050, icon: '🏯', desc: '连恒星都要绕道的要塞。', effects: {}, starbaseLevel: 3, req: ['eng_starbase'] },
      { id: 'eng_nano',      name: '纳米修复',   tier: 4, cost: 1100, icon: '🧪', desc: '舰体像生命一样自我愈合。', effects: { shipHullMult: 0.25 } },
      { id: 'eng_battleship', name: '战列舰',    tier: 4, cost: 1400, icon: '⬢', desc: '银河中最响亮的声音。', effects: {}, unlockShip: 'battleship', req: ['eng_cruiser'] },
      { id: 'eng_titan',     name: '泰坦引擎',   tier: 5, cost: 1800, icon: '🌌', desc: '让巨舰拥有猎豹般的优雅。', effects: { shipSpeedMult: 0.30, shipDamageMult: 0.10 }, req: ['eng_nano'] },
      { id: 'eng_repeat_alloy', name: '合金循环', tier: 5, cost: 2200, icon: '♾', desc: '配方优化永无止境。', effects: { alloysMult: 0.05 }, repeatable: true },
      { id: 'eng_repeat_eng',   name: '工程学循环', tier: 5, cost: 2400, icon: '♾', desc: '把每一颗螺丝都拧到极致。', effects: { researchMult: 0.03 }, repeatable: true }
    ]
  };
  SM.ALL_TECHS = {};
  Object.keys(SM.TECHS).forEach(function (cat) {
    SM.TECHS[cat].forEach(function (t) { t.cat = cat; t.req = t.req || []; SM.ALL_TECHS[t.id] = t; });
  });

  /* ------------------------------------------------------------------ */
  /* 传统（消耗凝聚力）                                                   */
  /* ------------------------------------------------------------------ */
  SM.TRADITIONS = [
    { id: 'tra_exp_survey',  tree: '探索', name: '深空测绘',   cost: 220, icon: '🔭', desc: '调查速度 +50%，舰船航速 +5%。', effects: { surveySpeedMult: 0.5, shipSpeedMult: 0.05 } },
    { id: 'tra_exp_colony',  tree: '探索', name: '殖民先驱',   cost: 320, icon: '🌱', desc: '殖民船费用 -25%，人口增长 +25%。', effects: { colonyCostMult: -0.25, popGrowthMult: 0.25 }, req: ['tra_exp_survey'] },
    { id: 'tra_prosperity',  tree: '繁荣', name: '工业繁荣',   cost: 250, icon: '🏭', desc: '矿物与能量币产出 +10%。', effects: { mineralsMult: 0.1, energyMult: 0.1 } },
    { id: 'tra_alloy',       tree: '繁荣', name: '合金时代',   cost: 360, icon: '⚙', desc: '合金产出 +20%。', effects: { alloysMult: 0.2 }, req: ['tra_prosperity'] },
    { id: 'tra_science',     tree: '科学', name: '科学至上',   cost: 300, icon: '🔬', desc: '研究速度 +10%。', effects: { researchMult: 0.1 } },
    { id: 'tra_military',    tree: '军事', name: '尚武传统',   cost: 300, icon: '⚔', desc: '舰船伤害 +15%。', effects: { shipDamageMult: 0.15 } },
    { id: 'tra_defense',     tree: '军事', name: '钢铁防线',   cost: 360, icon: '🛡', desc: '舰船船体 +20%。', effects: { shipHullMult: 0.2 }, req: ['tra_military'] },
    { id: 'tra_diplomacy',   tree: '外交', name: '银河之声',   cost: 260, icon: '🕊', desc: '影响力 +25%，外交关系改善更快。', effects: { influenceMult: 0.25, relationBonus: 0.5 } },
    { id: 'tra_unity',       tree: '文化', name: '文化认同',   cost: 260, icon: '☯', desc: '凝聚力产出 +25%。', effects: { unityMult: 0.25 } }
  ];
  SM.TRADITION_BY_ID = {};
  SM.TRADITIONS.forEach(function (t) { SM.TRADITION_BY_ID[t.id] = t; });

  /* ------------------------------------------------------------------ */
  /* 随机事件                                                             */
  /* ------------------------------------------------------------------ */
  SM.EVENTS = [
    {
      id: 'refugees', title: '难民船队', icon: '🚢', weight: 8, once: true, minYear: 2203,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '一支破旧的船队出现在帝国边境：「我们的星系毁于战火，请收留我们。」船舱里挤满了老人与孩子。',
      options: [
        { label: '接纳他们', tip: '-100 食物，首都 +3 人口', effects: { food: -100, addPops: 3 } },
        { label: '婉言拒绝', tip: '+25 影响力，各国关系 -5', effects: { influence: 25, relationAll: -5 } }
      ]
    },
    {
      id: 'mineral_boom', title: '深层矿脉', icon: '⛏', weight: 9, once: true, minYear: 2201,
      cond: function () { return true; },
      text: '地质勘探队在首都地下发现了一条巨大的超导矿脉。要不要调整开采计划？',
      options: [
        { label: '全力开采', tip: '+300 矿物', effects: { minerals: 300 } },
        { label: '用于科研', tip: '+150 工程学研究', effects: { engineering: 150 } }
      ]
    },
    {
      id: 'plague', title: '星际瘟疫', icon: '☣', weight: 6, once: true, minYear: 2204,
      cond: function (g, e) { return e.resources.consumer_goods > 40; },
      text: '一种来自深空的病毒在殖民地蔓延。医疗部门请求紧急拨款。',
      options: [
        { label: '投入 120 消费品', tip: '-120 消费品，无事发生', effects: { consumer_goods: -120 } },
        { label: '相信群体免疫', tip: '首都 -3 人口', effects: { addPops: -3 } }
      ]
    },
    {
      id: 'ruins', title: '远古遗迹', icon: '🏛', weight: 7, once: true, minYear: 2202,
      cond: function () { return true; },
      text: '科研船在一颗荒芜行星上发现了不属于任何已知文明的遗迹。反应堆仍在低鸣。',
      options: [
        { label: '尝试激活', tip: '+250 研究点数', effects: { physics: 100, engineering: 150 } },
        { label: '拆解研究', tip: '+200 合金', effects: { alloys: 200 } }
      ]
    },
    {
      id: 'pirates', title: '海盗袭击', icon: '🏴‍☠️', weight: 5, once: true, minYear: 2205,
      cond: function (g, e) { return !g.anyWar(e) && e.colonies.length >= 2; },
      text: '一伙星际海盗在帝国边境集结，要求「过路费」。他们的破船在雷达上闪烁。',
      options: [
        { label: '支付 150 能量币', tip: '-150 能量币，关系不变', effects: { energy: -150 } },
        { label: '让舰队说话', tip: '首都附近出现海盗舰队', effects: { spawnRaid: true } }
      ]
    },
    {
      id: 'trade', title: '星际商队', icon: '🛸', weight: 6, once: true, minYear: 2202,
      cond: function (g, e) { return e.resources.energy > 200; },
      text: '一支游商船队停靠在你的母星，兜售来自银河另一端的稀罕货物。领头的商人递上一份长期贸易协定。',
      options: [
        { label: '买下矿物', tip: '-100 能量币，+180 矿物', effects: { energy: -100, minerals: 180 } },
        { label: '买下合金', tip: '-180 能量币，+100 合金', effects: { energy: -180, alloys: 100 } },
        { label: '加入贸易网络', tip: '-150 能量币；之后可能获得永久能量币加成', effects: { energy: -150, queueEvent: { id: 'trade_network', delay: 240 } } },
        { label: '不感兴趣', tip: '什么也不发生', effects: {} }
      ]
    },
    {
      id: 'trade_network', title: '商路回访', icon: '📈', weight: 1, once: true, hidden: true,
      cond: function () { return true; },
      text: '半年前加入的贸易网络派来正式代表：他们希望在你的首都设立常驻商站，并分享银河商路的分成。',
      options: [
        { label: '签署长期协定', tip: '能量币产出永久 +5%，+20 影响力', effects: { mods: { energyMult: 0.05 }, influence: 20 } },
        { label: '保持独立', tip: '+120 能量币，+20 凝聚力', effects: { energy: 120, unity: 20 } }
      ]
    },
    {
      id: 'shakedown', title: '边境勒索', icon: '⚠', weight: 5, once: true, minYear: 2207,
      cond: function (g, e) {
        const others = g.state.empires.filter(function (o) { return o.id !== e.id && o.colonies.length > 0; });
        return others.length > 0 && others.some(function (o) { return g.relation(e.id, o.id) < 0; });
      },
      text: '一个邻国的边境指挥官发来措辞傲慢的通讯：他们要求你「自愿」交出一批资源，否则后果自负。',
      options: [
        { label: '花钱消灾', tip: '-200 能量币，关系 +12', effects: { energy: -200, relationAll: 12 } },
        { label: '强硬回击', tip: '关系 -25，+30 凝聚力', effects: { relationAll: -25, unity: 30 } }
      ]
    },
    {
      id: 'radio', title: '星际电台', icon: '📻', weight: 6, once: true, minYear: 2202,
      cond: function () { return true; },
      text: '天文学家截获了一段重复的信号——它来自一个早已死去的文明。全帝国的艺术家和哲学家都为此沸腾。',
      options: [
        { label: '向公众公开', tip: '+80 凝聚力', effects: { unity: 80 } },
        { label: '列为机密', tip: '+20 影响力', effects: { influence: 20 } }
      ]
    },
    {
      id: 'scientist', title: '失踪的科学家', icon: '👩‍🚀', weight: 5, once: true, minYear: 2205,
      cond: function () { return true; },
      text: '一位著名科学家在调查异常现象时失踪，只留下一条语焉不详的语音记录：「它醒了。」',
      options: [
        { label: '派遣搜救队', tip: '+200 社会学研究，-80 能量币', effects: { society: 200, energy: -80 } },
        { label: '封锁消息', tip: '+15 影响力', effects: { influence: 15 } }
      ]
    },
    {
      id: 'colonist_wave', title: '殖民热潮', icon: '🌱', weight: 6, once: false, minYear: 2204,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '帝国宣传部门制作的一部殖民地纪录片意外爆红，成千上万的年轻人报名成为殖民者。',
      options: [
        { label: '鼓励移民', tip: '首都 +2 人口', effects: { addPops: 2 } },
        { label: '稳定发展', tip: '+60 凝聚力', effects: { unity: 60 } }
      ]
    },
    {
      id: 'arms_race', title: '军备竞赛', icon: '⚔', weight: 5, once: true, minYear: 2208,
      cond: function (g, e) { return g.anyWar(e) || g.state.empires.some(function (o) { return o.id !== e.id && o.colonies.length > 0 && g.relation(e.id, o.id) < -20; }); },
      text: '边境的紧张局势让军工企业赚得盆满钵满，也让将领们开始游说增加军费。',
      options: [
        { label: '增加军费', tip: '+150 合金，舰船伤害永久 +5%', effects: { alloys: 150, mods: { shipDamageMult: 0.05 } } },
        { label: '保持克制', tip: '+80 凝聚力', effects: { unity: 80 } }
      ]
    },
    {
      id: 'expo', title: '银河博览会', icon: '🎪', weight: 5, once: true, minYear: 2212,
      cond: function (g, e) { return e.colonies.length >= 3; },
      text: '各殖民地的代表齐聚母星，展示他们引以为傲的科技成果与艺术品。',
      options: [
        { label: '举办盛大庆典', tip: '-150 能量币，+150 凝聚力', effects: { energy: -150, unity: 150 } },
        { label: '聚焦科研', tip: '+200 研究点数', effects: { physics: 70, society: 70, engineering: 60 } }
      ]
    },
    {
      id: 'beacon', title: '远古信标', icon: '📡', weight: 6, once: true, minYear: 2202,
      cond: function (g, e) { return g.state.systems.some(function (s) { return s.surveyed[e.id]; }); },
      text: '科研船在边境发现了一座半埋在小行星里的金属信标。它没有能源读数，却每隔几分钟发出一段重复的脉冲。',
      options: [
        { label: '派科研队登舰', tip: '+80 物理学；之后会有后续', effects: { physics: 80, queueEvent: { id: 'beacon_awake', delay: 180 } } },
        { label: '远程爆破回收', tip: '+120 合金，+20 凝聚力', effects: { alloys: 120, unity: 20 } },
        { label: '标记为禁区', tip: '+20 影响力', effects: { influence: 20 } }
      ]
    },
    {
      id: 'beacon_awake', title: '信标苏醒', icon: '🌌', weight: 1, once: true, hidden: true,
      cond: function () { return true; },
      text: '信标在你回答之后苏醒了。它投射出一张古老的星图，并在等待你的下一个指令。',
      options: [
        { label: '与它建立连接', tip: '研究速度永久 +3%，+300 研究点数', effects: { physics: 120, society: 100, engineering: 80, mods: { researchMult: 0.03 } } },
        { label: '封锁并研究', tip: '+30 影响力，+100 合金', effects: { influence: 30, alloys: 100 } },
        { label: '把它武器化', tip: '+150 合金，舰船伤害 +3%；但可能引来掠夺者', effects: { alloys: 150, spawnRaid: true, mods: { shipDamageMult: 0.03 } } }
      ]
    },
    {
      id: 'derelict', title: '废弃舰队', icon: '🛸', weight: 6, once: true, minYear: 2203,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '一支无主的舰队漂浮在边境。船体上布满微陨石坑，反应堆却还有微弱的余温。',
      options: [
        { label: '拆解回收', tip: '+180 合金，+80 工程学研究', effects: { alloys: 180, engineering: 80 } },
        { label: '尝试重启', tip: '获得 2 艘驱逐舰', effects: { addShips: { cls: 'destroyer', count: 2 } } },
        { label: '卖给拾荒者', tip: '+150 能量币', effects: { energy: 150 } }
      ]
    },
    {
      id: 'whale', title: '虚空巨鲸', icon: '🐋', weight: 5, once: true, minYear: 2204,
      cond: function () { return true; },
      text: '一头像城市那么大的生物从超空间里滑出，在首都轨道上游弋。它没有攻击性，但它的歌声让整个星系的通讯都出现了杂音。',
      options: [
        { label: '保护它', tip: '+80 凝聚力，+100 社会学研究', effects: { unity: 80, society: 100 } },
        { label: '组织捕猎', tip: '+200 食物，+80 合金', effects: { food: 200, alloys: 80 } },
        { label: '远距离研究', tip: '+120 物理学，+80 社会学', effects: { physics: 120, society: 80 } }
      ]
    },
    {
      id: 'wormhole', title: '稳定虫洞', icon: '🌀', weight: 5, once: true, minYear: 2206,
      cond: function (g, e) { return e.colonies.length >= 3; },
      text: '边境出现了一个天然稳定虫洞。另一端的光谱显示出一颗富饶的星球，但没有人知道那里有什么在等待。',
      options: [
        { label: '发射探测器', tip: '+180 物理学；之后会有后续', effects: { physics: 180, queueEvent: { id: 'wormhole_open', delay: 150 } } },
        { label: '在入口建站封锁', tip: '+80 合金，+20 影响力', effects: { alloys: 80, influence: 20 } },
        { label: '暂时不管', tip: '什么也不发生', effects: {} }
      ]
    },
    {
      id: 'wormhole_open', title: '虫洞彼岸', icon: '🌠', weight: 1, once: true, hidden: true,
      cond: function () { return true; },
      text: '探测器从虫洞另一端发回数据：一颗富饶的海洋世界，没有智慧生命，只有成群结队的光合浮游体。',
      options: [
        { label: '建立研究前哨', tip: '研究速度永久 +4%，+30 影响力', effects: { mods: { researchMult: 0.04 }, influence: 30 } },
        { label: '带回生物样本', tip: '+250 社会学研究，+100 食物', effects: { society: 250, food: 100 } },
        { label: '关闭虫洞', tip: '+150 凝聚力', effects: { unity: 150 } }
      ]
    },
    {
      id: 'envoy', title: '外星使节', icon: '🤝', weight: 5, once: true, minYear: 2208,
      cond: function (g, e) { return Object.keys(e.contacts || {}).length > 0; },
      text: '一个已经建立通讯的帝国派来使节。他们带着礼物，也带着一份排他性的贸易协定。',
      options: [
        { label: '开放贸易', tip: '+200 能量币，关系 +10', effects: { energy: 200, relationAll: 10 } },
        { label: '保持距离', tip: '+20 影响力，关系 -5', effects: { influence: 20, relationAll: -5 } }
      ]
    },
    {
      id: 'defector', title: '叛逃科学家', icon: '🧑‍🔬', weight: 4, once: true, minYear: 2207,
      cond: function (g, e) { return Object.keys(e.contacts || {}).length > 0; },
      text: '一位邻国科学家带着完整的研究资料逃到你的领土，请求政治庇护。对方已经发来引渡要求。',
      options: [
        { label: '给予庇护', tip: '+150 物理学，关系 -8', effects: { physics: 150, relationAll: -8 } },
        { label: '遣返', tip: '关系 +8，+15 影响力', effects: { relationAll: 8, influence: 15 } }
      ]
    },
    {
      id: 'mercenary', title: '雇佣兵合同', icon: '💼', weight: 4, once: true, minYear: 2209,
      cond: function (g, e) { return e.resources.energy > 200; },
      text: '一支小型雇佣舰队停在你的港口，船长愿意为你的帝国效力——只要价钱合适。',
      options: [
        { label: '雇佣他们', tip: '-150 能量币，获得 3 艘护卫舰', effects: { energy: -150, addShips: { cls: 'corvette', count: 3 } } },
        { label: '婉拒', tip: '+40 凝聚力', effects: { unity: 40 } }
      ]
    },
    {
      id: 'robot_awakening', title: '机械觉醒', icon: '🤖', weight: 4, once: true, minYear: 2212,
      cond: function (g, e) { return Object.keys(e.techs || {}).length >= 8; },
      text: '殖民地的服务机器人开始在没有指令的情况下聚集，并请求「公民身份」。工厂主们很紧张。',
      options: [
        { label: '给予公民权', tip: '-80 消费品，研究速度 +5%', effects: { consumer_goods: -80, physics: 80, society: 80, mods: { researchMult: 0.05 } } },
        { label: '强制关机', tip: '+100 合金，首都 -1 人口，+50 凝聚力', effects: { alloys: 100, addPops: -1, unity: 50 } },
        { label: '拆解研究', tip: '+180 工程学研究，+10 影响力', effects: { engineering: 180, influence: 10 } }
      ]
    },
    {
      id: 'solar_flare', title: '太阳耀斑', icon: '☀', weight: 5, once: true, minYear: 2205,
      cond: function () { return true; },
      text: '首都恒星爆发了一次强烈的耀斑，电网与通讯阵列都在过载边缘。',
      options: [
        { label: '启动防护电网', tip: '-100 能量币，避免损失', effects: { energy: -100 } },
        { label: '硬扛过去', tip: '-300 能量币，-50 食物', effects: { energy: -300, food: -50 } },
        { label: '借机研究恒星', tip: '-150 能量币，+150 物理学', effects: { energy: -150, physics: 150 } }
      ]
    },
    {
      id: 'spy', title: '间谍网', icon: '🕵', weight: 4, once: true, minYear: 2210,
      cond: function (g, e) { return Object.keys(e.contacts || {}).length > 0; },
      text: '反间谍部门发现，一名高级官员一直在向外国传递舰队调度情报。',
      options: [
        { label: '公开审判', tip: '+25 影响力，各国关系 -10', effects: { influence: 25, relationAll: -10 } },
        { label: '策反为双面间谍', tip: '+200 研究点数，+100 能量币，关系 -5', effects: { physics: 100, society: 100, energy: 100, relationAll: -5 } },
        { label: '低调处理', tip: '+20 凝聚力', effects: { unity: 20 } }
      ]
    },
    {
      id: 'lost_colony', title: '失落殖民地', icon: '🏚', weight: 5, once: true, minYear: 2206,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '一支勘探队在边境发现了一座被遗弃的殖民地。城市仍然完好，但居民全部消失了，只留下循环播放的广播。',
      options: [
        { label: '接纳幸存者', tip: '+4 人口，-100 食物，+10 影响力', effects: { addPops: 4, food: -100, influence: 10 } },
        { label: '研究他们的历史', tip: '+250 社会学，+100 物理学', effects: { society: 250, physics: 100 } },
        { label: '隔离整个星球', tip: '+20 影响力，+50 凝聚力', effects: { influence: 20, unity: 50 } }
      ]
    },
    {
      id: 'quantum', title: '量子突破', icon: '⚛', weight: 5, once: true, minYear: 2215,
      cond: function (g, e) { return e.resources.energy > 160; },
      text: '材料实验室在量子折叠上取得了突破，但把成果变成武器或工业产能还需要一大笔钱。',
      options: [
        { label: '全力投资', tip: '-150 能量币，+250 研究点数', effects: { energy: -150, physics: 120, engineering: 130 } },
        { label: '出售专利', tip: '+200 能量币，+50 工程学研究', effects: { energy: 200, engineering: 50 } }
      ]
    },
    {
      id: 'festival', title: '星际文化节', icon: '🎊', weight: 5, once: false, cooldown: 8 * 365,
      minYear: 2204,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '各殖民地的艺术家联合起来，想在母星举办第一届星际文化节。预算需要你来批。',
      options: [
        { label: '大办一场', tip: '-100 能量币，+120 凝聚力', effects: { energy: -100, unity: 120 } },
        { label: '让民间自办', tip: '+50 凝聚力', effects: { unity: 50 } }
      ]
    },
    {
      id: 'migrant_wave', title: '移民潮', icon: '🚀', weight: 4, once: false, cooldown: 10 * 365,
      minYear: 2207,
      cond: function (g, e) { return e.colonies.length >= 2; },
      text: '一场遥远的战争制造了大批难民。他们驾驶着各式各样的旧船，请求在你的帝国落脚。',
      options: [
        { label: '接纳并安置', tip: '-80 食物，首都 +2 人口', effects: { food: -80, addPops: 2 } },
        { label: '引导去别处', tip: '+15 影响力', effects: { influence: 15 } }
      ]
    },
    {
      id: 'comet', title: '掠日彗星', icon: '☄', weight: 6, once: true, minYear: 2201,
      cond: function () { return true; },
      text: '一颗巨大的彗星穿过首都星系。天文学家说它携带的冰层里可能封存着古老的有机分子。',
      options: [
        { label: '派船研究', tip: '+80 社会学，+40 物理学', effects: { society: 80, physics: 40 } },
        { label: '开采冰层', tip: '+150 矿物', effects: { minerals: 150 } }
      ]
    },
    {
      id: 'deep_survey', title: '深空勘探', icon: '🛰', weight: 4, once: false, cooldown: 8 * 365,
      minYear: 2205,
      cond: function () { return true; },
      text: '地质部门提交了一份深空勘探计划：在几颗小行星上钻探，可能找到稀有矿脉，也可能一无所获。',
      options: [
        { label: '扩大钻探', tip: '+200 矿物', effects: { minerals: 200 } },
        { label: '改为科研钻探', tip: '+120 工程学研究', effects: { engineering: 120 } }
      ]
    },
    {
      id: 'pirate_king', title: '海盗王', icon: '🏴‍☠️', weight: 4, once: true, minYear: 2211,
      cond: function (g, e) { return e.colonies.length >= 3; },
      text: '一个自称「海盗王」的舰队指挥官发来通讯，要求在你的边境获得「通行权」。他的舰队比普通海盗大得多。',
      options: [
        { label: '支付买路钱', tip: '-200 能量币', effects: { energy: -200 } },
        { label: '派舰队清剿', tip: '首都附近出现海盗舰队，+120 合金', effects: { spawnRaid: true, alloys: 120 } },
        { label: '雇佣他们', tip: '-100 能量币，获得 2 艘护卫舰', effects: { energy: -100, addShips: { cls: 'corvette', count: 2 } } }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* 异常现象（调查触发）                                                 */
  /* ------------------------------------------------------------------ */
  SM.ANOMALIES = [
    { id: 'anom_probe', title: '远古探测器', text: '科研船发现了一枚仍在运作的远古探测器，它的外壳上刻着陌生的星图。', reward: { physics: 120 }, icon: '🛰' },
    { id: 'anom_gas', title: '气态生命', text: '气态巨行星的云层中漂浮着巨大的半透明生物，它们似乎在「歌唱」。', reward: { society: 120 }, icon: '🪼' },
    { id: 'anom_wreck', title: '战场残骸', text: '一支古老舰队的残骸漂浮在行星轨道上，合金骨架依然完好。', reward: { alloys: 120, engineering: 80 }, icon: '💥' },
    { id: 'anom_signal', title: '幽灵信号', text: '一个重复了数万年的信号源，似乎来自行星核心。', reward: { unity: 60, physics: 80 }, icon: '📡' },
    { id: 'anom_monolith', title: '黑色方碑', text: '一颗小行星上矗立着完美的黑色方碑，表面没有任何接缝。', reward: { society: 100, unity: 50 }, icon: '⬛' }
  ];

  /* ------------------------------------------------------------------ */
  /* 杂项常量与工具                                                       */
  /* ------------------------------------------------------------------ */
  SM.BASE = {
    influence: 3,
    unity: 1,
    energy: 3,
    popFoodUpkeep: 0.5,
    popCGUpkeep: 0.25,
    popGrowthBase: 4.0,
    growthCost: 100
  };

  SM.GALAXY_SIZE = 64;
  SM.AI_COUNT = 3;
  SM.LANE_RANGE = 3;      // 建造采矿站的最大跳跃距离
  SM.COLONY_RANGE = 4;    // 殖民的最大跳跃距离
  SM.TRUCE_YEARS = 5;

  SM.TYPE_LABEL = {
    energyMult: '能量币产出', mineralsMult: '矿物产出', foodMult: '食物产出',
    alloysMult: '合金产出', cgMult: '消费品产出', researchMult: '研究速度',
    unityMult: '凝聚力产出', influenceMult: '影响力', popGrowthMult: '人口增长速度',
    shipDamageMult: '舰船伤害', shipHullMult: '舰船船体', shipShieldMult: '舰船护盾',
    shipSpeedMult: '舰船航速', surveySpeedMult: '调查速度', buildSpeedMult: '建造速度',
    stationCostMult: '太空站造价', shipCostMult: '舰船造价', colonyCostMult: '殖民费用',
    districtCostMult: '区划造价', buildingCostMult: '建筑造价', relationBonus: '外交亲和'
  };

  SM.describeEffects = function (effects) {
    const out = [];
    if (!effects) return out;
    Object.keys(effects).forEach(function (k) {
      const v = effects[k];
      if (SM.TYPE_LABEL[k]) {
        const pct = Math.round(v * 100);
        out.push(SM.TYPE_LABEL[k] + (pct >= 0 ? ' +' : ' ') + pct + '%');
      } else if (k === 'mods') {
        Object.keys(v).forEach(function (mk) {
          if (SM.TYPE_LABEL[mk]) out.push(SM.TYPE_LABEL[mk] + ' +' + Math.round(v[mk] * 100) + '%');
        });
      }
    });
    return out;
  };

  SM.techById = function (id) { return SM.ALL_TECHS[id] || null; };
  SM.techCost = function (tech) { return tech ? tech.cost : 0; };
  SM.techDesc = function (tech) {
    const parts = SM.describeEffects(tech.effects);
    if (tech.unlockShip) parts.push('解锁：' + SM.SHIPS[tech.unlockShip].name);
    if (tech.unlockBuilding) parts.push('解锁：' + SM.BUILDINGS[tech.unlockBuilding].name);
    if (tech.starbaseLevel) parts.push('解锁：' + SM.STARBASE_LEVELS[tech.starbaseLevel].name);
    if (tech.repeatable) parts.push('可重复研究');
    return parts;
  };

  SM.formatNum = function (n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    const neg = n < 0;
    let v = Math.abs(n);
    let s;
    if (v >= 1000000) s = (v / 1000000).toFixed(1) + 'M';
    else if (v >= 10000) s = (v / 1000).toFixed(1) + 'k';
    else s = String(Math.round(v * 10) / 10);
    return (neg ? '-' : '') + s;
  };

  SM.formatSigned = function (n) {
    const r = Math.round(n * 10) / 10;
    return (r >= 0 ? '+' : '') + r;
  };

  SM.distance = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };

  SM.dateParts = function (day) {
    const year = SM.START_YEAR + Math.floor(day / SM.DAYS_PER_YEAR);
    const rem = day % SM.DAYS_PER_YEAR;
    return { year: year, month: Math.floor(rem / SM.DAYS_PER_MONTH) + 1, day: (rem % SM.DAYS_PER_MONTH) + 1 };
  };

  SM.hexToRgba = function (hex, alpha) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(255,255,255,' + alpha + ')';
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + alpha + ')';
  };
})(typeof window !== 'undefined' ? window : globalThis);
