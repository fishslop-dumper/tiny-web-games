'use strict';
/* ==========================================================================
   60秒：地堡余生  —  模块 3/4
   第二幕：地堡里的第 1 天到第 15 天（含事件牌组）
   ========================================================================== */

/* --------------------------------------------------------------------------
   事件牌组：每张牌 = 一天的遭遇，2~3 个选择
   -------------------------------------------------------------------------- */
var EVENTS = [
  {
    id: 'leak', weight: 3, title: '水箱漏了',
    text: '凌晨三点，你听见天花板在滴水。储水罐的焊缝裂了一道细缝，水珠正沿着水泥往下爬。',
    choices: [
      {
        label: '用工具箱把焊缝封上', hint: '需要工具箱',
        run: function (a) {
          if (!a.has('tools')) { a.water(-2); return { text: '你翻遍了地堡，没有一件能焊东西的家伙。眼睁睁看着两瓶水渗进了地板。', tone: 'bad' }; }
          a.water(1);
          return { text: '焊枪的火花照亮了半个地堡。漏口封住了，你还顺手接了半杯带铁锈味的水。', tone: 'good' };
        }
      },
      {
        label: '拿锅接着，能接多少算多少',
        run: function (a) { a.water(-1); return { text: '你端着锅在黑暗里站了一夜。留下的那一瓶，喝起来有点水泥味。', tone: 'meh' }; }
      },
      {
        label: '装作没听见',
        run: function (a) { a.water(-2); a.mutants(1); return { text: '潮气在墙角长出了黑斑。蟑螂似乎很喜欢这种湿气。', tone: 'bad' }; }
      }
    ]
  },
  {
    id: 'roaches', weight: 4, title: '变异蟑螂',
    text: '墙缝里钻出一只巴掌大的蟑螂。它的触须慢悠悠地转过来，像是在打量今晚的菜单。后面还有第二只、第三只。',
    choices: [
      {
        label: '用鞋子拍死它们', hint: '需要点胆量',
        run: function (a) {
          if (a.chance(0.62)) { a.food(1); return { text: '你连拍七下，手都拍麻了。收拾残骸时，你决定假装它们是蛋白质。', tone: 'good' }; }
          a.hurt(a.pick(a.alive()), 8, '被蟑螂咬了');
          a.mutants(1);
          return { text: '它们比看起来快得多。你踩碎了两只，剩下的钻回墙里，还咬了你一口。', tone: 'bad' };
        }
      },
      {
        label: '用猎枪轰它们', hint: '需要猎枪',
        run: function (a) {
          if (!a.has('rifle')) { a.hurt(a.pick(a.alive()), 6, '徒手'); return { text: '你举起空手，蟑螂举起触须。这一局它赢了。', tone: 'bad' }; }
          a.mutants(-2);
          return { text: '一声巨响。地堡里的回声震得耳朵嗡嗡响，蟑螂和整面墙上的灰一起消失了。', tone: 'good' };
        }
      },
      {
        label: '让蒂米去对付', hint: '需要蒂米在地堡里',
        run: function (a) {
          var kid = a.member('timmy');
          if (!kid || !kid.alive || !kid.present) return { text: '你朝黑暗里喊了一声。没有人回答。', tone: 'bad' };
          a.hurt(kid, 15, '杀蟑螂');
          a.mutants(-1);
          return { text: '蒂米抱着鞋跟它们搏斗了十分钟，最后举着战利品回来，脸上青了一块。他觉得这是勋章。', tone: 'meh' };
        }
      }
    ]
  },
  {
    id: 'knocker', weight: 4, title: '有人在敲门',
    text: '咚、咚、咚。有人在地堡门外敲击，三下，停一会儿，再三下。一个沙哑的声音说：「我知道里面有人。我只想换点水。」',
    choices: [
      {
        label: '开门，分他一点水', hint: '也许换来什么',
        run: function (a) {
          if (a.chance(0.5)) { a.water(-1); a.food(2); return { text: '是个瘦得脱形的邮差。他留下半袋军用饼干，说了句「往北走」，然后消失在灰里。', tone: 'good' }; }
          a.food(-1); a.water(-1);
          return { text: '门一开，他抢走了最近的一罐东西。你把他推出去的时候，只抢回了半条袖子。', tone: 'bad' };
        }
      },
      {
        label: '把门锁死，不出声',
        run: function (a) {
          a.hurt(a.pick(a.alive()), 6, '良心');
          return { text: '你贴着门坐到声音消失。指甲在铁皮上留下了几道白印。', tone: 'meh' };
        }
      },
      {
        label: '端起猎枪，让他滚', hint: '需要猎枪',
        run: function (a) {
          if (!a.has('rifle')) return { text: '你空着手站在门后，声音比预想的要小：「走开。」他笑了，然后走了。', tone: 'meh' };
          if (a.chance(0.7)) return { text: '你听见脚步匆匆远去，还有什么东西掉在地上的声音。门外留下一只还在滴水的军用水壶。', tone: 'good' };
          return { text: '门外传来两声枪响，铁门震得直响。幸好子弹没穿进来。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'radio_plan', weight: 3, title: '收音机里的加密频道',
    text: '噪音里浮出一串数字和坐标。念得很慢，像是给特定的人听的。它重复了三遍：「……补给点仍在运作。三日之内。」',
    choices: [
      {
        label: '抄下来，派人按坐标去找',
        run: function (a) {
          if (a.chance(0.62)) { a.food(2); a.water(2); return { text: '你们真的找到了那栋水泥房：罐头、水、还有一卷干净毛毯。没人愿意相信这是真的。', tone: 'good' }; }
          a.hurt(a.pick(a.alive()), 14, '白跑一趟');
          return { text: '坐标指向一片平地。也许是频道错了，也许是来晚了。回来的人一句话都没说。', tone: 'bad' };
        }
      },
      {
        label: '别冒险，只是敌人的诱饵',
        run: function (a) { a.mutants(0); return { text: '你把频道换回新闻。它一直在播放同一段天气预报。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'dust', weight: 3, title: '通风口渗进来的灰',
    text: '换气的时候，一股细灰从通风口飘下来，落在每个人的眉毛上。空气里有股金属的甜味。',
    choices: [
      {
        label: '戴上防毒面具干活', hint: '需要防毒面具',
        run: function (a) {
          if (!a.has('mask')) { a.hurt(a.pick(a.alive()), 14, '吸入辐射尘'); return { text: '你憋着气换完了滤纸，还是咳出了带铁锈味的痰。', tone: 'bad' }; }
          return { text: '面具过滤掉了那股甜味。滤芯边缘泛起一点黄，你把它记在了心里。', tone: 'good' };
        }
      },
      {
        label: '用湿布把通风口堵一半',
        run: function (a) { a.hurt(a.pick(a.alive()), 6, '吸入少量辐射尘'); return { text: '空气闷了，但灰少了。有人开始抱怨头疼。', tone: 'meh' }; }
      },
      {
        label: '趁灰还薄，赶紧出去捡点东西',
        run: function (a) {
          if (a.chance(0.4)) { a.food(2); a.hurt(a.pick(a.alive()), 12, '辐射'); return { text: '你们抢回两罐东西，代价是所有人指甲下面都泛着灰。', tone: 'meh' }; }
          a.hurt(a.pick(a.alive()), 20, '辐射');
          return { text: '外面什么都看不清。你们空手回来，一路上没人说话。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'timmy_cough', weight: 3, title: '蒂米的咳嗽',
    when: function (a) { return a.member('timmy').present; },
    text: '半夜，蒂米咳醒了。他缩在毯子里，说胸口像塞着一团棉花。额头有点烫。',
    choices: [
      {
        label: '给他吃药片', hint: '需要药片',
        run: function (a) {
          var kid = a.member('timmy');
          if (!a.take('meds')) { a.hurt(kid, 12, '发烧'); return { text: '药箱里空空如也。你只能把湿毛巾敷在他额头上，坐到天亮。', tone: 'bad' }; }
          a.heal(kid, 8);
          return { text: '两片药下去，天亮时他不咳了。他小声问：「外面的天还在吗？」', tone: 'good' };
        }
      },
      {
        label: '让他再扛一扛',
        run: function (a) {
          var kid = a.member('timmy');
          if (a.chance(0.45)) { a.infect(kid); return { text: '扛是扛过去了，但咳嗽留了下来，像是要长在肺里。', tone: 'bad' }; }
          return { text: '小孩子恢复得快。第二天他就爬起来，用粉笔在墙上画太阳。', tone: 'good' };
        }
      }
    ]
  },
  {
    id: 'digging', weight: 2, title: '地底下的挖掘声',
    text: '有什么东西在地堡下面的土层里动。不是老鼠——节奏太慢、太有规律，像是有人在挖。',
    choices: [
      {
        label: '搬开货架，看看下面是什么',
        run: function (a) {
          if (a.chance(0.5)) { a.food(3); return { text: '货架后面是一间被水泥封住的旧储藏室，里面码着一排罐头。生产日期是 1953 年。', tone: 'good' }; }
          a.hurt(a.pick(a.alive()), 16, '塌方');
          return { text: '洞口塌了一角。你们退回上层，谁也没敢再往下看。', tone: 'bad' };
        }
      },
      {
        label: '用水泥把地面加厚',
        run: function (a) { a.mutants(1); return { text: '你抹了两层水泥。那声音停了一晚，第二天又回来了，好像更近了一点。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'quarrel', weight: 3, title: '为了最后一罐',
    when: function (a) { return a.s.food <= 1; },
    text: '柜子里只剩最后一罐。没有人开口，但所有人的眼睛都在它身上。空气里有一种比饥饿更硬的东西。',
    choices: [
      {
        label: '打开它，平分给所有人',
        run: function (a) {
          if (a.s.food < 1) return { text: '柜子已经空了。你们全都饿着，谁也没比谁更可怜。', tone: 'meh' };
          a.food(-1);
          a.alive().forEach(function (m) { a.heal(m, 8); });
          return { text: '一人一勺，连汤都分了。吃完有人说了个笑话，没有人笑，但气氛松了一点。', tone: 'good' };
        }
      },
      {
        label: '留给孩子们',
        run: function (a) {
          a.food(-1);
          var kids = a.alive().filter(function (m) { return m.id === 'timmy' || m.id === 'mary'; });
          kids.forEach(function (m) { a.heal(m, 14); });
          a.alive().forEach(function (m) { if (kids.indexOf(m) < 0) a.hurt(m, 5, '空腹'); });
          return { text: '大人喝水，孩子吃饭。这是 1957 年，这是最正常的决定。', tone: 'meh' };
        }
      },
      {
        label: '自己吃掉，明天再说',
        run: function (a) {
          a.food(-1);
          var ted = a.member('ted');
          a.heal(ted, 18);
          a.hurt(a.pick(a.alive().filter(function (m) { return m.id !== 'ted'; })), 6, '看着');
          return { text: '你在角落吃完了它。没有人看你，这也更难受。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'basement', weight: 2, title: '地下室的门',
    text: '在堆煤的角落里，你摸到一扇被木板钉死的门。木板上写着「不要打开」。字迹是你自己父亲的。',
    choices: [
      {
        label: '撬开它',
        run: function (a) {
          if (a.chance(0.55)) { a.food(2); a.water(2); return { text: '里面是老式腌菜坛子和两箱玻璃瓶装水。你父亲显然比你更懂战争。', tone: 'good' }; }
          a.hurt(a.pick(a.alive()), 10, '碎玻璃');
          return { text: '满屋子碎玻璃和泡烂的报纸。你在里面站了很久，闻着霉味。', tone: 'meh' };
        }
      },
      {
        label: '把木板钉回去',
        run: function (a) { return { text: '你钉了十二颗钉子。有些门关着比较安全，哪怕门后面什么都没有。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'airdrop', weight: 3, minDay: 4, title: '空投',
    text: '头顶传来飞机的声音，然后是降落伞鼓起来的声音。有什么东西砸在对面的空地上，扬起一小团灰。灰是往这边飘的。',
    choices: [
      {
        label: '立刻出去抢', hint: '有辐射，值得吗',
        run: function (a) {
          if (a.chance(0.55)) { a.food(3); a.water(2); return { text: '你们拖回来一只绿色补给箱：压缩饼干、净水片、还有一卷绷带。划算。', tone: 'good' }; }
          a.hurt(a.pick(a.alive()), 18, '抢空投');
          a.food(1);
          return { text: '你们只抢到半箱东西，回来的路上有人倒在了灰里，是被拖回来的。', tone: 'bad' };
        }
      },
      {
        label: '等辐射散了再说',
        run: function (a) {
          if (a.chance(0.5)) { a.food(1); return { text: '第二天箱子只剩一个空壳，绳子还在，货没了。至少你捡回一块防水布。', tone: 'meh' }; }
          return { text: '第二天现场什么都没剩下。连降落伞都被人捡走了。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'rat', weight: 3, title: '一只肥老鼠',
    text: '一只老鼠在口粮柜上站着，胡须上挂着罐头的油。它并不怕人，甚至有点傲慢。',
    choices: [
      {
        label: '抓住它，加菜',
        run: function (a) {
          if (a.chance(0.55)) { a.food(2); return { text: '你们吃到了这一个月来第一顿肉。有人说味道像鸡，没有人反驳。', tone: 'good' }; }
          a.food(-1);
          return { text: '老鼠跑了，顺走了半罐口粮。你们坐在地上笑了很久。', tone: 'bad' };
        }
      },
      {
        label: '留着它，反正它也在挨日子',
        run: function (a) { a.food(-1); return { text: '你给它起名叫「市长」。它每天来吃一点，然后坐在罐头上打盹。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'pipe', weight: 2, title: '墙里的管子',
    text: '浴室那面墙裂了，露出一截铜管。敲上去是空的，而且运气好的话，它连着街上还没停的旧水管。',
    choices: [
      {
        label: '用工具箱把管子接出来', hint: '需要工具箱',
        run: function (a) {
          if (!a.has('tools')) return { text: '你拿螺丝刀捅了半天，管子纹丝不动。', tone: 'meh' };
          a.water(4);
          return { text: '第一股水喷出来是褐色的，第二股就清了。像是这一整年最漂亮的事。', tone: 'good' };
        }
      },
      {
        label: '留着当晾衣杆',
        run: function (a) { return { text: '你用它晾了三只袜子。地堡里第一次有了阳光的味道，虽然并没有阳光。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'blackout', weight: 2, title: '停电',
    text: '灯灭了。地堡里只剩下呼吸声和一点点从门缝漏进来的、像牛奶一样淡的光。',
    choices: [
      {
        label: '摸黑去找手电筒', hint: '需要手电筒',
        run: function (a) {
          if (!a.has('flash')) { a.hurt(a.pick(a.alive()), 9, '磕伤'); a.mutants(1); return { text: '你在黑暗里撞翻了两个箱子，才摸到火柴。蟑螂显然更喜欢黑暗。', tone: 'bad' }; }
          return { text: '手电光照亮的那一圈里，一切都还在原来的位置。这让人安心得想哭。', tone: 'good' };
        }
      },
      {
        label: '点蜡烛，大家坐在一起',
        run: function (a) {
          a.alive().forEach(function (m) { a.heal(m, 5); });
          return { text: '一根蜡烛，四个人。多洛雷斯说，这比她在 1949 年过生日那天的蛋糕还亮。', tone: 'good' };
        }
      }
    ]
  },
  {
    id: 'mary_draw', weight: 2, title: '一面墙上的画',
    text: '玛丽·简用粉笔在水泥墙上画满了东西：房子、太阳、一辆车、四只牵在一起的手。手有五个手指头，一只不少。',
    choices: [
      {
        label: '让她接着画',
        run: function (a) { a.heal(a.member('mary'), 10); return { text: '她说画完这面墙，就能回家了。你点头，说好。', tone: 'good' }; }
      },
      {
        label: '把墙擦干净，别让自己想太多',
        run: function (a) { a.hurt(a.member('mary'), 8, '擦掉画'); return { text: '粉笔灰落在盆里，水变成了奶白色。她一句话也没说。', tone: 'bad' }; }
      }
    ]
  },
  {
    id: 'trader', weight: 2, minDay: 3, title: '路过的商人',
    text: '一个背着巨大背包的男人，用铁棍很礼貌地敲了三下图。他打开包给你看：罐头、药、几发子弹。「只换东西，不换命。」',
    choices: [
      {
        label: '用香烟换两罐口粮', hint: '需要香烟',
        run: function (a) {
          if (!a.take('smokes')) return { text: '你摸遍口袋，连一根烟丝都没有。他耸耸肩，很有礼貌地走了。', tone: 'meh' };
          a.food(2);
          return { text: '他闻了闻烟，眼睛亮了一下，留下两罐黄豆。他说这是他这周做的最亏的一笔生意。', tone: 'good' };
        }
      },
      {
        label: '用一半的水换他的药',
        run: function (a) {
          if (a.s.water < 2) return { text: '你连一半的水都拿不出来。他看了看你的地堡，什么都没换就走了。', tone: 'bad' };
          a.water(-2); a.item('meds', 2);
          return { text: '两瓶水换一小瓶药。他说这叫黑市价，你说是抢劫，你们握手成交。', tone: 'good' };
        }
      },
      {
        label: '请他吃一顿，交个朋友',
        run: function (a) {
          if (a.s.food < 2) return { text: '你连请他坐下的底气都没有。他留下一块硬糖，说是给孩子的。', tone: 'meh' };
          a.food(-1);
          if (a.chance(0.6)) { a.item('firstaid', 1); a.water(1); return { text: '他吃完讲了半小时外面的消息：北边还有电，南边已经没人了。走的时候留下一包绷带。', tone: 'good' }; }
          return { text: '他吃了东西，道了谢，第二天早上不见了。你的打火机也不见了。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'soldiers', weight: 2, minDay: 6, title: '征用',
    text: '门外传来军靴的声音，很整齐。一个声音说：「根据紧急状态法，本区域所有食物和药品由军方统一管理。」门缝里塞进来一张盖着红章的纸。',
    choices: [
      {
        label: '交出一半的口粮',
        run: function (a) {
          var f = Math.ceil(a.s.food / 2), w = Math.ceil(a.s.water / 2);
          a.food(-f); a.water(-w);
          return { text: '他们拿走了一半，很客气地敬了礼。纸上的红章在黑暗里像块伤口。', tone: 'bad' };
        }
      },
      {
        label: '不开门，就说不舒服',
        run: function (a) {
          if (a.chance(0.5)) { a.food(-2); return { text: '他们把门撬开一条缝，拿走了两罐，然后走了。', tone: 'meh' }; }
          return { text: '他们在门外站了十分钟，最后靴子声远了。你听见有人骂了句什么。', tone: 'good' };
        }
      },
      {
        label: '举着猎枪谈判', hint: '需要猎枪',
        run: function (a) {
          if (!a.has('rifle')) { a.food(-2); return { text: '你举着一根拖把。他们拿走了两罐，还留下了一句训话。', tone: 'bad' }; }
          if (a.chance(0.6)) return { text: '门开了条缝，他们看见枪口，互相看了一眼，然后说「祝你好运，公民」。什么也没拿。', tone: 'good' };
          a.hurt(a.pick(a.alive()), 28, '冲突');
          return { text: '有人扣了扳机。子弹打在水泥上，溅起的碎屑划伤了自己人。门最后还是被拿走了两罐。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'roof', weight: 2, title: '天花板塌了一块',
    text: '一声闷响，天花板掉下来一块，露出钢筋和外面灰色的天。风带着灰灌进来，所有人都咳了起来。',
    choices: [
      {
        label: '用工具箱和木板补上', hint: '需要工具箱',
        run: function (a) {
          if (!a.has('tools')) { a.hurt(a.pick(a.alive()), 12, '受寒'); a.mutants(1); return { text: '你抱着一堆碎砖发愁。那一夜所有人挤在唯一不漏风的角落。', tone: 'bad' }; }
          return { text: '你钉到天亮，手掌起了三个血泡。补好的地方比原来更丑，也更结实。', tone: 'good' };
        }
      },
      {
        label: '搬去最里间的角落住',
        run: function (a) { a.hurt(a.pick(a.alive()), 7, '受寒'); a.mutants(1); return { text: '你们把铺盖往里挪了三米。睡觉时能听见风从上头笑。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'returnee', weight: 4, title: '门外的家人',
    when: function (a) {
      return a.s.members.some(function (m) { return !m.present && m.alive; });
    },
    text: '门外有人在喊名字，是你在慌乱中没来得及带下来的那个人。声音很轻，像是已经喊了很久。',
    choices: [
      {
        label: '开门，把人拉进来',
        run: function (a) {
          var m = a.s.members.filter(function (x) { return !x.present && x.alive; })[0];
          if (!m) return { text: '你推开门，外面只有风和一层薄薄的灰。', tone: 'bad' };
          m.present = true;
          m.hp = Math.max(28, m.hp - 30);
          m.hunger = 1; m.thirst = 1;
          return { text: '是她/他。灰从头发行间簌簌地掉下来，瘦得几乎认不出。地堡里多了一个人，也就多了一份口粮。', tone: 'good' };
        }
      },
      {
        label: '隔着门跟她/他说话',
        run: function (a) {
          var m = a.s.members.filter(function (x) { return !x.present && x.alive; })[0];
          if (m) { m.hp = Math.max(0, m.hp - 35); if (m.hp <= 0) { m.alive = false; } }
          return { text: '你贴着门说了二十分钟。声音停了以后，你在原地又坐了一小时。', tone: 'bad' };
        }
      }
    ]
  },
  {
    id: 'radstorm', weight: 2, minDay: 5, title: '辐射风暴',
    text: '风把灰吹成了墙。门缝里渗进橙色的光，空气里有静电，头发都竖起来了。这一场要刮一整夜。',
    choices: [
      {
        label: '全员缩到最里间，堵死通风',
        run: function (a) { a.alive().forEach(function (m) { a.heal(m, -4); }); return { text: '四个人挤在一张毯子下面，谁也没睡着。天亮时每个人都觉得自己被晒伤了一样。', tone: 'meh' }; }
      },
      {
        label: '抓紧时间去外面捡被吹来的东西',
        run: function (a) {
          if (a.chance(0.45)) { a.food(2); a.water(1); a.hurt(a.pick(a.alive()), 16, '辐射'); return { text: '风吹来了邻居家的罐头和一只铝锅。代价是你们咳了三天。', tone: 'meh' }; }
          a.hurt(a.pick(a.alive()), 26, '辐射');
          return { text: '什么也没捡到，人被吹倒两次，抬回来的时候嘴唇都是紫的。', tone: 'bad' };
        }
      },
      {
        label: '戴上防毒面具守夜', hint: '需要防毒面具',
        run: function (a) {
          if (!a.has('mask')) return { text: '你举着毛毯当口罩，那显然不够。', tone: 'bad' };
          a.alive().forEach(function (m) { a.heal(m, 3); });
          return { text: '面具里的人一夜没合眼，但天亮时，所有人的呼吸都还算平稳。', tone: 'good' };
        }
      }
    ]
  },
  {
    id: 'poker', weight: 2, title: '打牌之夜',
    text: '有人从柜子底下摸出一副缺了两张的扑克牌。四个人围着蜡烛，第五个位置空着，摆着几枚瓶盖。',
    choices: [
      {
        label: '玩到蜡烛烧完', hint: '需要扑克牌',
        run: function (a) {
          if (!a.take('cards')) return { text: '你们用撕开的报纸当牌。规则是现编的，谁也赢不了谁。', tone: 'meh' };
          a.alive().forEach(function (m) { a.heal(m, 10); });
          return { text: '那一晚有人笑了三次。在这个地堡里，一次笑可以用掉一整罐口粮来换。', tone: 'good' };
        }
      },
      {
        label: '早点睡，明天还有活',
        run: function (a) { a.alive().forEach(function (m) { a.heal(m, 3); }); return { text: '没有人反对。黑暗里很快就只剩呼吸声。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'dream', weight: 1, title: '梦见太阳',
    text: '你梦见自己站在院子里，阳光晒得后脖子发烫，割草机在响。醒来时，水泥地还是水泥地。',
    choices: [
      {
        label: '把这个梦讲给他们听',
        run: function (a) { a.alive().forEach(function (m) { a.heal(m, 6); }); return { text: '多洛雷斯说她梦见了大海。蒂米说梦见了冰淇淋。玛丽·简说她梦见了同一个太阳。', tone: 'good' }; }
      },
      {
        label: '不说，一个人琢磨',
        run: function (a) { return { text: '你把这个梦收好，像收好一张过期的电影票。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'soup', weight: 2, minDay: 5, title: '一锅汤',
    text: '有人用最后一罐汤底，加了三只拍死的蟑螂、一把盐和半瓶水，煮了一锅东西。味道居然还行。',
    choices: [
      {
        label: '大家分着喝',
        run: function (a) { a.water(-1); a.alive().forEach(function (m) { a.heal(m, 9); }); a.mutants(-1); return { text: '「像鸡肉。」蒂米说。没有人纠正他。', tone: 'good' }; }
      },
      {
        label: '只喝汤，肉留给小孩',
        run: function (a) { a.water(-1); a.alive().forEach(function (m) { a.heal(m, m.id === 'timmy' || m.id === 'mary' ? 8 : 4); }); return { text: '孩子们把碗底舔得很干净。大人们把汤喝完了，看着他们。', tone: 'meh' }; }
      }
    ]
  },
  {
    id: 'count', weight: 2, title: '用粉笔记数',
    text: '墙上一道一道的粉笔线已经很多了。玛丽·简每天早上都问：今天是第几天？还有几天？',
    choices: [
      {
        label: '照实说，还有几天',
        run: function (a) { return { text: '她很认真地数了一遍，然后点点头。从那天起，数数成了她每天最重要的工作。', tone: 'meh' }; }
      },
      {
        label: '说「快了」',
        run: function (a) { a.heal(a.member('mary'), 6); return { text: '「快了」这个词说多了就不像谎话了。你几乎也信了。', tone: 'good' }; }
      }
    ]
  }
];

var NIGHT_FLAVOR = [
  '水管在墙里响了一整夜，像有人在很远的地方咳嗽。',
  '外面下起了黑色的雨，打在通风口上沙沙响。',
  '有人在梦里喊了一声名字，然后就安静了。',
  '地堡里有一种说不清的味道，像旧报纸和铁钉。',
  '你听见头顶有车经过的声音，又觉得不可能。',
  '蜡烛烧到最后，火苗跳了一下就没了。',
  '蟑螂在墙缝里开会，你们假装不知道。',
  '蒂米说，他梦见外面的草长到了窗台那么高。'
];

/* -------------------------------------------------------------------------- */
var Bunker = (function () {
  var GOAL = 15;
  var S = null;

  /* ---------------- 初始化 ---------------- */
  function init(bag, seed) {
    var rng = Util.mulberry32(((seed || 1) * 2654435761) >>> 0);
    var counts = {}, gear = {}, cons = [];
    (bag.items || []).forEach(function (k) {
      var d = ITEMS[k];
      if (!d) return;
      if (d.kind === 'resource') counts[k] = (counts[k] || 0) + 1;
      else if (d.kind === 'gear') gear[k] = true;
      else cons.push(k);
    });

    var consMap = {};
    cons.forEach(function (k) { consMap[k] = (consMap[k] || 0) + 1; });

    S = {
      seed: seed, rng: rng,
      day: 1, goal: GOAL,
      food: 2 + (counts.food || 0) + (counts.choco || 0),
      water: 2 + (counts.water || 0),
      gear: gear,
      inv: Object.keys(consMap).map(function (k) { return { key: k, n: consMap[k] }; }),
      members: FAMILY.map(function (f) {
        return {
          id: f.id, name: f.name, role: f.role, emoji: f.emoji,
          present: f.id === 'ted' || (bag.family || []).indexOf(f.id) >= 0,
          alive: true, hp: 100, hunger: 0, thirst: 0,
          sick: false, injured: false, fedToday: false, drankToday: false
        };
      }),
      log: [], mutants: 0, used: {}, deaths: [],
      ration: {}, event: null, outcome: null, broadcast: null,
      stage: 'ration', ended: false, ending: null,
      collected: (bag.items || []).slice(),
      brought: (bag.items || []).length,
      rescued: (bag.family || []).length,
      tLeft: bag.tLeft || 0
    };

    log('🔒 门在头顶合上。灰尘从合页上落下来，落在你的头发上。');
    log('🥫 地堡里原本就剩下 2 罐口粮和 2 瓶水。再加上你抢回来的东西，这就是全部家当。');
    if (S.rescued === 0) log('🚪 你一个人下来了。楼上的名字还在你嘴里。');
    else if (S.rescued < 3) log('🚪 你带下来 ' + S.rescued + ' 个人。剩下的人还留在房子里。');
    else log('🚪 一家四口，一个不少。');
    if (S.gear.radio) log('📻 收音机还能用。你调到一个还在播音的频道。');

    defaultRation();
    S.stage = 'ration';
    return S;
  }

  /* ---------------- 小工具 ---------------- */
  function log(text) { if (!S) return; S.log.push({ day: S.day, text: text }); }
  function get(id) {
    for (var i = 0; i < S.members.length; i++) if (S.members[i].id === id) return S.members[i];
    return null;
  }
  function here() { return S.members.filter(function (m) { return m.alive && m.present; }); }
  function hasGear(k) { return !!S.gear[k]; }
  function addFood(n) { S.food = Math.max(0, S.food + n); }
  function addWater(n) { S.water = Math.max(0, S.water + n); }
  function addItem(k, n) {
    var slot = null;
    for (var i = 0; i < S.inv.length; i++) if (S.inv[i].key === k) slot = S.inv[i];
    if (slot) slot.n += (n || 1); else S.inv.push({ key: k, n: n || 1 });
  }
  function takeItem(k) {
    for (var i = 0; i < S.inv.length; i++) {
      if (S.inv[i].key === k && S.inv[i].n > 0) {
        S.inv[i].n--;
        if (S.inv[i].n <= 0) S.inv.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  function heal(m, d) {
    if (!m || !m.alive) return;
    m.hp = Util.clamp(m.hp + d, 0, 100);
  }
  function hurt(m, d, why) {
    if (!m || !m.alive) return;
    m.hp = Util.clamp(m.hp - d, 0, 100);
    if (d >= 14) m.injured = true;
    if (m.hp <= 0) kill(m, why || '伤重');
  }
  function infect(m) { if (m && m.alive) { m.sick = true; log('🤒 ' + m.name + ' 开始咳嗽了。'); } }
  function cure(m) { if (m && m.alive) { m.sick = false; } }
  function kill(m, why) {
    if (!m || !m.alive) return;
    m.alive = false; m.hp = 0;
    S.deaths.push(m.id);
    log('💀 ' + m.name + ' 没能撑过去。' + (why ? '（' + why + '）' : ''));
    Sfx.hurt();
    if (m.id === 'ted') endGame('ted-dead');
  }

  function api() {
    return {
      s: S, rng: S.rng, day: S.day,
      log: log, food: addFood, water: addWater,
      item: addItem, take: takeItem, has: hasGear,
      member: get, alive: here,
      hurt: hurt, heal: heal, infect: infect, cure: cure, kill: kill,
      mutants: function (d) { S.mutants = Math.max(0, S.mutants + d); },
      pick: function (arr) { return arr && arr.length ? Util.pick(S.rng, arr) : null; },
      chance: function (p) { return S.rng() < p; }
    };
  }

  /* ---------------- 配给 ---------------- */
  function defaultRation() {
    S.ration = {};
    var f = S.food, w = S.water;
    here().forEach(function (m) {
      S.ration[m.id] = { food: f > 0, water: w > 0 };
      if (f > 0) f--;
      if (w > 0) w--;
    });
  }
  function setRation(id, kind, on) {
    if (!S.ration[id]) S.ration[id] = { food: false, water: false };
    S.ration[id][kind] = !!on;
  }
  function rationCost() {
    var f = 0, w = 0;
    here().forEach(function (m) {
      var r = S.ration[m.id];
      if (r && r.food) f++;
      if (r && r.water) w++;
    });
    return { food: f, water: w };
  }
  function confirmRation() {
    if (!S || S.ended || S.stage !== 'ration') return;
    var f = 0, w = 0;
    here().forEach(function (m) {
      var r = S.ration[m.id] || { food: false, water: false };
      m.fedToday = false; m.drankToday = false;
      if (r.food) {
        if (S.food > 0) { S.food--; m.fedToday = true; f++; }
        else log('📦 口粮见底了，' + m.name + ' 今天没吃上。');
      }
      if (r.water) {
        if (S.water > 0) { S.water--; m.drankToday = true; w++; }
        else log('🥤 水不够，' + m.name + ' 今天没喝上。');
      }
    });
    if (f || w) log('🍽️ 今天开饭：' + f + ' 罐口粮，' + w + ' 瓶水。');
    else log('🚫 今天没有人吃饭。');
    pickEvent();
  }

  /* ---------------- 事件 ---------------- */
  function broadcastForDay() {
    if (!hasGear('radio')) return { radio: false, text: '没有收音机。地堡里只有水滴声。' };
    var hint = null;
    if (S.day === 1) hint = '军方通告：救援队预计在两周内抵达本区域。请预留口粮。';
    else if (S.day === 6) hint = '本台消息：北面的公路已恢复通行。请坚持住，公民。';
    else if (S.day === 11) hint = '救援队已经出发。请在地堡入口处做出明显标记。';
    else if (S.day >= GOAL - 1) hint = '明天，明天。请听到这段广播的人，明早到地面上去。';
    return { radio: true, text: hint || Util.pick(S.rng, BROADCASTS) };
  }

  function pickEvent() {
    var a = api();
    var pool = EVENTS.filter(function (e) {
      if (e.once && S.used[e.id]) return false;
      if (e.minDay && S.day < e.minDay) return false;
      if (e.maxDay && S.day > e.maxDay) return false;
      if (e.when && !e.when(a)) return false;
      if (S.used[e.id]) return false;
      return true;
    });
    if (!pool.length) pool = EVENTS.slice();
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += (pool[i].weight || 1);
    var r = S.rng() * total, acc = 0, chosen = pool[0];
    for (i = 0; i < pool.length; i++) {
      acc += (pool[i].weight || 1);
      if (r <= acc) { chosen = pool[i]; break; }
    }
    S.event = chosen;
    S.broadcast = broadcastForDay();
    S.stage = 'event';
  }

  function choose(i) {
    if (!S || S.ended || S.stage !== 'event' || !S.event) return;
    var ch = S.event.choices[i];
    if (!ch) return;
    S.used[S.event.id] = true;
    var res = { text: '', tone: 'neutral' };
    try {
      res = ch.run(api()) || res;
    } catch (err) {
      res = { text: '……这一段最后没有留下记录。', tone: 'neutral' };
    }
    if (S.ended) { S.stage = 'end'; return; }
    S.outcome = { title: S.event.title, text: res.text || '', tone: res.tone || 'neutral', kind: 'event' };
    S.stage = 'outcome';
    Sfx.card();
  }

  /* ---------------- 探险 ---------------- */
  function expedition(id) {
    if (!S || S.ended || S.stage !== 'expedition') return;
    var m = get(id);
    if (!m || !m.alive || !m.present) return;
    var bonus = 0;
    ['mask', 'flash', 'rifle', 'map'].forEach(function (g) { if (hasGear(g)) bonus++; });
    var score = (0.25 + S.rng() * 0.75) + bonus * 0.10 + (m.hp / 100) * 0.08;
    var text, tone, title = m.name + ' 的外出';

    if (score >= 1.05) {
      var items = ['food', 'food', 'water', 'water'];
      var extra = S.rng() < 0.5 ? 'meds' : 'firstaid';
      items.forEach(function (k) { if (k === 'food') addFood(1); else addWater(1); });
      addItem(extra, 1);
      text = m.name + ' 走了六个街区，在一辆翻倒的货车里找到了两只箱子：四罐口粮、两瓶水，还有一盒' + ITEMS[extra].name + '。回来时在门口抖了很久的灰。';
      tone = 'good';
    } else if (score >= 0.82) {
      addFood(2); addWater(1);
      text = m.name + ' 带回来两罐口粮和一瓶水，还有一段别人家的窗帘。她说那颜色好看。';
      tone = 'good';
    } else if (score >= 0.6) {
      var k2 = S.rng() < 0.5 ? 'food' : 'water';
      if (k2 === 'food') addFood(1); else addWater(1);
      text = m.name + ' 只带回来一点东西。街上很安静，安静得不像有人住过。';
      tone = 'meh';
    } else if (score >= 0.4) {
      hurt(m, 22, '外出受伤');
      text = m.name + ' 回来时一瘸一拐，怀里什么都没有。裤腿被什么东西撕开了一道口子。';
      tone = 'bad';
    } else {
      hurt(m, 40, '严重受伤');
      if (m.alive && S.rng() < 0.28) kill(m, '外出时遭遇意外');
      text = m.alive
        ? '门开的时候，' + m.name + ' 几乎是爬进来的。伤口里有灰，眼睛里有别的东西。'
        : '门开的时候，走廊里只有风。我们把 ' + m.name + ' 留在了外面。';
      tone = 'bad';
    }

    if (S.ended) { S.stage = 'end'; return; }
    S.outcome = { title: title, text: text, tone: tone, kind: 'exp' };
    S.stage = 'expResult';
    Sfx.card();
  }

  function skipExpedition() {
    if (!S || S.ended || S.stage !== 'expedition') return;
    S.outcome = { title: '今天没有出门', text: '门锁着。所有人都待在原地，听着头顶上的风。', tone: 'meh', kind: 'exp' };
    S.stage = 'expResult';
  }

  /* ---------------- 夜晚 ---------------- */
  function night() {
    if (!S || S.ended) return;
    var lines = [];

    here().forEach(function (m) {
      if (!m.alive) return;
      m.hunger = m.fedToday ? 0 : Math.min(3, m.hunger + 1);
      m.thirst = m.drankToday ? 0 : Math.min(3, m.thirst + 1);

      var dmg = 0, why = [];
      if (m.hunger === 2) { dmg += 8; why.push('饿'); }
      else if (m.hunger >= 3) { dmg += 20; why.push('严重饥饿'); }
      if (m.thirst === 2) { dmg += 12; why.push('渴'); }
      else if (m.thirst >= 3) { dmg += 26; why.push('脱水'); }
      if (m.sick) { dmg += 9; why.push('生病'); }
      if (m.injured) { dmg += 5; why.push('伤口'); }

      if (dmg > 0) {
        m.hp = Math.max(0, m.hp - dmg);
        lines.push('💔 ' + m.name + ' 状态下滑（' + why.join('、') + '），体力 -' + dmg + '。');
        if (m.hp <= 0) { kill(m, why.join('、')); lines.push('💀 ' + m.name + ' 没有醒来。'); }
      } else if (m.hp < 100) {
        m.hp = Math.min(100, m.hp + 5);
        lines.push('🌙 ' + m.name + ' 睡了个好觉，体力 +5。');
      }
      m.fedToday = false; m.drankToday = false;
    });

    if (S.ended) { S.stage = 'end'; return; }

    /* 生病蔓延 / 自愈 */
    here().forEach(function (m) {
      if (!m.sick) return;
      if (m.hp > 62 && S.rng() < 0.34) {
        m.sick = false;
        lines.push('🍀 ' + m.name + ' 的咳嗽好些了。');
      } else if (S.rng() < 0.18) {
        var others = here().filter(function (o) { return o !== m && !o.sick; });
        if (others.length) {
          var t = Util.pick(S.rng, others);
          t.sick = true;
          lines.push('🤒 ' + t.name + ' 也开始咳嗽了。');
        }
      }
    });

    /* 蟑螂与老鼠 */
    if (S.mutants >= 2 && S.rng() < 0.55 && S.food > 0) {
      addFood(-1);
      S.mutants = Math.max(0, S.mutants - 1);
      lines.push('🪳 蟑螂啃穿了一只罐头的封口。口粮 -1。');
    }
    if (S.mutants >= 3) {
      lines.push('⚠️ 墙里面的动静越来越大了。');
    }

    lines.push(Util.pick(S.rng, NIGHT_FLAVOR));
    S.outcome = { title: '第 ' + S.day + ' 天的夜晚', lines: lines, tone: 'night', kind: 'night' };
    S.stage = 'night';
    Sfx.card();
  }

  function nextDay() {
    if (!S || S.ended || S.stage !== 'night') return;
    S.day++;
    if (S.day > GOAL) { endGame('rescue'); return; }
    if (S.day === GOAL) log('📅 第 ' + S.day + ' 天。墙上的粉笔线已经画到最后一格那么多了。');
    defaultRation();
    S.stage = 'ration';
  }

  function advance() {
    if (!S || S.ended) return;
    if (S.stage === 'outcome') { S.stage = 'expedition'; return; }
    if (S.stage === 'expResult') { night(); return; }
    if (S.stage === 'night') { nextDay(); return; }
  }

  /* ---------------- 使用物品 ---------------- */
  function useItem(key) {
    if (!S || S.ended || S.stage !== 'ration') return;
    var d = ITEMS[key];
    if (!d) return;
    var slot = null;
    for (var i = 0; i < S.inv.length; i++) if (S.inv[i].key === key) slot = S.inv[i];
    if (!slot || slot.n <= 0) return;

    var pool = here().slice().sort(function (x, y) { return x.hp - y.hp; });
    var weakest = pool[0];
    var text = '';

    if (key === 'firstaid') {
      if (!weakest) return;
      heal(weakest, 32); weakest.injured = false;
      text = '🩹 你给 ' + weakest.name + ' 处理了伤口。她咬着毛巾，一声没吭。';
    } else if (key === 'meds') {
      var sick = null;
      pool.forEach(function (m) { if (m.sick && !sick) sick = m; });
      if (sick) { cure(sick); heal(sick, 6); text = '💊 ' + sick.name + ' 吃了药，咳嗽总算压下去了。'; }
      else if (weakest) { heal(weakest, 10); text = '💊 没人生病。你把药片掰了一半给 ' + weakest.name + '，说是维生素。'; }
      else return;
    } else if (key === 'cards') {
      here().forEach(function (m) { heal(m, 7); });
      text = '🃏 一家人打了三局牌。地堡里第一次有了笑声，虽然很轻。';
    } else if (key === 'teddy') {
      var kid = get('timmy');
      if (kid && kid.alive && kid.present) { heal(kid, 16); text = '🧸 蒂米抱着熊睡着了。这是他三天来说话最多的一晚。'; }
      else { here().forEach(function (m) { heal(m, 5); }); text = '🧸 你抱着这只熊坐了一会儿。它不会安慰人，但也不会抱怨。'; }
    } else if (key === 'smokes') {
      if (weakest) { heal(weakest, 9); text = '🚬 你和 ' + weakest.name + ' 轮流抽了一根。谁都没说话，但都松了一口气。'; }
      else return;
    } else if (key === 'soap') {
      here().forEach(function (m) { heal(m, 4); });
      text = '🧼 你烧水，让所有人洗了脸和手。这是这周最像文明世界的一件事。';
    } else if (key === 'fish') {
      here().forEach(function (m) { heal(m, 5); });
      text = '🐟 金鱼还在游。居然还有东西在游。所有人轮流看了它一会儿。';
    } else {
      return;
    }
    takeItem(key);
    log(text);
    Sfx.pickup();
  }

  /* ---------------- 结局 ---------------- */
  function endGame(reason) {
    if (!S || S.ended) return;
    S.ended = true;
    S.stage = 'end';
    var alive = S.members.filter(function (m) { return m.alive; });
    S.ending = {
      reason: reason,
      day: Math.min(S.day, GOAL),
      goal: GOAL,
      alive: alive.map(function (m) { return { id: m.id, name: m.name, emoji: m.emoji, present: m.present }; }),
      aliveCount: alive.filter(function (m) { return m.present; }).length,
      deaths: S.deaths.slice(),
      brought: S.brought,
      rescued: S.rescued,
      food: S.food, water: S.water,
      seed: S.seed
    };
    if (reason === 'rescue') Sfx.win(); else Sfx.lose();
  }

  return {
    init: init, state: function () { return S; },
    setRation: setRation, defaultRation: defaultRation, rationCost: rationCost,
    confirmRation: confirmRation, choose: choose, advance: advance,
    expedition: expedition, skipExpedition: skipExpedition, night: night, nextDay: nextDay,
    useItem: useItem, hasGear: function (k) { return S && !!S.gear[k]; },
    GOAL: GOAL
  };
})();
