# AIslop 小游戏合集 · tiny-web-games

四个纯前端、零依赖、离线可玩的浏览器小游戏。全部是原生 HTML/CSS/JS，**打开 `index.html` 就能玩**，不需要构建、不需要服务器、不联网。

在线试玩（GitHub Pages）：**https://fishslop-dumper.github.io/tiny-web-games/**  ← 点这里直接玩

| 游戏 | 类型 | 规模 | 直接打开 |
|---|---|---|---|
| [60秒：地堡余生](60s-bunker/) | 生存 + 卡片事件 | 2,247 行 JS | [index.html](60s-bunker/index.html) |
| [Frostfall](frostfall/) | 3D 环形城市经营 | 3,074 行 JS + Three.js r149 | [index.html](frostfall/index.html) |
| [Soul Knight Lite](soul-knight-lite/) | 像素 Roguelite | 4,642 行 JS，贴图全代码绘制 | [index.html](soul-knight-lite/index.html) |
| [Stellaris Mini](stellaris-mini/) | 4X 大战略 | 7,765 行 JS，可无头模拟 | [index.html](stellaris-mini/index.html) |

---

## 怎么跑

克隆下来，双击任意子目录里的 `index.html` 就行。

```bash
git clone https://github.com/<你的用户名>/tiny-web-games.git
cd tiny-web-games
start index.html          # Windows
# open index.html        # macOS
```

想用本地服务器（可选，纯粹为了地址栏好看）：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000/
```

> 存档说明：四个游戏都用 `localStorage` 记进度/设置。`localStorage` 按 **origin** 隔离，所以 `file://` 打开和 Pages 上打开是两套存档，互不共享。

## 目录结构

```
tiny-web-games/
├─ index.html              # 合集落地页
├─ assets/                 # 落地页缩略图
├─ 60s-bunker/             # 第一幕 60 秒搜刮 + 第二幕 15 天地堡生存
│  ├─ index.html
│  ├─ src/                 # game-core / scavenge / bunker / ui
│  ├─ dev/                 # 构建与无头自检脚本（Node，可选）
│  └─ docs/STORY.md
├─ frostfall/              # 环形城市 3D 生存
│  ├─ js/                  # engine / render / ui / ...
│  ├─ vendor/three.min.js  # Three.js r149（MIT）
│  └─ tools/               # 无头模拟与 CDP 截图脚本（可选）
├─ soul-knight-lite/       # 384×216 像素地牢
│  ├─ js/                  # game / entities / dungeon / weapons / art / core
│  └─ tools/
└─ stellaris-mini/         # 64 星 4X
   ├─ js/                  # main / ui / ...
   ├─ screenshots/         # README 配图
   └─ tools/               # sim.js 可无头跑完整一局
```

`dev/` 和 `tools/` 里是开发期用的 Node 脚本（无头 Edge + CDP），**玩游戏不需要它们**。

## 工程说明

- **零运行时依赖**：没有 npm 包、没有 CDN、没有外部请求，断网可玩。
- **无构建步骤**：全部用经典 `<script src>` 标签，不用 ESM，所以 `file://` 直接可跑（这也是不用打包器的原因）。
- **可测试性**：`stellaris-mini/tools/sim.js <seed> <years>` 能在 Node 里跑完一整局（引擎与 DOM 解耦）；`stellaris-mini/tools/cdp-test.js` 有 54 条 UI 断言。`frostfall/tools/sim.js` 同理。
- **可复现性**：`stellaris-mini/tools/sim.js` 用种子驱动，同一个种子出同一局。

## 许可证

代码以 [MIT](LICENSE) 发布，随便用。

- `frostfall/vendor/three.min.js` 是 Three.js r149，遵循其自带的 MIT 许可。
- 四个游戏在**玩法上**致敬《60 Seconds!》《Frostpunk》《Soul Knight》《Stellaris》，但**不包含任何原作素材**，代码与美术均为原创，与原作厂商无任何关联。详见 [NOTICE.md](NOTICE.md)。

## 已知限制

- 全部为桌面键鼠设计，触屏体验不佳（Soul Knight Lite 支持虚拟摇杆，其余没有）。
- 中文 UI，未做 i18n。
- 都是小体量实验：数值平衡靠手调，没有服务端，存档只在本地。
