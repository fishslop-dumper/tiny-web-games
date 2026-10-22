/* =========================================================================
   永冬 · Frostfall —— 静态数据
   所有数值集中在此，方便调平衡。engine.js 只引用 FW.CFG / FW.BLD / FW.TECHS ...
   ========================================================================= */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});

  FW.CFG = {
    SECTORS: 16,          // 一圈分成 16 个扇区
    RINGS: 7,             // 7 环
    HOURS_PER_DAY: 24,
    HOURS_PER_SEC: 1.15,  // 1 倍速下每现实秒推进的游戏小时
    VICTORY_DAY: 23,      // 熬过第 23 天黎明即胜利
    GEN_MAX_BASE: 2,      // 初始发电机最高档位
    START: {
      pop: 80, wood: 150, steel: 40, coal: 260, raw: 0, meal: 80,
      hope: 55, discontent: 8, genLevel: 1
    }
  };

  /* 资源 */
  FW.RES = {
    coal: { name: '煤炭', icon: '⛁', color: '#b8c6d6', short: '煤' },
    wood: { name: '木材', icon: '▤', color: '#c9a06a', short: '木' },
    steel: { name: '钢铁', icon: '⚙', color: '#9fb3c8', short: '钢' },
    raw: { name: '生食', icon: '❄', color: '#a8d5a2', short: '生' },
    meal: { name: '餐食', icon: '◉', color: '#f0c27b', short: '餐' }
  };

  /* 温度分档：用于 UI 着色与惩罚 */
  FW.TEMP_BANDS = [
    { min: 10, label: '温暖', color: '#ffd166' },
    { min: 0, label: '舒适', color: '#ffb347' },
    { min: -10, label: '寒冷', color: '#7fd4ff' },
    { min: -20, label: '严寒', color: '#5aa9e6' },
    { min: -35, label: '酷寒', color: '#4c7fe0' },
    { min: -999, label: '极寒', color: '#9b8cff' }
  ];
  FW.tempBand = function (t) {
    for (const b of FW.TEMP_BANDS) if (t >= b.min) return b;
    return FW.TEMP_BANDS[FW.TEMP_BANDS.length - 1];
  };

  /* ============================ 建筑 ============================ */
  /* kind: home(居住,提供床位) / work(需要职工) / base(基建)
     heat: true 表示需要供暖才算正常 (否则温度低会掉效率 & 生病)
     produce: {资源: 每职工每小时产量}
     need: 必须建在该地貌上
     slots: 岗位数
     prio: 自动派工的优先顺序(小的优先) */
  FW.BLD = {
    road: {
      name: '道路', icon: '⋯', group: '基建', kind: 'base', cost: {},
      desc: '不耗资源。把新建筑接入城市管网：任何与已建成城区相邻的地块都算连通。'
    },
    hub: {
      name: '蒸汽枢纽', icon: '♨', group: '基建', kind: 'base', cost: { wood: 18, steel: 12 },
      tech: 'hub', heat: true, burn: 1.8,
      desc: '消耗煤炭，为周围 3×3 片区供热，是延伸供热范围的关键。',
      radius: 1
    },

    tent: {
      name: '帐篷', icon: '⌂', group: '居住', kind: 'home', cost: { wood: 18 },
      housing: 20, heat: true, up: 'house',
      desc: '容纳 20 人。没有供暖的居民会不断生病。'
    },
    house: {
      name: '房屋', icon: '⌷', group: '居住', kind: 'home', cost: { wood: 30, steel: 14 },
      housing: 26, heat: true, tech: 'house', bonus: 4, up: null,
      desc: '容纳 26 人，自带保温 +4°C。'
    },

    cookhouse: {
      name: '伙房', icon: '☗', group: '食物', kind: 'work', cost: { wood: 24, steel: 4 },
      slots: 6, prio: 2, heat: true, job: 'cook', cook: { in: 'raw', out: 'meal', ratio: 1.7, per: 2.5 },
      desc: '把生食加工成餐食：满编时每小时处理 2.5 生食，产出 1.7 倍餐食。'
    },
    hunter: {
      name: '猎人小屋', icon: '➶', group: '食物', kind: 'work', cost: { wood: 18 },
      slots: 10, prio: 5, produce: { raw: 2.6 }, heat: false,
      desc: '派出猎人采集生食。不需要供暖，但严寒中效率会下降。'
    },

    sawmill: {
      name: '锯木厂', icon: '⊞', group: '生产', kind: 'work', cost: { wood: 28, steel: 8 },
      slots: 10, prio: 6, need: 'forest', produce: { wood: 2.0 }, heat: false,
      desc: '必须建在树林上。产出木材。'
    },
    coalmine: {
      name: '煤矿', icon: '⛏', group: '生产', kind: 'work', cost: { wood: 32, steel: 16 },
      slots: 10, prio: 1, need: 'coal', produce: { coal: 4.4 }, heat: false,
      desc: '必须建在煤脉上。产出煤炭——发电机的口粮。'
    },
    steelworks: {
      name: '钢铁厂', icon: '⌬', group: '生产', kind: 'work', cost: { wood: 30, steel: 10 },
      slots: 10, prio: 7, need: 'steel', produce: { steel: 1.3 }, heat: false,
      desc: '必须建在铁矿上。产出钢铁。'
    },

    medical: {
      name: '医疗站', icon: '✚', group: '民生', kind: 'work', cost: { wood: 22, steel: 6 },
      slots: 5, prio: 3, heat: true, job: 'medic', treat: 0.3,
      desc: '满编时每小时治愈 0.3 名病人（约 7 人/天）。'
    },
    workshop: {
      name: '工坊', icon: '⚒', group: '民生', kind: 'work', cost: { wood: 26, steel: 8 },
      slots: 5, prio: 4, heat: true, job: 'lab', rp: 1.5,
      desc: '满编时每小时产出 1.5 研究点（约 36 点/天）。研究点是解锁科技的唯一来源。'
    }
  };

  /* 建筑顺序（面板展示用） */
  FW.BLD_ORDER = ['road', 'hub', 'tent', 'house', 'cookhouse', 'hunter', 'sawmill', 'coalmine', 'steelworks', 'medical', 'workshop'];

  /* ============================ 科技 ============================ */
  FW.TECHS = {
    pipe1: { name: '管线延伸 I', cost: 45, group: '供暖', desc: '供热范围 +1 环（当前 2 → 3）。', mod: { range: 1 } },
    pipe2: { name: '管线延伸 II', cost: 85, req: ['pipe1'], group: '供暖', desc: '供热范围再 +1 环（→ 4）。', mod: { range: 1 } },
    heater: { name: '楼宇加热器', cost: 70, group: '供暖', desc: '所有供暖建筑温度 +5°C。', mod: { heater: 5 } },
    insul: { name: '隔热改造', cost: 95, req: ['heater'], group: '供暖', desc: '所有供暖建筑温度 +6°C。', mod: { insul: 6 } },

    gen2: { name: '发电机出力 I', cost: 60, group: '动力', desc: '发电机最高档位提升到 3。', mod: { genMax: 1 } },
    gen3: { name: '发电机出力 II', cost: 110, req: ['gen2'], group: '动力', desc: '发电机最高档位提升到 4。', mod: { genMax: 1 } },
    cool: { name: '过载冷却', cost: 75, req: ['gen2'], group: '动力', desc: '过载压力累积速度减半。', mod: { cool: 1 } },

    hub: { name: '蒸汽枢纽', cost: 40, group: '工程', desc: '解锁蒸汽枢纽，把热量送到供热范围之外。', unlock: 'hub' },
    wood2: { name: '锯木厂改良', cost: 50, group: '工程', desc: '锯木厂产量 +60%。', mod: { wood: 0.6 } },
    coal2: { name: '煤矿改良', cost: 60, group: '工程', desc: '煤矿产量 +50%。', mod: { coal: 0.5 } },
    steel2: { name: '钢铁厂改良', cost: 55, group: '工程', desc: '钢铁厂产量 +50%。', mod: { steel: 0.5 } },

    house: { name: '房屋', cost: 75, group: '民生', desc: '解锁房屋：床位更多，自带 +4°C 保温；帐篷可直接升级。', unlock: 'house' },
    medic2: { name: '医务所', cost: 65, group: '民生', desc: '医疗站治疗效率 +60%，且病人死亡率下降。', mod: { medic: 0.6 } },
    food2: { name: '狩猎工具', cost: 55, group: '民生', desc: '猎人小屋产量 +45%，伙房转化率 +25%。', mod: { hunt: 0.45 } }
  };
  FW.TECH_ORDER = ['pipe1', 'pipe2', 'heater', 'insul', 'gen2', 'gen3', 'cool', 'hub', 'wood2', 'coal2', 'steel2', 'house', 'medic2', 'food2'];

  /* ============================ 天气 ============================ */
  /* 每段：[起始天, 温度, 名称, 是否风暴] */
  FW.WEATHER = [
    { day: 1, temp: -20, label: '初冬', note: '大地开始冻结。' },
    { day: 4, temp: -30, label: '寒潮', note: '气温骤降，注意煤炭储备。' },
    { day: 7, temp: -40, label: '酷寒', note: '暴露在外的工人开始受影响。' },
    { day: 10, temp: -45, label: '深冻', note: '' },
    { day: 13, temp: -50, label: '极寒', note: '' },
    { day: 16, temp: -55, label: '末日之寒', note: '' },
    { day: 18, temp: -60, label: '冰封', note: '风暴正在逼近。' },
    { day: 20, temp: -70, label: '大风暴', storm: true, note: '风暴来袭，一切都将被撕碎。' },
    { day: 23, temp: -50, label: '风暴过后', note: '' }
  ];

  FW.weatherForDay = function (day) {
    let w = FW.WEATHER[0];
    for (const seg of FW.WEATHER) if (day >= seg.day) w = seg;
    return w;
  };

  /* ============================ 事件 ============================ */
  /* trigger: {day:n} 固定日；{random:1} 随机池；cond 额外条件
     choices[].fx: 效果对象 */
  FW.EVENTS = [
    {
      id: 'refugee1', trigger: { day: 4 }, icon: '🚶', title: '雪原上的人影',
      text: '哨兵报告：东南方向的雪原上有一队难民正在靠近，大约 20 人，带着孩子。他们请求进入城市。\n\n我们的储备并不宽裕。',
      choices: [
        {
          label: '接纳他们', hint: '人口 +20，食物压力上升',
          fx: { pop: 24, hope: 6, discontent: 2, res: { raw: 15 } }, after: '难民涌入城市，帐篷挤得满满当当。'
        },
        {
          label: '关闭城门', hint: '希望 -9，不满 +4',
          fx: { hope: -9, discontent: 4, res: { meal: 20 } }, after: '雪原上的人影渐渐被风雪吞没。有些人转过身去不敢看。'
        }
      ]
    },
    {
      id: 'coalcache', trigger: { day: 6 }, icon: '⛁', title: '废弃的补给站',
      text: '侦察队在外环发现了一处被雪掩埋的补给站——大量煤炭，还有几箱工具。但搬空它需要人手和时间。',
      choices: [
        {
          label: '派工人去搬（暂停生产）', hint: '煤炭 +140、钢铁 +18，但今天产量下降',
          fx: { res: { coal: 140, steel: 18 }, slow: { days: 1, mul: 0.7 } }, after: '工人连夜搬运，煤炭堆到了发电机脚下。'
        },
        {
          label: '算了，专心生产', hint: '无损失',
          fx: { discontent: 1 }, after: '补给站最终被雪掩埋。'
        }
      ]
    },
    {
      id: 'petition', trigger: { day: 8 }, icon: '✊', title: '工人请愿',
      text: '一群工人聚在发电机前，要求缩短工时。领头的说：“我们不是机器，在零下四十度里连轴转，会死人的。”',
      choices: [
        {
          label: '同意缩短工时', hint: '不满 -14，产量 -12%（持续 3 天）',
          fx: { discontent: -14, hope: 6, slow: { days: 3, mul: 0.88 } }, after: '工人们散去时向你点头致意，但城市的生产慢了下来。'
        },
        {
          label: '驳回请愿', hint: '不满 +12，产量 +8%（持续 3 天）',
          fx: { discontent: 12, hope: -4, boost: { days: 3, mul: 1.08 } }, after: '他们沉默地回到岗位。效率提高了，但每个人都在看着你。'
        }
      ]
    },
    {
      id: 'plague', trigger: { day: 10 }, icon: '☣', title: '营地的咳嗽声',
      text: '医疗站挤满了人。医生说这是一种在拥挤和寒冷中扩散的肺病——如果不管，它会在几周内杀死我们所有人。',
      choices: [
        {
          label: '倾尽物资救治', hint: '消耗 45 木材、25 钢铁，病人清零',
          fx: { cost: { wood: 45, steel: 25 }, sickFix: true, hope: 5 }, after: '工坊拆了长凳做成病床。咳嗽声渐渐平息。'
        },
        {
          label: '只救能干活的人', hint: '病人 +8，希望 -8，不满 +9',
          fx: { sick: 8, hope: -8, discontent: 9 }, after: '有些人被抬出了医疗站。夜里雪下得很大。'
        }
      ]
    },
    {
      id: 'genbreak', trigger: { day: 12 }, icon: '⚡', title: '发电机异响',
      text: '凌晨，发电机发出一声金属断裂的巨响。管道压力骤降，温度正在流失。工程师说需要立刻抢修。',
      choices: [
        {
          label: '用钢材抢修', hint: '消耗 35 钢铁，立即修复',
          fx: { cost: { steel: 35 }, genFix: true }, after: '凌晨的抢修持续了四个小时。城市重新开始呼吸。'
        },
        {
          label: '硬扛过去', hint: '发电机停机 1 天，希望 -6',
          fx: { genOff: 1, hope: -6, discontent: 8 }, after: '整座城市在黑暗里冻了一夜。死寂中能听到牙齿打颤的声音。'
        }
      ]
    },
    {
      id: 'store', trigger: { day: 14 }, icon: '▤', title: '雪下的仓库',
      text: '清雪队在旧世界的一处仓库废墟下发现了大批建材，但结构随时可能坍塌。',
      choices: [
        {
          label: '冒险搬运', hint: '木材 +110、钢铁 +45，病人 +4',
          fx: { res: { wood: 110, steel: 45 }, sick: 4 }, after: '三名工人被压在梁下。仓库的物资够我们撑很久。'
        },
        {
          label: '安全撤离', hint: '不满 -4',
          fx: { discontent: -4, hope: 3 }, after: '你下令封了废墟。没有人受伤。'
        }
      ]
    },
    {
      id: 'survivors', trigger: { day: 16 }, icon: '🚶', title: '冻原上的营地',
      text: '侦察队找到了一个仍有幸存者的营地——15 人，几个工程师。他们用光了所有煤炭，正在等死。',
      choices: [
        {
          label: '带他们回来', hint: '人口 +18，希望 +8，消耗 40 餐食',
          fx: { pop: 18, hope: 8, res: { meal: -40 } }, after: '工程师们带来了几份旧世界的图纸。工坊的灯亮了整夜。'
        },
        {
          label: '只带走工程师', hint: '研究点 +60，希望 -5',
          fx: { rp: 60, hope: -5, discontent: 5 }, after: '工程师们上雪橇时没有回头。'
        }
      ]
    },
    {
      id: 'stormwarn', trigger: { day: 18 }, icon: '🌪', title: '风暴预警',
      text: '最近的气压读数低得不正常。气象塔的推断是：一股史无前例的风暴将在两天内抵达，温度会跌到零下七十度。\n\n所有人都看着你。',
      choices: [
        {
          label: '全力备战', hint: '煤炭 +60、钢铁 +40（拆掉了部分储备建筑）',
          fx: { res: { coal: 60, steel: 40 }, discontent: 6, hope: -3 }, after: '城市开始像一台机器一样运转起来。'
        },
        {
          label: '安抚人心', hint: '希望 +12，不满 -8，但什么也没储备',
          fx: { hope: 12, discontent: -8 }, after: '你走上广场，告诉他们我们会活下去。他们相信了。'
        }
      ]
    },
    {
      id: 'riot', trigger: { random: 1, cond: function (S) { return S.discontent > 62; } }, icon: '🔥', title: '广场上的人群',
      text: '不满正在燃烧。数百人聚在发电机前，有人开始拆帐篷取火，有人在喊你的名字——用一种难听的方式。',
      choices: [
        {
          label: '让步：分发餐食', hint: '消耗 50 餐食，不满 -22',
          fx: { res: { meal: -50 }, discontent: -22, hope: 4 }, after: '分发餐食花了一整夜。人群散去时天快亮了。'
        },
        {
          label: '强硬：站上台阶', hint: '不满 -8，希望 -6',
          fx: { discontent: -8, hope: -6 }, after: '你一个人站在台阶上看着他们，直到雪把你们一起埋进夜里。'
        }
      ]
    },
    {
      id: 'gift', trigger: { random: 1, cond: function (S) { return S.hope < 40; } }, icon: '✦', title: '一封信',
      text: '一张纸条被塞进了市政厅的门缝：“谢谢你没有放弃我们。”没有署名。',
      choices: [
        {
          label: '把它贴在公告栏上', hint: '希望 +10',
          fx: { hope: 10, discontent: -3 }, after: '第二天，公告栏上多出了十几张纸条。'
        }
      ]
    },
    {
      id: 'gamble', trigger: { random: 1 }, icon: '⛏', title: '深处的煤脉',
      text: '矿工们报告在巷道深处看到了更厚的煤脉，但那里的支撑结构很脆弱。',
      choices: [
        {
          label: '往下挖', hint: '煤炭 +90，病人 +3',
          fx: { res: { coal: 90 }, sick: 3 }, after: '巷道塌了两次。煤炭拉上来了。'
        },
        {
          label: '守住安全线', hint: '不满 -3，希望 +2',
          fx: { discontent: -3, hope: 2 }, after: '矿工们松了口气。'
        }
      ]
    },
    {
      id: 'coldnight', trigger: { random: 1 }, icon: '❄', title: '最冷的一夜',
      text: '温度计的水银冻住了。有人的帐篷在半夜被风撕开。',
      choices: [
        {
          label: '开放发电机大厅', hint: '消耗 25 煤炭，病人 +2，希望 +6',
          fx: { cost: { coal: 25 }, sick: 2, hope: 6, discontent: -4 }, after: '人们挤在发电机的余温里，像一群沉默的动物。'
        },
        {
          label: '让他们自己想办法', hint: '病人 +7，不满 +7',
          fx: { sick: 7, discontent: 7 }, after: '早上有人在雪里被埋了一半。'
        }
      ]
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
