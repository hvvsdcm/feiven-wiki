// 오푸스 온라인 위키 화면. data.json(tools/wiki/build.ts가 게임 데이터에서 만든다)만 읽어 해시 라우팅으로 그린다.

const main = document.getElementById('main');

// ── 도움 함수 ──
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const fmt = (n) => Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
/** 0~1 확률 → 사람이 읽는 % (작은 값은 유효숫자 3자리) */
function pct(p) {
  const v = p * 100;
  if (v === 0) return '0%';
  const s = v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toPrecision(3);
  return `${parseFloat(s)}%`;
}
const oneIn = (p) => (p > 0 ? `약 ${fmt(Math.round(1 / p))}번에 1번` : '—');
const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const KIND = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발', accessory: '목걸이', ring: '반지', potion: '회복 물약', mp_potion: '마나 물약', scroll: '두루마리', material: '재료', box: '상자', boost: '부스트' };
const EQUIP = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'accessory', 'ring'];
const ROLE = { chief: '촌장(전직)', quest: '퀘스트', shop: '상인', smith: '대장장이(강화)', sailor: '뱃사공(이동)', raid: '레이드 안내', flavor: '주민' };
const MOB_KIND = { field: '일반', elite: '정예', boss: '필드 보스', raid: '레이드 보스', raidAdd: '레이드 소환수', worldBoss: '원정 필드 보스', worldBossAdd: '원정 소환수' };
const STAT = { str: '힘', int: '지능', vit: '체력', mana: '마나', def: '방어' };
const PASSIVE = { patkPct: ['물리 공격력', '%'], matkPct: ['마법 공격력', '%'], maxHpPct: ['최대 HP', '%'], defPct: ['방어력', '%'], maxMpPct: ['최대 MP', '%'], critPct: ['치명타 확률', '%p'] };
const DMG = { phys: '물리', magic: '마법' };
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'unique', 'absolute'];

let D; // data.json
const M = {}; // id → 정의

function rarName(r) { return D.constants.rarityName[r] ?? r; }
function itemIcon(it, size = 'sm') {
  const cls = `ico ${size} rb-${it.rarity}`;
  return it.icon ? `<img class="${cls}" src="${esc(it.icon)}" alt="" loading="lazy" width="40" height="40"${it.tint ? ` style="filter:${esc(it.tint)}"` : ''}>` : `<span class="${cls} ph">${icon('backpack')}</span>`;
}
function itemLink(id, size = 'sm') {
  const it = M.items.get(id);
  if (!it) return esc(id);
  return `<span class="name-cell rar-${it.rarity}">${itemIcon(it, size)}<a href="#/items/${esc(id)}">${esc(it.name)}</a></span>`;
}
function mobLink(id) {
  const m = M.mobs.get(id);
  return m ? `<a href="#/mobs/${esc(id)}">${esc(m.name)}</a> <span class="muted small">Lv${m.level}</span>` : esc(id);
}
const islandName = (id) => M.islands.get(id)?.name ?? M.raids.get(id)?.name ?? M.wbIsland.get(id)?.name ?? (id === D.infinite.id ? D.infinite.name : id);
const islandLink = (id) => (M.islands.has(id) ? `<a href="#/world#isl-${esc(id)}">${esc(islandName(id))}</a>` : M.raids.has(id) || id === D.infinite.id ? `<a href="#/world#raid-${esc(id)}">${esc(islandName(id))}</a>` : M.wbIsland.has(id) ? `<a href="#/world#wb-${esc(M.wbIsland.get(id).id)}">${esc(islandName(id))}</a>` : esc(id));
/** 1렙 마을(잿빛 해안) 젬 NPC 이름: gem = 젬 상인, storage = 창고지기 */
const npcNameOfRole = (role) => D.npcNames?.[role === 'gem' ? 'sv_gem' : 'sv_storage'] ?? (role === 'gem' ? '젬 상인' : '창고지기');
function skillIcon(s, size = '') {
  return s?.icon ? `<img class="ico ${size}" src="${esc(s.icon)}" alt="" loading="lazy" width="40" height="40">` : `<span class="ico ${size} ph">${icon('sparkles')}</span>`;
}
function table(head, rows, opts = {}) {
  const th = head.map((h) => (typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h.c ?? ''}">${h.t}</th>`)).join('');
  const body = rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="muted">없음</td></tr>`;
  return `<div class="table-wrap ${opts.scroll ? 'scroll-y' : ''}"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const tr = (cells, cls = '') => `<tr class="${cls}">${cells.map((c) => (typeof c === 'object' && c !== null ? `<td class="${c.c ?? ''}">${c.t}</td>` : `<td>${c}</td>`)).join('')}</tr>`;
const R = (t) => ({ t, c: 'r' });
const note = (html) => `<div class="note">${icon('info')}<div>${html}</div></div>`;
function head(title, sub = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
}
function crumb(href, label) {
  return `<a class="crumb" href="${href}">${icon('arrow-left')}${label}</a>`;
}
function classOf(id) { return M.classes.get(id); }

// ── 공식(서버와 같은 식) ──
/** shared/sim/combatMath.ts damage */
function damage(atk, coef, def, roll) {
  return Math.max(1, Math.round((atk * coef * (0.9 + roll * 0.2) * 100) / (100 + Math.max(0, def))));
}
/** 편차 0.9~1.1 균등 분포에서 반올림한 피해의 평균 */
function avgDamage(atk, coef, def) {
  let sum = 0;
  const N = 200;
  for (let i = 0; i <= N; i++) sum += damage(atk, coef, def, i / N);
  return sum / (N + 1);
}
/** 장비 1점 수치(server/systems/items/equip.ts gearStats). enh = 강화 단계, enhanceMax + 1 = 각성(+최대 배율 × 각성 배율) */
function gearStats(it, enh, rarity = it.rarity) {
  const per = D.constants.enhanceBonusPer[it.kind] ?? 0;
  const max = D.constants.enhanceMax;
  const mul = D.constants.rarityMul[rarity] * (enh > max ? (1 + per * max) * D.awaken.mul : 1 + per * enh);
  return { atk: Math.round(it.atk * mul), def: Math.round(it.def * mul), hp: Math.round(it.hp * mul) };
}
/** 레벨·배분·장비·전직으로 능력치(GameServer.recomputeStats와 같은 순서: 기본+배분 → 장비 → 전직 패시브(1차 + 2차 합산)) */
function playerStats(cls, level, alloc, gear, branch, second = false) {
  const l = Math.max(0, level - 1);
  const eff = D.constants.statEffect;
  const baseAtk = Math.round(cls.baseAtk + cls.atkGrowth * l);
  const s = { patk: baseAtk, matk: baseAtk, maxHp: Math.round(cls.baseHp + cls.hpGrowth * l), maxMp: Math.round(cls.baseMp + cls.mpGrowth * l), def: Math.round(cls.baseDef + cls.defGrowth * l) };
  const addPoints = (key, n) => {
    for (const [field, v] of Object.entries(eff[key])) s[field] += v * n;
  };
  for (const k of Object.keys(STAT)) addPoints(k, alloc[k] || 0);
  let gearAtk = 0;
  for (const g of gear) {
    const st = gearStats(g.item, g.enh);
    gearAtk += st.atk;
    s.def += st.def;
    s.maxHp += st.hp;
    if (g.item.allStat) for (const k of Object.keys(STAT)) addPoints(k, g.item.allStat);
  }
  const p = { ...(branch?.passive ?? {}) };
  if (second && branch) for (const [k, v] of Object.entries(branch.second.passive)) p[k] = (p[k] ?? 0) + v;
  if (p.patkPct) s.patk *= 1 + p.patkPct / 100;
  if (p.matkPct) s.matk *= 1 + p.matkPct / 100;
  if (p.maxHpPct) s.maxHp = Math.round(s.maxHp * (1 + p.maxHpPct / 100));
  if (p.defPct) s.def = Math.round(s.def * (1 + p.defPct / 100));
  if (p.maxMpPct) s.maxMp *= 1 + p.maxMpPct / 100;
  const patk = Math.round(s.patk + gearAtk);
  const matk = Math.round(s.matk + gearAtk);
  return { patk, matk, atk: cls.dmgType === 'magic' ? matk : patk, baseMatk: baseAtk, def: s.def, maxHp: s.maxHp, maxMp: Math.max(0, Math.round(s.maxMp)), crit: cls.critPct + (p.critPct ?? 0), gearAtk };
}
/** 슬롯 1~4 스킬(shared/data/branches.ts skillsFor). 2차 전직이면 네 칸 모두 2차 스킬 */
function skillsFor(cls, branch, awakened, second = false) {
  if (!branch) return cls.skills;
  if (second) return branch.second.skills;
  return [cls.skills[0], branch.skills[0], branch.skills[1], awakened ? branch.awaken : branch.skills[2]];
}

// ── 페이지: 홈 ──
function pageHome() {
  const c = D.constants;
  const tiles = [
    ['damage', 'calculator', '#6ea8ff', '데미지 공식', '피해식과 직접 넣어 보는 계산기'],
    ['drops', 'dices', '#ffb547', '드랍률', '희귀 장비 확률 · 불운 보정 · 상자'],
    ['classes', 'git-branch', '#c29bff', '직업·전직', `직업 ${D.classes.length}개 · 전직 ${D.branches.length}갈래 · 각성`],
    ['skills', 'sparkles', '#3fd08a', '스킬 도감', `스킬 ${D.skills.length}개 · 계수 · 쿨다운`],
    ['items', 'backpack', '#ff8a4c', '아이템 도감', `아이템 ${D.items.length}개 · 얻는 곳`],
    ['mobs', 'skull', '#ff6b6b', '몬스터 도감', `몬스터 ${D.mobs.length}종 · 드랍표`],
    ['world', 'map', '#2dd4bf', '지역·레이드', `섬 ${D.islands.length}곳 · 레이드 ${D.raids.length}개 · 필드 보스 원정 ${D.worldBosses.length}곳 · 퀘스트 ${D.quests.length}개`],
    ['growth', 'trending-up', '#f472b6', '성장·강화', '경험치 표 · 강화 기대 비용'],
  ];
  const tries = ['불운 보정', '강화 성공률', '치명타', '크라켄', 'ㅎㄱㅅ'];
  const kv = [
    ['만렙', `Lv ${D.meta.maxLevel}`], ['1차 전직', `Lv ${c.advanceLevel}`], ['각성', `Lv ${c.awakenLevel}`], ['치명타 배율', `×${c.critMul}`],
    ['강화 한계', `+${c.enhanceMax}`], ['레벨당 스탯', `${c.statPointsPerLevel}점`], ['보스 전설 확률', pct(c.rareRoll.boss.legendary)], ['사망 후 부활', `${c.respawnSec}초`],
  ];
  return `
    <section class="hero" style="background-image:url('${esc(D.meta.hero ?? '')}')">
      <div class="hero-in">
        <h1>${esc(D.meta.game)} 위키</h1>
        <p>공식·확률·도감을 실서버 게임 값 그대로 담았습니다.</p>
        <div class="search" role="search">${icon('search')}<input id="hq" type="search" placeholder="아이템, 스킬, 몬스터, 공식 검색" autocomplete="off" spellcheck="false" aria-label="위키 검색" role="combobox" aria-autocomplete="list" aria-controls="hq-results" aria-expanded="false"><div id="hq-results" class="search-results" role="listbox" hidden></div></div>
        <div class="chips hero-try"><span>이렇게 찾아보세요</span>${tries.map((t) => `<a class="chip" href="${searchHref(t)}">${esc(t)}</a>`).join('')}</div>
      </div>
    </section>
    <div class="grid tiles">${tiles.map(([r, i, color, t, s]) => `<a class="tile" href="#/${r}" style="--tc:${color}"><span class="ti">${icon(i)}</span><div><b>${t}</b><span>${s}</span></div></a>`).join('')}</div>
    <h2>핵심 수치</h2>
    <dl class="kv">${kv.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

// ── 페이지: 데미지 ──
function pageDamage() {
  const c = D.constants;
  const defRows = [0, 10, 25, 50, 75, 100, 150, 200, 300, 400].map((d) => tr([R(d), R(pct(100 / (100 + d))), R(pct(1 - 100 / (100 + d)))]));
  const classRows = D.classes.map((k) => tr([
    `<a href="#/classes/${k.id}">${esc(k.name)}</a>`, DMG[k.dmgType], R(k.baseAtk), R(k.atkGrowth.toFixed(3)), R(k.growth.find((g) => g.level === 100)?.atk ?? '-'), R(k.growth.find((g) => g.level === D.meta.maxLevel)?.atk ?? '-'), R(`${k.critPct}%`),
  ]));
  const rarRows = RARITIES.map((r) => tr([`<span class="rar-${r}">${rarName(r)}</span>`, R(`×${c.rarityMul[r]}`)]));
  const enhRows = EQUIP.map((k) => tr([KIND[k], R(`+${pct(c.enhanceBonusPer[k])}`), R(`×${(1 + c.enhanceBonusPer[k] * c.enhanceMax).toFixed(2)}`)]));
  return `
    ${head('데미지 공식', '게임 서버가 쓰는 식 그대로입니다.')}
    <div class="stack">
      <div class="formula">피해 = max(1, 반올림(<b>공격력</b> × <b>계수</b> × <b>편차</b> × 100 ÷ (100 + <b>대상 방어력</b>)))
편차 = 0.9 ~ 1.1 사이 균등 난수
치명타면 피해 × ${c.critMul} (다시 반올림)</div>
      <ul class="plain">
        <li><b>계수</b>: 기본 공격·스킬마다 정해진 배율입니다(스킬 도감의 "계수"). 도적 기본 공격처럼 여러 번 때리는 공격은 타마다 따로 계산합니다.</li>
        <li><b>방어력</b>은 빼는 값이 아니라 나누는 값이라, 방어력 100이면 피해가 정확히 절반이 됩니다. 아무리 약해도 최소 1은 들어갑니다.</li>
        <li><b>방어력 증가 버프</b>(도발 등 defUp)는 대상 방어력에 (1 + %)를 곱합니다.</li>
        <li><b>다음 공격 강화</b>: dmgNext 버프는 공격력에 배율을 곱하고, critNext는 치명타를 확정합니다. 한 번 쓰면 사라집니다.</li>
        <li>중독 피해와 지속 장판(연막·먹물 등의 틱)은 치명타가 없고, 중독은 방어력도 무시하는 고정 피해입니다(걸 때 시전자 공격력 × 초당 계수).</li>
      </ul>
    </div>

    <h2 id="calc">계산기</h2>
    <div id="calc-root"></div>

    <h2>방어력에 따른 받는 피해</h2>
    ${table([{ t: '방어력', c: 'r' }, { t: '받는 피해', c: 'r' }, { t: '줄어드는 비율', c: 'r' }], defRows)}

    <h2>공격력은 어떻게 정해지나</h2>
    <div class="formula">기본 공격력 = 반올림(직업 기본값 + 성장값 × (레벨 − 1))
물리 공격력 = 기본 공격력 + <b>힘</b> 점수 (+ 올스탯)     ← 기사·활잽이·도적이 씀
마법 공격력 = 기본 공격력 + <b>지능</b> 점수 (+ 올스탯)   ← 마법사·힐러가 씀
전직 패시브(공격력 %)는 여기까지의 값에 곱함
최종 공격력 = 반올림(위 값 + 장비 공격력 합)
장비 수치 = 반올림(기본 수치 × 등급 배율 × (1 + 강화 단계 × 상승률))</div>
    <p class="muted small">전직 공격력 %는 장비 공격력(무기·장갑·반지)에는 붙지 않습니다. 힘과 지능은 한쪽 계열에만 쓰이므로, 자기 직업 계열이 아닌 스탯은 공격력을 올리지 않습니다.</p>
    ${table(['직업', '계열', { t: '기본 공격력(Lv1)', c: 'r' }, { t: '레벨당 성장', c: 'r' }, { t: 'Lv100 기본', c: 'r' }, { t: `Lv${D.meta.maxLevel} 기본`, c: 'r' }, { t: '치명타', c: 'r' }], classRows)}
    <div class="grid g2" style="margin-top:12px">
      <div>${table(['등급', { t: '장비 수치 배율', c: 'r' }], rarRows)}</div>
      <div>${table(['장비 칸', { t: '강화 1단계당', c: 'r' }, { t: `+${c.enhanceMax} 배율`, c: 'r' }], enhRows)}</div>
    </div>

    <h2>방어력·HP·MP</h2>
    <div class="formula">방어력 = 반올림(직업 기본 + 성장 × (레벨 − 1)) + <b>방어</b> 점수 + 장비 방어력 → 전직 방어력 % 곱(반올림)
최대 HP = 반올림(직업 기본 + 성장 × (레벨 − 1)) + <b>체력</b> 점수 × ${c.statEffect.vit.maxHp} + 장비 HP → 전직 HP % 곱(반올림)
최대 MP = 반올림(직업 기본 + 성장 × (레벨 − 1)) + <b>마나</b> 점수 × ${c.statEffect.mana.maxMp} → 전직 MP % 곱</div>

    <h2>치명타</h2>
    <p>치명타 확률 = 직업 기본값 + 전직 패시브(%p). 치명타가 뜨면 피해 × ${c.critMul}. 활잽이는 기본 15%, 나머지 직업은 10%에서 시작합니다. 몬스터 공격은 치명타가 없습니다.</p>

    <h2>치유량·보호막</h2>
    <div class="formula">치유량(보호막) = 대상 최대 HP × 스킬 HP % + 시전자 마법 공격력 × 스킬 마법 공격력 %</div>
    <p class="muted small">힐러 스킬은 마법 공격력 비중이 커서 지능·무기로 마법 공격력을 올려야 회복량이 늡니다(예: 치유의 빛 = 마법 공격력 150% + 대상 최대 HP 12%). 기사의 자가 회복·성역 보호막은 최대 HP만 탑니다. 스킬 도감의 수치 줄에 스킬마다 두 비율이 나옵니다. 회복 물약·마나 물약은 티어마다 정해진 양을 회복합니다(아이템 도감 참고, 쿨 회복 ${c.potionCdSec}초·마나 ${c.mpPotionCdSec}초 따로). 엘릭서는 HP·MP를 함께 채우고 회복 물약 쿨을 같이 씁니다.</p>

    <h2>몬스터가 주는 피해</h2>
    <div class="formula">받는 피해 = max(1, 반올림(몬스터 공격력 × 공격 계수 × 편차 × 100 ÷ (100 + 내 방어력)))</div>
    <ul class="plain">
      <li>몬스터는 치명타가 없습니다. 근접 공격은 휘두르기 시작 뒤 조금 있다 판정되어 대시로 피할 수 있습니다.</li>
      <li>정예 몬스터는 같은 섬 기준 몬스터보다 HP ×${c.elite.hpMul}, 공격력 ×${c.elite.atkMul}, 방어력 ×${c.elite.defMul}(+2), 레벨 +${c.elite.levelBonus}입니다.</li>
      <li>레이드 보스는 제한 시간 안에 못 잡으면 격노해 피해가 커집니다(지역·레이드 참고).</li>
    </ul>`;
}

const calc = { cls: 'knight', branch: '', level: 100, alloc: { str: 0, int: 0, vit: 0, mana: 0, def: 0 }, gear: {}, mob: '', customDef: 50 };
function recommended(cls, pts) {
  const out = { str: 0, int: 0, vit: 0, mana: 0, def: 0 };
  const hint = cls.statHint;
  const per = Math.floor(pts / hint.length);
  hint.forEach((k) => { out[k] = per; });
  for (let i = 0; i < pts - per * hint.length; i++) out[hint[i]] += 1;
  return out;
}
function defaultGear(cls, level) {
  const out = {};
  for (const kind of EQUIP) {
    const best = D.items
      .filter((it) => it.kind === kind && it.rarity === 'common' && (!it.classId || it.classId === cls.id) && it.reqLevel <= level && it.sources.some((s) => s.type === 'shop'))
      .sort((a, b) => b.reqLevel - a.reqLevel)[0];
    out[kind] = best ? { id: best.id, enh: 0 } : { id: '', enh: 0 };
  }
  return out;
}
function resetCalcFor(clsId) {
  const cls = classOf(clsId);
  calc.cls = clsId;
  calc.branch = '';
  calc.alloc = recommended(cls, (calc.level - 1) * D.constants.statPointsPerLevel);
  calc.gear = defaultGear(cls, calc.level);
}
function renderCalc() {
  const root = document.getElementById('calc-root');
  if (!root) return;
  const cls = classOf(calc.cls);
  const branches = D.branches.filter((b) => b.classId === cls.id);
  const canAdvance = calc.level >= D.constants.advanceLevel;
  const branch = canAdvance ? M.branches.get(calc.branch) : undefined;
  const totalPts = (calc.level - 1) * D.constants.statPointsPerLevel;
  const used = Object.values(calc.alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  const gear = EQUIP.map((k) => calc.gear[k]).filter((g) => g && g.id).map((g) => ({ item: M.items.get(g.id), enh: g.enh })).filter((g) => g.item);
  const second = !!branch && calc.level >= D.constants.secondLevel;
  const st = playerStats(cls, calc.level, calc.alloc, gear, branch, second);
  const mob = M.mobs.get(calc.mob);
  const tDef = mob ? mob.def : Number(calc.customDef) || 0;
  const awakened = !!branch && calc.level >= D.constants.awakenLevel;
  const slots = skillsFor(cls, branch, awakened, second).map((id) => M.skills.get(id));
  const crit = Math.min(100, st.crit) / 100;
  const rowsFor = (label, iconHtml, coefs, locked) => coefs.map((cf, i) => {
    const mn = damage(st.atk, cf.coef, tDef, 0);
    const mx = damage(st.atk, cf.coef, tDef, 1);
    const avg = avgDamage(st.atk, cf.coef, tDef);
    const exp = avg * (1 - crit) + Math.round(avg * D.constants.critMul) * crit;
    const perUse = exp * (cf.hits ?? 1);
    const kill = mob ? Math.ceil(mob.hp / perUse) : null;
    const name = i === 0 ? `<span class="name-cell">${iconHtml}<span>${label}${locked ? ` <span class="chip">Lv${locked} 해금</span>` : ''}</span></span>` : `<span class="muted small">└ ${esc(cf.note ?? '')}</span>`;
    return tr([name, R(`${Math.round(cf.coef * 100)}%${cf.hits > 1 ? ` ×${cf.hits}` : ''}`), R(`${fmt(mn)} ~ ${fmt(mx)}`), R(`${fmt(Math.round(mn * D.constants.critMul))} ~ ${fmt(Math.round(mx * D.constants.critMul))}`), R(fmt(Math.round(perUse))), R(kill ?? '—')]);
  }).join('');
  const basicCoefs = [{ coef: cls.basic.coef, hits: cls.basic.hits ?? 1 }];
  let rows = rowsFor('기본 공격', skillIcon({ icon: cls.basicIcon }, 'sm'), basicCoefs, 0);
  slots.forEach((s, i) => {
    if (!s || !s.coefs.length) return;
    rows += rowsFor(`<a href="#/skills/${s.id}">${esc(s.name)}</a> <span class="slot">${i + 1}</span>`, skillIcon(s, 'sm'), s.coefs, calc.level < s.unlockLevel ? s.unlockLevel : 0);
  });
  const mobHit = mob ? { mn: damage(mob.atk, mob.attack.coef, st.def, 0), mx: damage(mob.atk, mob.attack.coef, st.def, 1) } : null;

  const gearOptions = (kind) => D.items.filter((it) => it.kind === kind && (!it.classId || it.classId === cls.id)).sort((a, b) => a.reqLevel - b.reqLevel || RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  const mobGroups = [...D.islands.map((isl) => [isl.name, D.mobs.filter((m) => m.islands.includes(isl.id))]), ...D.raids.map((r) => [r.name, D.mobs.filter((m) => m.islands.includes(r.id))]), ...D.worldBosses.map((w) => [w.name, D.mobs.filter((m) => m.islands.includes(w.islandId))])];

  root.innerHTML = `
  <div class="calc">
    <div class="card calc-form">
      <div class="row">
        <label class="f">직업<select data-k="cls">${D.classes.map((k) => `<option value="${k.id}" ${k.id === cls.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
        <label class="f">레벨<input type="number" min="1" max="${D.meta.maxLevel}" value="${calc.level}" data-k="level"></label>
        <label class="f">전직<select data-k="branch" ${canAdvance ? '' : 'disabled'}><option value="">견습${canAdvance ? '' : ` (Lv${D.constants.advanceLevel}부터)`}</option>${branches.map((b) => `<option value="${b.id}" ${b.id === calc.branch && canAdvance ? 'selected' : ''}>${esc(b.name)}${calc.level >= D.constants.secondLevel ? ` → ${esc(b.second.name)}` : ''}</option>`).join('')}</select></label>
      </div>
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="small">스탯 분배 <span class="muted">${used} / ${totalPts}점${used > totalPts ? ' · 초과' : ''}</span></b><button class="chip accent" type="button" data-act="rec">추천대로 분배</button></div>
        <div class="row">${Object.keys(STAT).map((k) => `<label class="f">${STAT[k]}<input type="number" min="0" max="${totalPts}" value="${calc.alloc[k]}" data-stat="${k}"></label>`).join('')}</div>
      </div>
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="small">장비 <span class="muted">(오른쪽은 강화 단계)</span></b><button class="chip accent" type="button" data-act="gear">레벨에 맞는 상점 장비</button></div>
        <div class="stack" style="--gap:6px">${EQUIP.map((kind) => {
          const g = calc.gear[kind] ?? { id: '', enh: 0 };
          return `<div class="gear-row"><span class="muted">${KIND[kind]}</span><select data-gear="${kind}"><option value="">없음</option>${gearOptions(kind).map((it) => `<option value="${it.id}" ${it.id === g.id ? 'selected' : ''}>${esc(it.name)} · ${rarName(it.rarity)} · Lv${it.reqLevel}${it.reqLevel > calc.level ? ' (착용 불가)' : ''}</option>`).join('')}</select><select data-enh="${kind}" aria-label="${KIND[kind]} 강화">${Array.from({ length: D.constants.enhanceMax + 2 }, (_, i) => `<option value="${i}" ${i === g.enh ? 'selected' : ''}>${i > D.constants.enhanceMax ? '각성' : `+${i}`}</option>`).join('')}</select></div>`;
        }).join('')}</div>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:200px">때릴 대상<select data-k="mob"><option value="">직접 방어력 입력</option>${mobGroups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((m) => `<option value="${m.id}" ${m.id === calc.mob ? 'selected' : ''}>${esc(m.name)} (Lv${m.level} · 방어 ${m.def})</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${mob ? '' : `<label class="f">대상 방어력<input type="number" min="0" value="${calc.customDef}" data-k="customDef"></label>`}
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <h3>내 능력치</h3>
        <dl class="stats">
          <div class="stat"><dt>${cls.dmgType === 'magic' ? '마법' : '물리'} 공격력</dt><dd>${fmt(st.atk)}</dd></div>
          <div class="stat"><dt>방어력</dt><dd>${fmt(st.def)}</dd></div>
          <div class="stat"><dt>최대 HP</dt><dd>${fmt(st.maxHp)}</dd></div>
          <div class="stat"><dt>최대 MP</dt><dd>${fmt(st.maxMp)}</dd></div>
          <div class="stat"><dt>치명타</dt><dd>${st.crit}%</dd></div>
          <div class="stat"><dt>장비 공격력</dt><dd>${fmt(st.gearAtk)}</dd></div>
        </dl>
      </div>
      ${mob ? `<div class="card"><h3>${esc(mob.name)}에게 받는 피해</h3><p class="result-big">${fmt(mobHit.mn)} ~ ${fmt(mobHit.mx)}</p><p class="muted small" style="margin:0">${mob.attack.cdSec}초마다 한 번 · HP ${fmt(st.maxHp)} 기준 약 ${Math.ceil(st.maxHp / ((mobHit.mn + mobHit.mx) / 2))}대 버팀 · 대상 HP ${fmt(mob.hp)}</p></div>` : ''}
    </div>
  </div>
  <div style="margin-top:12px">${table(['공격', { t: '계수', c: 'r' }, { t: '피해', c: 'r' }, { t: '치명타', c: 'r' }, { t: '1회 기대값', c: 'r' }, { t: mob ? '처치 횟수' : '처치', c: 'r' }], [rows])}</div>
  <p class="muted small" style="margin-top:8px">기대값은 편차와 치명타 확률(${st.crit}%)을 반영한 평균입니다. 여러 타를 치는 공격은 모든 타를 합한 값입니다. 스킬 조건(처형 HP 조건·장판 틱 수·다발 명중 수)은 따로 곱하세요.</p>`;
}
function bindCalc() {
  const root = document.getElementById('calc-root');
  if (!root) return;
  root.addEventListener('change', (e) => {
    const t = e.target;
    const k = t.dataset.k;
    if (k === 'cls') resetCalcFor(t.value);
    else if (k === 'level') {
      calc.level = Math.min(D.meta.maxLevel, Math.max(1, Math.floor(Number(t.value) || 1)));
    } else if (k) calc[k] = t.value;
    if (t.dataset.stat) calc.alloc[t.dataset.stat] = Math.max(0, Math.floor(Number(t.value) || 0));
    if (t.dataset.gear) calc.gear[t.dataset.gear] = { id: t.value, enh: calc.gear[t.dataset.gear]?.enh ?? 0 };
    if (t.dataset.enh) calc.gear[t.dataset.enh] = { id: calc.gear[t.dataset.enh]?.id ?? '', enh: Number(t.value) };
    renderCalc();
  });
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'rec') calc.alloc = recommended(classOf(calc.cls), (calc.level - 1) * D.constants.statPointsPerLevel);
    else if (act === 'gear') calc.gear = defaultGear(classOf(calc.cls), calc.level);
    else return;
    renderCalc();
  });
  renderCalc();
}

// ── 페이지: 드랍률 ──
/** 불운 보정 포함 n번 안에 전설이 한 번이라도 나올 확률 = 1 − Π(1 − min(1, 기본 + min(상한, 실패 × 단계))) */
function pityKills(base, target, pity = true) {
  const c = D.constants;
  let miss = 1;
  for (let n = 1; n < 100000; n++) {
    const p = Math.min(1, base + (pity ? Math.min(c.pityCap, (n - 1) * c.pityStep) : 0));
    miss *= 1 - p;
    if (1 - miss >= target) return n;
  }
  return Infinity;
}
function pageDrops() {
  const c = D.constants;
  const rr = c.rareRoll;
  const rareRows = [['field', '일반 몬스터'], ['elite', '정예 몬스터'], ['boss', '필드 보스']].map(([k, n]) => tr([n, R(`${pct(rr[k].epic)}<br><span class="muted small">${oneIn(rr[k].epic)}</span>`), R(rr[k].legendary ? `${pct(rr[k].legendary)} → 최대 ${pct(rr[k].legendary + c.pityCap)}<br><span class="muted small">${oneIn(rr[k].legendary)}</span>` : '—'), R(rr[k].unique ? `${pct(rr[k].unique)}<br><span class="muted small">Lv${c.uniqueMinMobLevel}+ 몬스터만</span>` : '—')]));
  const pityRows = [['정예', rr.elite.legendary], ['필드 보스', rr.boss.legendary]].map(([n, b]) => tr([n, R(`${pityKills(b, 0.5)}마리`), R(`${pityKills(b, 0.9)}마리`), R(`${pityKills(b, 0.5, false)}마리`), R(`${pityKills(b, 0.9, false)}마리`)]));
  const gearAll = (mob) => {
    const gearIds = mob.loot.entries.filter((e) => EQUIP.includes(M.items.get(e.itemId)?.kind));
    return 1 - gearIds.reduce((m, e) => m * (1 - e.chance), 1);
  };
  const fieldMobs = D.mobs.filter((m) => m.kind !== 'raidAdd' && m.kind !== 'worldBossAdd').sort((a, b) => a.level - b.level);
  const mobRows = fieldMobs.map((m) => {
    const other = m.loot.entries.filter((e) => !EQUIP.includes(M.items.get(e.itemId)?.kind)).map((e) => `${esc(M.items.get(e.itemId)?.name ?? e.itemId)} ${pct(e.chance)}`).join(', ');
    return tr([mobLink(m.id), MOB_KIND[m.kind], R(`${fmt(m.loot.gold[0])}~${fmt(m.loot.gold[1])}`), R(pct(gearAll(m))), `<span class="small">${other || '—'}</span>`, R(m.rare.epic ? pct(m.rare.epic) : '—'), R(m.rare.legendary ? pct(m.rare.legendary) : '—'), R(m.rare.unique ? pct(m.rare.unique) : '—')]);
  });
  const chestRows = Object.entries(D.islands.reduce((acc, isl) => { (acc[isl.chestTier] ??= { loot: isl.chestLoot, islands: [] }).islands.push(isl); return acc; }, {})).map(([tier, v]) => {
    const gearP = 1 - v.loot.entries.filter((e) => EQUIP.includes(M.items.get(e.itemId)?.kind)).reduce((m, e) => m * (1 - e.chance), 1);
    const stone = v.loot.entries.find((e) => e.itemId === 'enhance_stone');
    return tr([v.islands.map((i) => islandLink(i.id)).join(', '), R(`${fmt(v.loot.gold[0])}~${fmt(v.loot.gold[1])}`), R('100%'), R(pct(v.loot.entries.find((e) => e.itemId === 'scroll_return')?.chance ?? 0)), R(pct(gearP)), R(stone ? pct(stone.chance) : '—')]);
  });
  const b = c.boxLoot;
  const m = c.market;
  const raidRows = D.raids.map((r) => tr([islandLink(r.id), R(`Lv${r.minLevel}`), `전설 장비 ${pct(r.rewards.legendaryChance)}(영웅 등급 없음)${r.rewards.rareDrop ? ` · 거신 장비 ${pct(r.rewards.rareDrop.chance)}` : ''}${r.rewards.uniqueChance ? ` · 유니크 ${pct(r.rewards.uniqueChance)}` : ''}${r.rewards.firstClearUnique ? ' · 캐릭터 첫 클리어 때 유니크 1개 골라 받기' : ''}`, r.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ×${i.qty}`).join(', ')]));
  const wbRows = D.worldBosses.map((w) => tr([islandLink(w.islandId), R(`${w.minSharePct}% 이상`), w.rewards.uniqueChance ? `유니크 ${pct(w.rewards.uniqueChance)}` : '—', `${fmt(w.rewards.gold)} 베리 · ${w.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ${i.qty[0]}~${i.qty[1]}개`).join(', ')} · 경험치(현재 레벨의 ${pct(w.rewards.expLevelFrac)})`]));
  return `
    ${head('드랍률', '게임 서버의 전리품 규칙 그대로입니다.')}
    <h2 style="margin-top:0">몬스터 한 마리를 잡으면</h2>
    <ol class="plain">
      <li><b>베리</b>: 처치를 인정받은 사람마다 따로 굴려 바로 들어옵니다(줍지 않아도 됨).</li>
      <li><b>일반 전리품</b>: 몬스터 드랍표의 항목마다 <b>독립적으로</b> 한 번씩 굴립니다. 몬스터당 한 번이며, 바닥에 떨어진 뒤 ${c.dropOwnerSec}초 동안은 처치 인정자(파티 포함)만 줍고, ${c.dropDespawnSec}초 뒤 사라집니다.</li>
      <li><b>희귀 장비</b>(영웅·전설·유니크): 처치 인정자 <b>한 명 한 명</b>이 따로 굴립니다. 파티로 잡으면 각자 기회가 있습니다.</li>
    </ol>
    ${note(`처치 인정: 막타를 친 사람과 한 대라도 때린 사람, 그리고 그 파티원 중 반경 ${c.partyExpRadius} 안에 있는 사람 모두입니다. 가상 유저(봇) 파티 덕에만 인정받은 경우 베리·경험치·희귀 굴림이 ${pct(c.botCarryShare)}로 줄어듭니다.`)}

    <h2>희귀 장비 확률 (처치 1회 · 1인 기준)</h2>
    ${table(['몬스터', { t: '영웅', c: 'r' }, { t: '전설', c: 'r' }, { t: '유니크', c: 'r' }], rareRows)}
    <ul class="plain" style="margin-top:10px">
      <li>굴리는 순서: 유니크 → 전설 → 영웅. 먼저 뜬 것 하나만 나옵니다.</li>
      <li><b>영웅</b>은 몬스터 레벨 티어의 영웅 장비 1종이 나옵니다(몬스터 도감 참고).</li>
      <li><b>전설</b>은 내 직업 무기 · 크라켄 비늘 갑옷 · 심연의 등불 3종 중 하나(각 1/3)입니다.</li>
      <li><b>유니크</b>는 Lv${c.uniqueMinMobLevel} 이상 정예·보스(잿불 협곡·별무덤 성역)에서만, 내 직업 무기와 공용 6종 중 하나(각 1/7)입니다. 불운 보정이 없습니다.</li>
    </ul>

    <h3 style="margin-top:18px">전설 불운 보정</h3>
    <p>정예·보스에게서 전설이 안 나올 때마다 다음 전설 확률에 <b>+${pct(c.pityStep)}p</b>가 쌓이고, 최대 <b>+${pct(c.pityCap)}p</b>까지 올라갑니다. 전설을 얻으면 0으로 돌아갑니다. 카운터는 캐릭터마다 하나이고 정예·보스가 함께 씁니다(서버에 저장되어 접속을 끊어도 유지).</p>
    ${table(['대상', { t: '50% 확률까지', c: 'r' }, { t: '90% 확률까지', c: 'r' }, { t: '보정 없으면 50%', c: 'r' }, { t: '보정 없으면 90%', c: 'r' }], pityRows)}

    <h2>몬스터별 드랍</h2>
    <p class="muted small">장비 칸은 그 티어 장비 11종 중 하나 이상이 떨어질 확률입니다(항목마다 따로 굴림). 필드 몬스터 5%, 필드 보스 60%로 맞춰져 있습니다. 항목별 확률은 몬스터 이름을 누르세요.</p>
    ${table(['몬스터', '종류', { t: '베리', c: 'r' }, { t: '장비', c: 'r' }, '기타', { t: '영웅', c: 'r' }, { t: '전설', c: 'r' }, { t: '유니크', c: 'r' }], mobRows, { scroll: true })}

    <h2>보물상자</h2>
    <p class="muted small">섬마다 놓인 상자를 F로 엽니다. 연 뒤 ${c.chestRespawnSec / 60}분 뒤 다시 생깁니다. 회복 물약 1~2개는 반드시 나옵니다.</p>
    ${table(['섬', { t: '베리', c: 'r' }, { t: '회복 물약', c: 'r' }, { t: '귀환 두루마리', c: 'r' }, { t: '장비(아무거나)', c: 'r' }, { t: '강화석', c: 'r' }], chestRows)}

    <h2>수상한 상자 · 암거래상</h2>
    <div class="grid g2">
      <div class="card">
        <h3>${itemLink('mystery_box')}</h3>
        <p class="small muted">암거래상만 파는 상자(${fmt(M.items.get('mystery_box')?.price ?? 0)} 베리). 열면 아래 중 하나가 나옵니다.</p>
        ${table(['결과', { t: '확률', c: 'r' }], [
          tr([`<span class="rar-unique">유니크 장비</span> (Lv${b.uniqueMinLevel} 이상만, 직업이 쓸 수 있는 것 중 1)`, R(pct(b.unique))]),
          tr([`<span class="rar-legendary">전설 장비</span> (직업이 쓸 수 있는 3종 중 1)`, R(pct(b.legendary))]),
          tr([`<span class="rar-epic">영웅 장비</span> (내 레벨 티어의 영웅 장비)`, R(pct(b.epic))]),
          tr([`<span class="rar-rare">희귀 등급</span> 내 레벨 티어의 직업 무기·갑옷·목걸이·투구·장갑·신발·반지 중 1`, R(pct(b.rare))]),
          tr([`베리 ${fmt(b.gold[0])}~${fmt(b.gold[1])} + 강화석 ${b.scrap[0]}~${b.scrap[1]}개 + 내 티어 강화 재료 ${b.mats[0]}~${b.mats[1]}개`, R(`${pct(1 - b.unique - b.legendary - b.epic - b.rare)} 이상`)]),
        ])}
      </div>
      <div class="card">
        <h3>${esc(m.name)}</h3>
        <ul class="plain small">
          <li>서버가 켜지고 ${m.firstDelaySec[0] / 60}~${m.firstDelaySec[1] / 60}분 뒤 처음 나타나고, 그 뒤 ${m.intervalSec[0] / 60}~${m.intervalSec[1] / 60}분마다 다시 나타납니다.</li>
          <li>사람이 있는 섬의 부두 근처에 ${m.staySec / 60}분 머뭅니다(서버 전체 공지).</li>
          <li>재고: 가장 높은 티어 영웅 장비 ${m.epicStock}종 + 수상한 상자 ${m.boxStock}개 + ${pct(m.legendaryChance)} 확률로 전설 장비 1종.</li>
          <li>전설 장비는 한 번 나타날 때 한 사람당 ${m.legendaryPerPlayer}개까지 살 수 있습니다.</li>
          <li>수상한 상자는 한 번 나타날 때 캐릭터마다 ${m.boxPerPlayer}개까지 살 수 있습니다.</li>
        </ul>
      </div>
    </div>

    <h2 id="gems">${esc(D.gems.name)} · 고급 상자</h2>
    <p><b>${esc(D.gems.name)}</b>은 레이드와 ${esc(D.infinite.name)}에서만 낮은 확률로 나오는 재화입니다(캐릭터마다 따로 쌓입니다). 잿빛 해안의 ${esc(npcNameOfRole('gem'))}에게서 쓸 수 있습니다(한 번에 ${D.gems.buyMax}개까지).</p>
    <div class="grid g2">
      <div class="card">
        <h3>얻는 곳</h3>
        <ul class="plain small">
          <li>레이드 클리어 1회: ${pct(D.gems.drop.raid.chance)} 확률로 ${D.gems.drop.raid.qty[0]}~${D.gems.drop.raid.qty[1]}개(참가자마다 따로)</li>
          <li>${esc(D.infinite.name)} 웨이브 클리어: ${pct(D.gems.drop.wave.chance)} 확률로 ${D.gems.drop.wave.qty[0]}개, <b>${D.gems.drop.wave.highFromWave}웨이브부터 ${pct(D.gems.drop.wave.high)}</b> 확률로 ${D.gems.drop.wave.highQty[0]}~${D.gems.drop.wave.highQty[1]}개. 보스 웨이브는 확률 ×${D.gems.drop.wave.bossMul}</li>
        </ul>
        <h3 style="margin-top:12px">젬 상점</h3>
        ${table(['물건', { t: '젬', c: 'r' }, '효과'], D.gems.shop.map((e) => tr([itemLink(e.itemId), R(`<span style="white-space:nowrap">${e.gems}</span>`), `<span class="small">${esc(M.items.get(e.itemId)?.desc ?? '')}</span>`])))}
        <p class="muted small" style="margin-top:8px">가방 확장권 1장 = 가방 +${D.gems.bag.step}칸(최대 +${D.gems.bag.max}칸, 캐릭터마다). 창고 구매권 1장 = 계정 창고 +${D.gems.storage.step}칸(최대 ${D.gems.storage.max}칸). 창고는 잿빛 해안 ${esc(npcNameOfRole('storage'))}에게서 열며 같은 계정의 모든 캐릭터가 함께 씁니다. 귀속 아이템은 넣을 수 없습니다.</p>
      </div>
      <div class="card">
        <h3>${itemLink('premium_box')}</h3>
        <p class="small muted">젬으로만 사는 상자. 여는 사람의 직업·레벨 티어에 맞춰 아래 중 하나가 나오고, 여는 순간 등급에 따라 빛이 달라지는 연출이 나옵니다.</p>
        ${table(['결과', { t: '확률', c: 'r' }], [
          tr([`<span class="rar-unique">유니크 장비</span> (직업이 쓸 수 있는 것 중 1)`, R(pct(D.gems.premium.unique))]),
          tr([`<span class="rar-legendary">전설 장비</span> (직업이 쓸 수 있는 3종 중 1)`, R(pct(D.gems.premium.legendary))]),
          tr([`<span class="rar-epic">영웅 장비</span> (내 레벨 티어의 영웅 장비)`, R(pct(D.gems.premium.epic))]),
          tr([`베리 ${fmt(D.gems.premium.gold[0])}~${fmt(D.gems.premium.gold[1])} + 강화석 ${D.gems.premium.stones[0]}~${D.gems.premium.stones[1]}개 + 내 티어 강화 재료 ${D.gems.premium.mats[0]}~${D.gems.premium.mats[1]}개`, R(pct(1 - D.gems.premium.unique - D.gems.premium.legendary - D.gems.premium.epic))]),
        ])}
        <p style="margin-top:10px"><b>천장</b>: 유니크 없이 ${D.gems.pity - 1}번 열면 <b>${D.gems.pity}번째는 유니크 확정</b>입니다. 유니크가 나오면(확률이든 천장이든) 카운트가 처음부터 다시 셉니다. 남은 횟수는 젬 상점과 개봉 화면에 보입니다(캐릭터마다).</p>
        <p class="muted small">기념 이벤트: ${esc(D.gems.swap.name)}이(가) 잿빛 해안에 ${D.gems.swap.hours}시간 동안 머물며 수상한 상자 ${D.gems.swap.need}개를 고급 상자 1개로 바꿔 줍니다. 이벤트 전부터 가지고 있던 상자만 교환됩니다(교환상이 머무는 동안 처음 접속할 때 가방에 있던 수 + 계정 창고 상자는 먼저 접속한 캐릭터 몫). 그 뒤에 새로 얻은 상자는 교환되지 않습니다.</p>
      </div>
    </div>

    <h2>레이드 보상</h2>
    ${table(['레이드', { t: '입장', c: 'r' }, '장비', '고정 보상'], raidRows)}
    <p class="muted small" style="margin-top:8px">레이드 장비는 참가자마다 따로 굴리며, 내 직업이 쓸 수 있는 것 중에서만 뽑힙니다. 유니크는 불운 보정이 없습니다(${pct(c.uniqueRaidChance)}). 클리어마다 ${pct(D.gems.drop.raid.chance)} 확률로 ${esc(D.gems.name)}도 나옵니다.</p>

    <h2>필드 보스 원정 보상</h2>
    ${table(['전장', { t: '기여 지분', c: 'r' }, '장비', '고정 보상'], wbRows)}
    <p class="muted small" style="margin-top:8px">처치 순간 기여(보스에게 넣은 피해 + 보스와 싸우는 동안 채운 치유량 × ${c.worldBossHealWeight})가 전체의 기준 % 이상인 사람만 받습니다. 힐러는 치유로도 기준을 넘길 수 있습니다. 처치 경험치와 희귀 장비 굴림은 없습니다.</p>`;
}

// ── 페이지: 직업·전직 ──
function passiveText(p) {
  return Object.entries(p).map(([k, v]) => `<span class="chip accent">${PASSIVE[k][0]} +${v}${PASSIVE[k][1]}</span>`).join(' ');
}
function pageClasses() {
  return `
    ${head('직업·전직', `직업 ${D.classes.length}개, 전직 갈래 ${D.branches.length}개, 2차 전직 ${D.branches.length}개`)}
    <div class="grid g3">${D.classes.map((k) => `
      <a class="card class-card" href="#/classes/${k.id}" style="--c:${k.color}">
        ${k.icon ? `<img class="ico lg" src="${esc(k.icon)}" alt="" style="width:64px;height:64px">` : ''}
        <div><b style="font-size:18px;color:var(--text)">${esc(k.name)}</b><div class="muted small">${esc(k.role)}</div>
        <div class="chips" style="margin-top:6px"><span class="chip">${DMG[k.dmgType]}</span><span class="chip">갈래 ${D.branches.filter((b) => b.classId === k.id).length}개</span></div></div>
      </a>`).join('')}
    </div>
    <h2>전직 흐름</h2>
    <div class="steps">
      <span class="step"><b>견습</b> Lv1~${D.constants.advanceLevel - 1} · 직업 기본 스킬 4개</span>${icon('chevron-right')}
      <span class="step"><b>1차 전직</b> Lv${D.constants.advanceLevel} · 섬의 촌장에게 갈래 선택(되돌릴 수 없음)</span>${icon('chevron-right')}
      <span class="step"><b>각성</b> Lv${D.constants.awakenLevel} · 선택 없이 4번 스킬 강화</span>${icon('chevron-right')}
      <span class="step"><b>2차 전직</b> Lv${D.constants.secondLevel} · 촌장에게 의식(갈래마다 정해진 상위 직업)</span>
    </div>
    <p class="muted small" style="margin-top:10px">전직하면 1번 스킬은 그대로, 2·3·4번 스킬이 갈래 전용 스킬로 바뀌고 패시브 능력치가 붙습니다. 2차 전직하면 1~4번 스킬이 모두 훨씬 강한 2차 스킬로 바뀌고 2차 패시브가 1차 패시브에 더해집니다.</p>
    ${table(['직업', '갈래', '콘셉트', '패시브', '2차 전직', '2차 패시브'], D.branches.map((b) => tr([esc(classOf(b.classId).name), `<a href="#/classes/${b.classId}#br-${b.id}" style="color:${esc(b.color)}">${esc(b.name)}</a>`, `<span class="small">${esc(b.concept)}</span>`, passiveText(b.passive), `<a href="#/classes/${b.classId}#br2-${b.id}" style="color:${esc(b.second.color)}">${esc(b.second.name)}</a>`, passiveText(b.second.passive)])))}`;
}
function skillRow(s, compareTo) {
  if (!s) return '';
  const chips = [`<span class="chip">Lv${s.unlockLevel} 해금</span>`, `<span class="chip">${icon('clock')}${s.cdSec}초</span>`, `<span class="chip">${icon('droplet')}MP ${s.mpCost}</span>`];
  if (s.castSec) chips.push(`<span class="chip">시전 ${s.castSec}초</span>`);
  if (s.awaken) chips.push('<span class="chip accent">각성</span>');
  if (s.second) chips.push('<span class="chip accent">2차</span>');
  const base = compareTo && compareTo.id !== s.id ? `<div class="muted small">기본: ${esc(compareTo.name)}</div>` : '';
  return `<div class="skill-row" id="sk-${esc(s.id)}">${skillIcon(s)}<div><b>${esc(s.name)}</b> <span class="slot" title="슬롯">${s.slot}</span>${base}<div class="meta">${chips.join('')}</div><div class="small">${esc(s.desc)}</div><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></div>`;
}
function pageClass(id) {
  const k = classOf(id);
  if (!k) return notFound();
  const brs = D.branches.filter((b) => b.classId === id);
  const basicLine = k.basic.kind === 'melee' ? `근접 ${k.basic.arc}° · 사거리 ${k.basic.range}` : `투사체 사거리 ${k.basic.range}`;
  const growthRows = k.growth.map((g) => tr([R(`Lv${g.level}`), R(fmt(g.atk)), R(fmt(g.maxHp)), R(fmt(g.maxMp)), R(fmt(g.def))]));
  return `
    ${crumb('#/classes', '직업 목록')}
    <div class="detail-head">${k.icon ? `<img class="ico lg" src="${esc(k.icon)}" alt="">` : ''}<div><h1 style="color:${esc(k.color)}">${esc(k.name)}</h1>
      <div class="chips"><span class="chip">${esc(k.role)}</span><span class="chip">${DMG[k.dmgType]} 피해</span><span class="chip">치명타 ${k.critPct}%</span><span class="chip">추천: ${k.statHint.map((s) => STAT[s]).join('·')}</span></div></div></div>
    <div class="grid g2">
      <div class="card"><h3>기본 능력치(스탯·장비 없음)</h3>${table([{ t: '레벨', c: 'r' }, { t: '공격력', c: 'r' }, { t: 'HP', c: 'r' }, { t: 'MP', c: 'r' }, { t: '방어력', c: 'r' }], growthRows)}</div>
      <div class="card"><h3>기본 공격</h3>
        <div class="skill-row">${skillIcon({ icon: k.basicIcon })}<div><b>기본 공격</b><div class="meta"><span class="chip">${icon('clock')}${k.basic.cdSec}초</span><span class="chip">MP 0</span></div><ul><li>${basicLine} · 계수 ${Math.round(k.basic.coef * 100)}%${k.basic.hits > 1 ? ` × ${k.basic.hits}타` : ''}</li></ul></div></div>
        <h3 style="margin-top:14px">견습 스킬</h3>
        ${k.skills.map((sid) => skillRow(M.skills.get(sid))).join('')}
      </div>
    </div>
    <h2>전직 갈래</h2>
    <div class="tree">
      <div class="tree-root card"><b>견습 ${esc(k.name)}</b><div class="muted small">Lv${D.constants.advanceLevel}에 하나 선택</div></div>
      <div class="tree-lines" aria-hidden="true"></div>
      <div>${brs.map((b) => `
        <div class="card branch" id="br-${b.id}" style="--c:${esc(b.color)}">
          <h3><span style="color:${esc(b.color)}">${esc(b.name)}</span> ${passiveText(b.passive)}</h3>
          <p class="muted small">${esc(b.concept)}</p>
          ${[...b.skills, b.awaken].map((sid) => { const s = M.skills.get(sid); return skillRow(s, M.skills.get(k.skills[s.slot - 1])); }).join('')}
        </div>
        ${secondCard(k, b)}`).join('')}</div>
    </div>`;
}
/** 2차 전직 카드: 이름·콘셉트·추가 패시브·스킬 4개(이전 단계 스킬과 비교) */
function secondCard(k, b) {
  const before = skillsFor(k, b, true);
  return `<div class="card branch" id="br2-${b.id}" style="--c:${esc(b.second.color)}">
    <h3><span class="muted small">Lv${D.constants.secondLevel} 2차</span> <span style="color:${esc(b.second.color)}">${esc(b.second.name)}</span> ${passiveText(b.second.passive)}</h3>
    <p class="muted small">${esc(b.second.concept)}</p>
    ${b.second.skills.map((sid, i) => skillRow(M.skills.get(sid), M.skills.get(before[i]))).join('')}
  </div>`;
}

// ── 페이지: 스킬 ──
const skillState = { cls: 'knight' };
function pageSkills(focusId) {
  const focus = focusId ? M.skills.get(focusId) : null;
  if (focus) skillState.cls = focus.classId;
  const k = classOf(skillState.cls);
  const brs = D.branches.filter((b) => b.classId === k.id);
  const html = `
    ${head('스킬 도감', `스킬 ${D.skills.length}개. 계수는 공격력에 곱하는 배율입니다.`)}
    <div class="filters"><div class="seg" role="group" aria-label="직업">${D.classes.map((c) => `<button type="button" data-cls="${c.id}" aria-pressed="${c.id === k.id}">${esc(c.name)}</button>`).join('')}</div></div>
    <div class="grid g2">
      <div class="card"><h3>견습 (${esc(k.name)})</h3>${k.skills.map((sid) => skillRow(M.skills.get(sid))).join('')}</div>
      ${brs.map((b) => `<div class="card branch" style="--c:${esc(b.color)}"><h3><a href="#/classes/${k.id}#br-${b.id}" style="color:${esc(b.color)}">${esc(b.name)}</a> ${passiveText(b.passive)}</h3>${[...b.skills, b.awaken].map((sid) => { const s = M.skills.get(sid); return skillRow(s, M.skills.get(k.skills[s.slot - 1])); }).join('')}</div>${secondCard(k, b)}`).join('')}
    </div>`;
  return html;
}
function bindSkills(focusId) {
  main.querySelector('.seg')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cls]');
    if (!b) return;
    skillState.cls = b.dataset.cls;
    location.hash = '#/skills';
    render();
  });
  if (focusId) {
    const el = document.getElementById(`sk-${focusId}`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('focus'); }
  }
}

// ── 페이지: 아이템 ──
const ITEM_GROUPS = { all: ['전체', null], weapon: ['무기', ['weapon']], armor: ['방어구', ['armor', 'helmet', 'gloves', 'boots']], acc: ['장신구', ['accessory', 'ring']], use: ['소모품', ['potion', 'mp_potion', 'scroll', 'boost', 'box', 'ticket']], mat: ['재료', ['material']] };
const itemState = { group: 'all', rarity: 'all', cls: 'all', q: '', sort: 'default' };
function pageItems() {
  return `
    ${head('아이템 도감', `아이템 ${D.items.length}개. 이름을 누르면 강화 수치와 얻는 곳이 나옵니다.`)}
    <div class="filters">
      <div class="seg" role="group" aria-label="종류" data-f="group">${Object.entries(ITEM_GROUPS).map(([k, [n]]) => `<button type="button" data-v="${k}" aria-pressed="${itemState.group === k}">${n}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="등급" data-f="rarity"><button type="button" data-v="all" aria-pressed="${itemState.rarity === 'all'}">전 등급</button>${RARITIES.map((r) => `<button type="button" data-v="${r}" aria-pressed="${itemState.rarity === r}" class="rar-${r}">${rarName(r)}</button>`).join('')}</div>
    </div>
    <div class="filters">
      <select data-f="cls" aria-label="직업"><option value="all">모든 직업</option>${D.classes.map((c) => `<option value="${c.id}" ${itemState.cls === c.id ? 'selected' : ''}>${esc(c.name)}이 쓸 수 있는</option>`).join('')}</select>
      <select data-f="sort" aria-label="정렬"><option value="default">기본 순서</option><option value="level">착용 레벨 순</option><option value="atk">공격력 순</option><option value="def">방어력 순</option><option value="hp">HP 순</option><option value="price">가격 순</option></select>
      <input class="field" type="text" data-f="q" placeholder="이름으로 거르기" value="${esc(itemState.q)}" aria-label="아이템 이름으로 거르기">
      <span class="count" id="item-count"></span>
    </div>
    <div id="item-list"></div>`;
}
function renderItemList() {
  const kinds = ITEM_GROUPS[itemState.group][1];
  let list = D.items.filter((it) => (!kinds || kinds.includes(it.kind)) && (itemState.rarity === 'all' || it.rarity === itemState.rarity) && (itemState.cls === 'all' || !it.classId || it.classId === itemState.cls) && nameMatches(it.name, itemState.q));
  const key = itemState.sort;
  if (key === 'level') list = [...list].sort((a, b) => (a.reqLevel ?? 0) - (b.reqLevel ?? 0));
  else if (key !== 'default') list = [...list].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  document.getElementById('item-count').textContent = `${list.length}개`;
  const rows = list.map((it) => {
    const st = [it.atk && `공격 ${it.atk}`, it.def && `방어 ${it.def}`, it.hp && `HP ${it.hp}`, it.allStat && `올스탯 ${it.allStat}`, it.heal && `HP 회복 ${it.heal}`, it.mp && `MP 회복 ${it.mp}`].filter(Boolean).join(' · ');
    return tr([itemLink(it.id), KIND[it.kind], `<span class="rar-${it.rarity}">${rarName(it.rarity)}</span>`, R(it.reqLevel ? `Lv${it.reqLevel}` : '—'), it.classId ? esc(classOf(it.classId).name) : '<span class="muted">공용</span>', `<span class="small">${st || '—'}</span>`, R(it.price ? fmt(it.price) : '—')]);
  });
  document.getElementById('item-list').innerHTML = list.length ? table(['이름', '종류', '등급', { t: '착용', c: 'r' }, '직업', '능력치', { t: '가격', c: 'r' }], rows) : '<div class="empty-state">조건에 맞는 아이템이 없습니다.</div>';
}
function bindItems() {
  main.querySelectorAll('.seg[data-f]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    itemState[seg.dataset.f] = b.dataset.v;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderItemList();
  }));
  main.querySelector('select[data-f="sort"]').value = itemState.sort;
  main.querySelectorAll('select[data-f], input[data-f]').forEach((el) => el.addEventListener('input', () => { itemState[el.dataset.f] = el.value; renderItemList(); }));
  renderItemList();
}
function sourceBlock(it) {
  const by = (t) => it.sources.filter((s) => s.type === t);
  const out = [];
  const shop = by('shop');
  if (shop.length) out.push(`<div class="card"><h3>${icon('coins', 'i')} 상점</h3><p>${shop.map((s) => islandLink(s.island)).join(', ')} 상인 · ${fmt(it.price)} 베리</p></div>`);
  const mob = by('mob').sort((a, b) => b.chance - a.chance);
  if (mob.length) out.push(`<div class="card"><h3>몬스터 드랍</h3>${table(['몬스터', { t: '확률', c: 'r' }, { t: '개수', c: 'r' }], mob.map((s) => tr([mobLink(s.mob), R(pct(s.chance)), R(s.qty ? `${s.qty[0]}~${s.qty[1]}` : 1)])), { scroll: mob.length > 10 })}</div>`);
  const rare = by('rare').sort((a, b) => b.chance / b.pick - a.chance / a.pick);
  if (rare.length) out.push(`<div class="card"><h3>희귀 드랍 (처치 1회 · 1인)</h3>${table(['몬스터', '등급', { t: '이 아이템일 확률', c: 'r' }], rare.map((s) => tr([mobLink(s.mob), `<span class="rar-${s.rarity}">${rarName(s.rarity)}</span>${s.pity ? ' <span class="chip">불운 보정</span>' : ''}`, R(`${pct(s.chance / s.pick)}${s.pick > 1 ? `<br><span class="muted small">${rarName(s.rarity)} ${pct(s.chance)} × 1/${s.pick}</span>` : ''}`)])), { scroll: rare.length > 10 })}<p class="muted small" style="margin:8px 0 0">${it.classId ? '' : '직업 무기가 아닌 장비는 모든 직업에게 같은 확률입니다. '}전설·유니크는 내 직업이 쓸 수 있는 것 중에서만 뽑힙니다.</p></div>`);
  const chest = by('chest');
  if (chest.length) out.push(`<div class="card"><h3>보물상자</h3>${table(['섬', { t: '확률', c: 'r' }], chest.map((s) => tr([D.islands.filter((i) => i.chestTier === s.tier).map((i) => islandLink(i.id)).join(', '), R(`${pct(s.chance)}${s.qty ? ` · ${s.qty[0]}~${s.qty[1]}개` : ''}`)])))}</div>`);
  const raid = by('raid');
  if (raid.length) out.push(`<div class="card"><h3>레이드</h3><ul class="plain">${raid.map((s) => `<li>${islandLink(s.raid)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  const wb = by('worldBoss');
  if (wb.length) out.push(`<div class="card"><h3>필드 보스 원정</h3><ul class="plain">${wb.map((s) => `<li>${islandLink(M.worldBosses.get(s.boss)?.islandId ?? s.boss)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  const quest = by('quest');
  if (quest.length) out.push(`<div class="card"><h3>퀘스트 보상</h3><ul class="plain">${quest.map((s) => `<li>${esc(M.quests.get(s.quest)?.name ?? s.quest)} ×${s.qty}</li>`).join('')}</ul></div>`);
  const qdrop = by('questDrop');
  if (qdrop.length) out.push(`<div class="card"><h3>퀘스트 수집품</h3><ul class="plain">${qdrop.map((s) => `<li>${esc(M.quests.get(s.quest)?.name ?? s.quest)} 진행 중 ${mobLink(s.mob)}에게서 ${pct(s.chance)} (${s.n}개 필요)</li>`).join('')}</ul></div>`);
  const market = by('market');
  if (market.length) out.push(`<div class="card"><h3>${esc(D.constants.market.name)}</h3><ul class="plain">${market.map((s) => `<li>${esc(s.note)} · ${fmt(it.price)} 베리</li>`).join('')}</ul></div>`);
  const box = by('box');
  if (box.length) out.push(`<div class="card"><h3>수상한 상자</h3><ul class="plain">${box.map((s) => `<li>${pct(s.chance)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  const gemShop = by('gemShop');
  if (gemShop.length) out.push(`<div class="card"><h3>${esc(npcNameOfRole('gem'))} (잿빛 해안)</h3><ul class="plain">${gemShop.map((s) => `<li>${esc(D.gems.name)} ${s.gems}개</li>`).join('')}${it.id === 'premium_box' ? `<li>기념 이벤트 동안 ${esc(D.gems.swap.name)}: 수상한 상자 ${D.gems.swap.need}개 → 1개</li>` : ''}</ul></div>`);
  const premium = by('premium');
  if (premium.length) out.push(`<div class="card"><h3>고급 상자</h3><ul class="plain">${premium.map((s) => `<li>${pct(s.chance)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  if (!out.length) out.push(`<div class="empty-state">${it.bound ? '운영자 지급 전용 아이템입니다(귀속).' : '지금은 게임 안에서 얻는 곳이 없습니다.'}</div>`);
  return out.join('');
}
function pageItem(id) {
  const it = M.items.get(id);
  if (!it) return notFound();
  const c = D.constants;
  const equip = EQUIP.includes(it.kind);
  const chips = [`<span class="chip">${KIND[it.kind]}</span>`, `<span class="chip rar-${it.rarity}">${rarName(it.rarity)}</span>`, `<span class="chip">티어 ${it.tier}</span>`];
  if (it.reqLevel) chips.push(`<span class="chip">착용 Lv${it.reqLevel}</span>`);
  chips.push(`<span class="chip">${it.classId ? `${esc(classOf(it.classId).name)} 전용` : '공용'}</span>`);
  if (it.bound) chips.push(it.disposable ? '<span class="chip accent">귀속 · 거래 불가(판매·버리기 가능)</span>' : '<span class="chip accent">귀속</span>');
  const stats = [['공격력', it.atk], ['방어력', it.def], ['HP', it.hp], ['올스탯', it.allStat], ['HP 회복', it.heal], ['MP 회복', it.mp], ['구매가', it.price && fmt(it.price)], ['판매가', it.sell && fmt(it.sell)]].filter(([, v]) => v);
  let enh = '';
  if (equip) {
    const keys = [['atk', '공격력'], ['def', '방어력'], ['hp', 'HP']].filter(([k]) => it[k]);
    const rows = Array.from({ length: c.enhanceMax + 2 }, (_, lv) => {
      const g = gearStats(it, lv);
      return tr([R(lv > c.enhanceMax ? '<span style="color:var(--bad)">각성</span>' : `+${lv}`), ...keys.map(([k]) => R(fmt(g[k]))), R(lv < c.enhanceMax ? `${D.enhance[lv].rate}%` : lv === c.enhanceMax ? `각성 ${D.awaken.rate}% (실패마다 +${D.awaken.step}%)` : '—'), R(lv < c.enhanceMax ? fmt(D.enhance[lv].goldPerTier * it.tier) : '—')]);
    });
    enh = `<h2>강화 수치</h2><p class="muted small">${rarName(it.rarity)} 등급 기준(×${c.rarityMul[it.rarity]}). 단계당 +${pct(c.enhanceBonusPer[it.kind])}, 각성은 +${c.enhanceMax} 배율의 ×${D.awaken.mul}. 비용·성공률은 그 단계에서 다음 단계로 올릴 때 값입니다.</p>${table([{ t: '단계', c: 'r' }, ...keys.map(([, n]) => ({ t: n, c: 'r' })), { t: '다음 성공률', c: 'r' }, { t: '비용(베리)', c: 'r' }], rows)}`;
  }
  return `
    ${crumb('#/items', '아이템 도감')}
    <div class="detail-head">${itemIcon(it, 'lg')}<div><h1 class="rar-${it.rarity}">${esc(it.name)}</h1><div class="chips">${chips.join('')}</div></div></div>
    <p>${esc(it.desc)}</p>
    ${stats.length ? `<dl class="stats">${stats.map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    <h2>얻는 곳</h2>
    <div class="grid g3 src-grid">${sourceBlock(it)}</div>
    ${enh}`;
}

// ── 페이지: 몬스터 ──
const mobState = { island: 'all', kind: 'all', q: '' };
function pageMobs() {
  const places = [...D.islands.map((i) => [i.id, i.name]), ...D.raids.map((r) => [r.id, r.name]), ...D.worldBosses.map((w) => [w.islandId, w.name])];
  return `
    ${head('몬스터 도감', `몬스터 ${D.mobs.length}종`)}
    <div class="filters">
      <select data-f="island" aria-label="지역"><option value="all">모든 지역</option>${places.map(([id, n]) => `<option value="${id}" ${mobState.island === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="종류" data-f="kind"><button type="button" data-v="all" aria-pressed="${mobState.kind === 'all'}">전체</button>${Object.entries(MOB_KIND).map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${mobState.kind === k}">${n}</button>`).join('')}</div>
      <input class="field" type="search" data-f="q" placeholder="이름으로 거르기 (초성 가능)" value="${esc(mobState.q)}" aria-label="몬스터 이름으로 거르기">
      <span class="count" id="mob-count"></span>
    </div>
    <div id="mob-list"></div>`;
}
function renderMobList() {
  const list = D.mobs.filter((m) => (mobState.island === 'all' || m.islands.includes(mobState.island)) && (mobState.kind === 'all' || m.kind === mobState.kind) && nameMatches(m.name, mobState.q)).sort((a, b) => a.level - b.level);
  document.getElementById('mob-count').textContent = `${list.length}종`;
  document.getElementById('mob-list').innerHTML = table(['이름', '종류', { t: 'HP', c: 'r' }, { t: '공격력', c: 'r' }, { t: '방어력', c: 'r' }, { t: '경험치', c: 'r' }, '지역', '선공'], list.map((m) => tr([mobLink(m.id), MOB_KIND[m.kind], R(fmt(m.hp)), R(fmt(m.atk)), R(fmt(m.def)), R(fmt(m.exp)), m.islands.map(islandLink).join(', '), m.aggro === 'aggressive' ? '<span style="color:var(--bad)">선공</span>' : '<span class="muted">비선공</span>'])));
}
function bindMobs() {
  main.querySelector('select[data-f="island"]').addEventListener('input', (e) => { mobState.island = e.target.value; renderMobList(); });
  main.querySelector('input[data-f="q"]').addEventListener('input', (e) => { mobState.q = e.target.value; renderMobList(); });
  const seg = main.querySelector('.seg[data-f="kind"]');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    mobState.kind = b.dataset.v;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderMobList();
  });
  renderMobList();
}
function pageMob(id) {
  const m = M.mobs.get(id);
  if (!m) return notFound();
  const c = D.constants;
  const atk = m.attack;
  const stats = [['레벨', m.level], ['HP', fmt(m.hp)], ['공격력', fmt(m.atk)], ['방어력', fmt(m.def)], ['공격 계수', `${Math.round(atk.coef * 100)}%`], ['공격 간격', `${atk.cdSec}초`], ['공격 방식', atk.kind === 'melee' ? `근접 ${atk.range}` : `원거리 ${atk.range}`], ['이동 속도', m.speed], ['경험치', fmt(m.exp)], ['리스폰', m.respawnSec ? `${m.respawnSec >= 60 ? `${m.respawnSec / 60}분` : `${m.respawnSec}초`}` : '—']];
  const lootRows = [...m.loot.entries].sort((a, b) => b.chance - a.chance).map((e) => tr([itemLink(e.itemId), R(pct(e.chance)), R(e.qty ? `${e.qty[0]}~${e.qty[1]}` : 1), R(`<span class="muted small">${oneIn(e.chance)}</span>`)]));
  const rare = [];
  if (m.rare.unique) rare.push(tr([`<span class="rar-unique">유니크</span> (공용 6종 + 내 무기 중 1)`, R(pct(m.rare.unique)), R(`<span class="muted small">${oneIn(m.rare.unique)}</span>`)]));
  if (m.rare.legendary) rare.push(tr([`<span class="rar-legendary">전설</span> (내 무기·갑옷·목걸이 중 1) <span class="chip">불운 보정</span>`, R(`${pct(m.rare.legendary)} ~ ${pct(m.rare.legendary + c.pityCap)}`), R(`<span class="muted small">${oneIn(m.rare.legendary)}</span>`)]));
  if (m.rare.epic) rare.push(tr([`<span class="rar-epic">영웅</span> ${itemLink(m.rare.epicItem)}`, R(pct(m.rare.epic)), R(`<span class="muted small">${oneIn(m.rare.epic)}</span>`)]));
  const raid = D.raids.find((r) => r.bossId === m.id);
  const wb = D.worldBosses.find((w) => w.bossId === m.id);
  return `
    ${crumb('#/mobs', '몬스터 도감')}
    <div class="detail-head"><span class="ico lg ph">${icon(m.kind === 'field' ? 'skull' : 'crown', 'i')}</span><div><h1>${esc(m.name)}</h1><div class="chips"><span class="chip">${MOB_KIND[m.kind]}</span><span class="chip" ${m.aggro === 'aggressive' ? 'style="color:var(--bad)"' : ''}>${m.aggro === 'aggressive' ? '선공' : '비선공'}</span>${m.islands.map((i) => `<span class="chip">${islandLink(i)}</span>`).join('')}</div></div></div>
    <dl class="stats">${stats.map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${raid ? `<p style="margin-top:12px">${islandLink(raid.id)}의 보스입니다. 보상은 레이드 클리어 보상으로 나옵니다.</p>` : ''}
    ${wb ? `<p style="margin-top:12px">${islandLink(wb.islandId)}의 원정 필드 보스입니다. 처치 때 기여 지분(피해 + 치유) ${wb.minSharePct}% 이상인 사람만 <a href="#/world#wb-${esc(wb.id)}">원정 보상</a>을 받습니다.</p>` : ''}
    <h2>드랍표 <span class="muted small">베리 ${fmt(m.loot.gold[0])}~${fmt(m.loot.gold[1])}</span></h2>
    ${table(['아이템', { t: '확률', c: 'r' }, { t: '개수', c: 'r' }, { t: '', c: 'r' }], lootRows)}
    ${rare.length ? `<h2>희귀 장비 (1인 기준)</h2>${table(['결과', { t: '확률', c: 'r' }, { t: '', c: 'r' }], rare)}` : ''}
    <p class="muted small" style="margin-top:10px">경험치는 몬스터와 레벨이 같을 때 값입니다. 내가 ${c.expPenaltyDiff[0]}레벨 이상 높으면 50%, ${c.expPenaltyDiff[1]}레벨 이상 높으면 10%만 받습니다.</p>`;
}

// ── 페이지: 지역·레이드 ──
function objectiveText(o) {
  switch (o.k) {
    case 'kill': return `${mobLink(o.mobId)} ${o.n}마리 처치`;
    case 'killBoss': return `${mobLink(o.mobId)} 처치`;
    case 'talk': return `${esc(D.npcNames[o.npcId] ?? o.npcId)}와 대화`;
    case 'collect': return `${itemLink(o.itemId)} ${o.n}개 모으기(${mobLink(o.fromMob)}에게서 ${pct(o.chance)})`;
    case 'travel': return `${islandLink(o.islandId)}로 이동`;
    default: return esc(o.k);
  }
}
function pageWorld() {
  const islands = D.islands.map((isl) => {
    const elite = isl.mobs.map((id) => M.mobs.get(id)).find((m) => m?.kind === 'elite');
    const normal = isl.mobs.map((id) => M.mobs.get(id)).filter((m) => m && m.kind === 'field');
    const quests = isl.quests.map((q) => M.quests.get(q));
    return `
      <section class="card" id="isl-${isl.id}">
        <h2 style="margin-top:0">${esc(isl.name)} <span class="chip">Lv${isl.levelRange[0]}~${isl.levelRange[1]}</span> <span class="chip">입장 Lv${isl.minLevel}</span> <span class="chip">장비 티어 ${isl.tier}</span></h2>
        <div class="grid g2">
          <div>
            <h3>몬스터</h3>
            <ul class="plain">${normal.map((m) => `<li>${mobLink(m.id)}</li>`).join('')}
              ${elite ? `<li><span class="chip">정예</span> ${mobLink(elite.id)} · ${D.constants.elite.respawnSec / 60}분마다</li>` : ''}
              ${isl.bossId ? `<li><span class="chip accent">필드 보스</span> ${mobLink(isl.bossId)} · ${D.constants.bossRespawnSec}초마다</li>` : ''}</ul>
            <h3 style="margin-top:12px">NPC</h3>
            <p class="small">${isl.npcs.map((n) => `${esc(n.name)} <span class="muted">(${ROLE[n.role] ?? n.role})</span>`).join(' · ')}</p>
            <p class="small muted">보물상자 ${isl.chests}개 · 상자 보상은 <a href="#/drops">드랍률</a> 참고</p>
          </div>
          <div>
            <h3>상점</h3>
            <div class="chips">${isl.shop.map((id) => { const it = M.items.get(id); return `<a class="chip" href="#/items/${id}">${esc(it?.name ?? id)}</a>`; }).join('')}</div>
          </div>
        </div>
        ${quests.length ? `<details style="margin-top:12px"><summary>퀘스트 ${quests.length}개</summary>${table(['퀘스트', { t: 'Lv', c: 'r' }, '목표', '보상'], quests.map((q) => tr([`${esc(q.name)}<div class="muted small">${esc(q.npc)}</div>`, R(q.minLevel), `<span class="small">${q.objectives.map(objectiveText).join('<br>')}</span>`, `<span class="small">경험치 ${fmt(q.rewards.exp)} · ${fmt(q.rewards.gold)} 베리${(q.rewards.items ?? []).map((i) => `<br>${esc(M.items.get(i.itemId)?.name ?? i.itemId)} ×${i.qty}`).join('')}</span>`])))}</details>` : ''}
      </section>`;
  }).join('');
  const raids = D.raids.map((r) => `
    <section class="card" id="raid-${r.id}">
      <h2 style="margin-top:0">${esc(r.name)} <span class="chip">입장 Lv${r.minLevel}</span>${r.guild ? ' <span class="chip">길드 레이드</span>' : ''} <span class="chip">${r.minParty === 1 ? '혼자' : r.minParty}~${r.size}인</span> <span class="chip">제한 ${r.timeLimitSec / 60}분</span>${r.cooldownSec ? ` <span class="chip">클리어 뒤 재입장 ${Math.round(r.cooldownSec / 60)}분</span>` : ''}</h2>
      <p>보스: ${mobLink(r.bossId)} · HP ${fmt(M.mobs.get(r.bossId)?.hp ?? 0)}${r.bossHpScale ? ` × (${r.bossHpScale.base} + ${r.bossHpScale.perExtra} × (입장 인원 − ${r.bossHpScale.from ?? 1}${(r.bossHpScale.from ?? 1) > 1 ? ', 0 미만이면 0' : ''}))` : ''}${r.guideIsland ? ` · ${islandLink(r.guideIsland)}의 레이드 안내인에게서 출발` : ''}</p>
      ${r.guild ? '<p class="small">길드장·부길드장이 출발을 요청하면 접속한 길드원 전원(입장 레벨 이상·재입장 대기 아님)에게 준비 확인이 갑니다. 어느 섬에 있든 준비 완료를 누르면 바로 들어가고, 끝나면 각자 있던 섬으로 돌아옵니다. 보스는 뛰어올라 내리꽂고(도약) 직선으로 돌진하며, 보스 품이 안전한 고리(도넛) 패턴이 있습니다.</p>' : ''}
      <p class="small">혼자 입장해 클리어하면 보상(베리·경험치·아이템 수량·장비/희귀/유니크 확률)이 ×${r.soloMul}입니다. 2명 이상이면 그대로입니다.</p>
      ${table(['페이즈', { t: '보스 HP', c: 'r' }, '패턴'], r.phases.map((p) => tr([`${p.phase}`, R(`${p.fromHpPct}% 이하`), esc(p.label) + (p.lethal ? ' <span class="small">· 즉사 패턴</span>' : '') + (p.debuffs?.length ? `<br><span class="small">맞으면: ${p.debuffs.map(esc).join(' · ')}</span>` : '')])))}
      ${r.enrage ? `<p class="small" style="margin-top:8px">격노: 시작 ${r.enrage.afterSec / 60}분 뒤 보스 피해 ×${r.enrage.damageMultiplier}</p>` : ''}
      <h3>보상 (참가자 전원)</h3>
      <ul class="plain small">
        <li>경험치 ${fmt(r.rewards.exp)} · ${fmt(r.rewards.gold)} 베리 · ${r.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ×${i.qty}`).join(', ')}</li>
        <li>${pct(r.rewards.legendaryChance)} 확률로 전설 등급 레이드 장비 1점(${r.rewards.gearPool.length}종 중 내가 쓸 수 있는 것, 첫 클리어는 자기 직업 무기). 레이드에서는 영웅 등급이 나오지 않습니다.</li>
        ${r.rewards.rareDrop ? `<li>${pct(r.rewards.rareDrop.chance)} 확률로 거신 장비 1점 추가</li>` : ''}
        ${r.rewards.uniqueChance ? `<li>${pct(r.rewards.uniqueChance)} 확률로 유니크 장비 1점</li>` : ''}
        ${r.rewards.firstClearUnique ? '<li><b>캐릭터마다 처음 깰 때 한 번</b>: 내 직업 무기 + 직업 무관 유니크 중 원하는 1개를 골라 받습니다(귀속 아님). 가방이 차 있거나 창을 닫아도 다음에 접속할 때 다시 고를 수 있습니다. 서버 최초 칭호는 없습니다.</li>' : ''}
      </ul>
    </section>`).join('');
  const worldBosses = D.worldBosses.map((w) => `
    <section class="card" id="wb-${w.id}">
      <h2 style="margin-top:0">${esc(w.name)} <span class="chip">누구나 참여</span> <span class="chip">처치 뒤 ${w.respawnSec / 60}분마다</span></h2>
      <p>보스: ${mobLink(w.bossId)} · HP ${fmt(M.mobs.get(w.bossId)?.hp ?? 0)} · 어느 섬의 항해사(뱃사공)에게서든 「원정」으로 건너갑니다. 파티 · 인원 제한이 없습니다.</p>
      ${table(['페이즈', { t: '보스 HP', c: 'r' }, '패턴'], w.phases.map((p) => tr([`${p.phase}`, R(`${p.fromHpPct}% 이하`), esc(p.label)])))}
      ${w.enrage ? `<p class="small" style="margin-top:8px">격노: 교전 ${w.enrage.afterSec / 60}분 뒤 보스 피해 ×${w.enrage.damageMultiplier}</p>` : ''}
      <h3>보상 (처치 때 기여 지분 ${w.minSharePct}% 이상인 사람 — 기여 = 피해 + 치유 × ${D.constants.worldBossHealWeight})</h3>
      <ul class="plain small">
        <li>${fmt(w.rewards.gold)} 베리 · 경험치(현재 레벨 필요 경험치의 ${pct(w.rewards.expLevelFrac)}) · ${w.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ${i.qty[0]}~${i.qty[1]}개`).join(', ')}</li>
        ${w.rewards.uniqueChance ? `<li>${pct(w.rewards.uniqueChance)} 확률로 유니크 장비 1점</li>` : ''}
        <li>지분이 모자라면 보상이 없습니다. 전투 중 보스 바 아래에 내 지분과 순위가 보입니다.</li>
      </ul>
    </section>`).join('');
  const inf = D.infinite;
  const infCard = `
    <section class="card" id="raid-${inf.id}">
      <h2 style="margin-top:0">${esc(inf.name)} <span class="chip">입장 Lv${inf.minLevel}</span> <span class="chip">혼자~${inf.size}인</span> <span class="chip">제한 시간 없음</span> <span class="chip">재입장 대기 없음</span></h2>
      <p>레이드 안내인·항해사의 레이드 목록에서 출발합니다(파티 없이 혼자도 가능). ${inf.firstWaveSec}초 뒤 1웨이브가 몰려오고, 투기장의 몬스터를 모두 쓰러뜨리면 웨이브 클리어 → ${inf.breakSec}초 쉬고 다음 웨이브. <b>웨이브에는 끝이 없습니다.</b> ${inf.bossEvery}웨이브마다 보스(호위 ${inf.bossEscorts})가 나옵니다.</p>
      <p class="small">몬스터 수치는 웨이브마다 곱으로 커집니다: HP ${fmt(inf.scaling.hp)} × ${inf.scaling.hpGrowth}^(웨이브−1), 공격력 ${inf.scaling.atk} × ${inf.scaling.atkGrowth}^(웨이브−1), 방어력 ${inf.scaling.def} + ${inf.scaling.defStep} × (웨이브−1). 보스 = HP ×${inf.scaling.bossHpMul} · 공격력 ×${inf.scaling.bossAtkMul} · 방어력 +${inf.scaling.bossDefAdd}. 처치 경험치·일반 드랍은 없습니다(${D.gems.infUnique.fromWave}웨이브부터 유니크 굴림만 있습니다).</p>
      ${table([{ t: '웨이브', c: 'r' }, { t: '몬스터', c: 'r' }, { t: 'HP', c: 'r' }, { t: '공격력', c: 'r' }, { t: '방어력', c: 'r' }, '보스', { t: '클리어 베리', c: 'r' }, { t: '경험치', c: 'r' }, { t: '강화석', c: 'r' }, { t: esc(D.gems.name), c: 'r' }], inf.waves.map((w) => tr([R(w.wave), R(w.count), R(fmt(w.mob.hp)), R(fmt(w.mob.atk)), R(fmt(w.mob.def)), w.bossId ? `${mobLink(w.bossId)} <span class="muted small">HP ${fmt(w.bossStats.hp)} · 공격력 ${fmt(w.bossStats.atk)}</span>` : '', R(fmt(w.gold)), R(pct(w.expPct)), R(w.stones || ''), R(pct(w.gem.chance))])))}
      <h3>보상 (웨이브를 넘길 때마다 투기장 안 전원)</h3>
      <ul class="plain small">
        <li>${fmt(inf.rewards.gold)} × ${inf.rewards.goldGrowth}^(웨이브−1) 베리 · 경험치(현재 레벨 필요 경험치의 ${pct(inf.rewards.expPct)} × (1 + ${inf.rewards.expGrowth} × (웨이브−1)) — <b>높은 웨이브일수록 많이</b>) · 보스 웨이브는 강화석(${inf.bossEvery}웨이브마다 ${inf.rewards.stonesPerBoss}개씩 늘어남)</li>
        <li>${esc(D.gems.name)}: 웨이브마다 ${pct(D.gems.drop.wave.chance)}, <b>${D.gems.drop.wave.highFromWave}웨이브부터 ${pct(D.gems.drop.wave.high)}</b>(보스 웨이브는 ×${D.gems.drop.wave.bossMul})</li>
        <li><b>${D.gems.infUnique.fromWave}웨이브부터</b> 몬스터를 잡을 때마다 유니크 장비 굴림: 일반 몬스터 ${pct(D.gems.infUnique.mob)}, 보스 ${pct(D.gems.infUnique.boss)}(투기장 안 한 명마다 따로, 직업에 맞는 것)</li>
        <li><b>서버 최초로 ${inf.firstClearWave}웨이브를 넘긴 파티 전원</b>에게 직업에 맞는 유니크 장비 1점(한 번뿐)</li>
        <li>라이프 토큰 ${inf.lifeTokens}개 · 투기장 안 전원이 한꺼번에 쓰러지면 도전이 끝납니다. 웨이브 보상과 기록은 웨이브마다 바로 남습니다.</li>
        <li>랭킹: 메뉴 › 랭킹 › 무한의 던전 — 같은 파티 구성마다 최고 기록(웨이브 → 걸린 시간 순)</li>
      </ul>
    </section>`;
  const aug = D.augment;
  const augCard = `
    <section class="card" id="raid-${aug.id}">
      <h2 style="margin-top:0">${esc(aug.name)} <span class="chip">베타</span> <span class="chip">입장 Lv${inf.minLevel}</span> <span class="chip">혼자~${inf.size}인</span></h2>
      <p>${esc(inf.name)}와 같은 투기장·웨이브·보상 규칙에 <b>${aug.every}웨이브를 넘길 때마다 증강 카드 3장 중 1장</b>을 고릅니다(${aug.pickSec}초 안에, 다시 뽑기 ${aug.rerolls}회, 시간이 지나면 무작위). 모두 고를 때까지 다음 웨이브를 기다립니다. 증강은 이번 도전 동안만 유지되고 투기장을 나가면 사라집니다. 같은 증강은 한 번만 가질 수 있습니다.</p>
      <p class="small">베타: 랭킹·서버 최초 돌파 보상은 없고 개인 최고 기록만 따로 남습니다.</p>
      ${table(['선택', ...Object.values(aug.tierNames).map((n) => ({ t: esc(n), c: 'r' }))], aug.odds.map((o, i) => tr([`${(i + 1) * aug.every}웨이브${i === aug.odds.length - 1 ? '부터' : ''}`, R(`${o.silver}%`), R(`${o.gold}%`), R(`${o.prism}%`)])))}
      ${table(['증강', '등급', '효과'], aug.list.map((a) => tr([esc(a.name), esc(aug.tierNames[a.tier]), esc(a.desc)])))}
    </section>`;
  return `${head('지역·레이드', '섬은 항해사(뱃사공)로 옮겨 다닙니다. 입장 레벨이 되어야 갈 수 있습니다.')}<div class="stack">${islands}</div><h2>레이드</h2><div class="stack">${raids}${infCard}${augCard}</div><h2>필드 보스 원정</h2><div class="stack">${worldBosses}</div>`;
}

// ── 페이지: 성장·강화 ──
const growthState = { tier: 4, level: 1 };
function pageGrowth() {
  const c = D.constants;
  const effRows = Object.keys(STAT).map((k) => tr([STAT[k], Object.entries(c.statEffect[k]).map(([f, v]) => `${{ patk: '물리 공격력', matk: '마법 공격력', maxHp: '최대 HP', maxMp: '최대 MP', def: '방어력' }[f]} +${v}`).join(', ')]));
  return `
    ${head('성장·강화')}
    <h2 style="margin-top:0">스탯 점수</h2>
    <p>레벨이 오를 때마다 ${c.statPointsPerLevel}점을 받습니다(Lv${D.meta.maxLevel}까지 ${(D.meta.maxLevel - 1) * c.statPointsPerLevel}점). 스탯 창(C키)에서 분배하고, 초기화는 무료입니다.</p>
    ${table(['스탯', '1점당 효과'], effRows)}

    <h2>경험치</h2>
    <div class="formula">몬스터 경험치 = (10 + 6 × 몬스터 레벨) × (보스면 15)
내가 ${c.expPenaltyDiff[0]}레벨 이상 높으면 × 0.5, ${c.expPenaltyDiff[1]}레벨 이상 높으면 × 0.1</div>
    <ul class="plain">
      <li>처치에 기여한 사람과 반경 ${c.partyExpRadius} 안의 파티원이 <b>각자 전액</b>을 받습니다(나누지 않음).</li>
      <li>Lv${c.slowFrom}부터 기본 곡선에 곱하는 배율이 레벨마다 1.15배씩 늘며, 최대 ${c.slowCap}배에서 멈춥니다. Lv184부터는 기본 곡선의 성장만 이어집니다.</li>
      <li>HP는 교전이 끝나고 ${c.hpRegen.delaySec}초 뒤부터 초당 ${c.hpRegen.pctPerSec}%씩 찹니다. MP는 전투 밖 초당 ${c.mpRegenPct}%, 전투 중 ${c.mpRegenCombatPct}%, 처치할 때 ${c.mpOnKillPct}% 찹니다.</li>
    </ul>
    <div class="filters" style="margin-top:12px"><label class="f">레벨로 이동<input type="number" id="exp-jump" min="1" max="${D.meta.maxLevel}" value="${growthState.level}"></label></div>
    <div class="table-wrap scroll-y" id="exp-wrap"><table><thead><tr><th class="r">레벨</th><th class="r">다음 레벨까지</th><th class="r">누적 경험치</th><th class="r">같은 레벨 몬스터</th></tr></thead><tbody>
      ${D.expTable.map((e) => tr([R(e.level), R(e.toNext ? fmt(e.toNext) : '만렙'), R(fmt(e.total)), R(e.mobs ? `${fmt(e.mobs)}마리` : '—')], e.level === growthState.level ? 'hl' : '').replace('<tr', `<tr id="lv-${e.level}"`)).join('')}
    </tbody></table></div>

    <h2>강화</h2>
    <p>대장장이에게서 +${c.enhanceMax}까지 올립니다. <b>장비가 부서지지는 않습니다.</b> 목표가 +4 이하면 실패해도 그대로, +5 이상이면 한 단계 내려갑니다. 목표 +4부터는 그 장비 티어의 필드 재료도 듭니다.</p>
    <div class="filters"><label class="f">장비 티어(비용 기준)<select id="enh-tier">${D.awaken.tiers.map(({ tier: t }) => `<option value="${t}" ${t === growthState.tier ? 'selected' : ''}>티어 ${t}</option>`).join('')}</select></label></div>
    <div id="enh-table">${enhanceTable()}</div>
    <p class="muted small" style="margin-top:8px">기대값은 +0에서 시작해 그 단계에 처음 닿을 때까지의 평균입니다(실패로 내려간 뒤 다시 올리는 비용 포함). 비용은 티어 × 반올림(120 × (현재 단계 + 1)^1.7) 베리, 강화석은 단계와 상관없이 1개, 목표 +4~+6은 필드 재료 2개, +7부터 3개입니다.</p>

    <h2>각성</h2>
    <p>+${c.enhanceMax} 장비는 대장장이에게서 각성에 도전할 수 있습니다. 성공률은 ${D.awaken.rate}%에서 시작해 <b>실패할 때마다 그 장비의 성공률이 ${D.awaken.step}%씩 오릅니다</b>. 실패해도 강화 단계는 +${c.enhanceMax} 그대로입니다(재료·베리만 듭니다). 성공하면 칸 테두리가 붉게 빛나는 각성 장비가 되고 수치가 +${c.enhanceMax} 강화 배율의 ×${D.awaken.mul}이 됩니다. 각성 장비는 그대로 거래·경매장 등록이 됩니다.</p>
    ${table([{ t: '티어', c: 'r' }, '강화 재료(+4부터)', { t: '각성 베리', c: 'r' }, '각성 재료'], D.awaken.tiers.map((a) => tr([R(a.tier), itemLink(a.material), R(fmt(a.gold)), a.items.map((m) => `${itemLink(m.itemId)} ×${m.qty}`).join(', ')])))}`;
}
function enhanceTable() {
  const t = growthState.tier;
  let cumA = 0, cumG = 0, cumS = 0;
  const prev = { a: 0, g: 0, s: 0 };
  const rows = D.enhance.map((e) => {
    const p = e.rate / 100;
    const cost = e.goldPerTier * t;
    const drop = e.failTo < e.from;
    // 한 단계 올리는 기대 비용: 실패해 내려가면 아래 단계를 다시 올려야 한다
    const a = drop ? (1 + (1 - p) * prev.a) / p : 1 / p;
    const g = drop ? (cost + (1 - p) * prev.g) / p : cost / p;
    const s = drop ? (e.stones + (1 - p) * prev.s) / p : e.stones / p;
    prev.a = a; prev.g = g; prev.s = s;
    cumA += a; cumG += g; cumS += s;
    return tr([R(`+${e.from} → +${e.to}`), R(`${e.rate}%`), e.failTo === e.from ? '유지' : `<span style="color:var(--bad)">+${e.failTo}로 하락</span>`, R(fmt(cost)), R(e.stones), R(e.mats || '—'), R(fmt(Math.round(cumA * 10) / 10)), R(fmt(Math.round(cumG))), R(fmt(Math.round(cumS * 10) / 10))]);
  });
  return table([{ t: '단계', c: 'r' }, { t: '성공률', c: 'r' }, '실패하면', { t: '1회 베리', c: 'r' }, { t: '강화석', c: 'r' }, { t: '필드 재료', c: 'r' }, { t: '누적 기대 시도', c: 'r' }, { t: '누적 기대 베리', c: 'r' }, { t: '누적 기대 강화석', c: 'r' }], rows);
}
function bindGrowth() {
  document.getElementById('enh-tier').addEventListener('input', (e) => { growthState.tier = Number(e.target.value); document.getElementById('enh-table').innerHTML = enhanceTable(); });
  const jump = document.getElementById('exp-jump');
  jump.addEventListener('input', () => {
    const lv = Math.min(D.meta.maxLevel, Math.max(1, Math.floor(Number(jump.value) || 1)));
    document.querySelector('#exp-wrap tr.hl')?.classList.remove('hl');
    const row = document.getElementById(`lv-${lv}`);
    growthState.level = lv;
    if (!row) return;
    row.classList.add('hl');
    const wrap = document.getElementById('exp-wrap');
    wrap.scrollTop = row.offsetTop - wrap.clientHeight / 2;
  });
}

function notFound() {
  return `${head('찾을 수 없음')}<div class="empty-state">이 문서가 없습니다. <a href="#/">홈으로</a></div>`;
}

// ── 검색 ──
// 이름(초성 포함)·설명·문서 본문을 한 색인에서 찾는다. 공백·기호는 무시한다(예: "크라켄송곳니", "ㅋㄹㅋ", "불운보정").
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const FOLD_SKIP = /[\s·•,.()[\]'"‘’“”:/_~-]/;
/** 검색용으로 접는다: 공백·기호를 빼고 소문자로(cho면 한글 음절을 초성으로). idx[i] = 접은 i번째 글자의 원래 위치 */
function fold(s, cho = false) {
  let t = '';
  const idx = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (FOLD_SKIP.test(ch)) continue;
    const c = ch.charCodeAt(0);
    t += cho && c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch.toLowerCase();
    idx.push(i);
  }
  return { t, idx };
}
const isChoQuery = (t) => /^[ㄱ-ㅎ]+$/.test(t);
/** 접은 문자열에서 질의가 걸리는 원래 구간 [시작, 끝) */
function span(f, q) {
  const at = f.t.indexOf(q);
  return at < 0 ? null : [f.idx[at], f.idx[at + q.length - 1] + 1];
}
/** 이름 하나가 질의에 맞는지(목록 거르기용) */
function nameMatches(name, raw) {
  const q = fold(raw).t;
  return !q || fold(name, isChoQuery(q)).t.includes(q);
}
function hl(s, sp) {
  return sp ? `${esc(s.slice(0, sp[0]))}<mark>${esc(s.slice(sp[0], sp[1]))}</mark>${esc(s.slice(sp[1]))}` : esc(s);
}
function snippet(s, sp) {
  const a = Math.max(0, sp[0] - 28);
  const b = Math.min(s.length, sp[1] + 60);
  return `${a ? '…' : ''}${hl(s.slice(a, b), [sp[0] - a, sp[1] - a])}${b < s.length ? '…' : ''}`;
}

/** 페이지 본문을 h2 단위 절로 나눈다(카드 안 h2 제외). 절 제목에 id를 붙이고 [{id, title, text}]를 돌려준다 */
function sectionize(root) {
  const out = [{ id: '', title: '', text: '' }];
  let n = 0;
  for (const el of root.children) {
    if (el.tagName === 'H2') {
      el.id ||= `sec-${n}`;
      n++;
      out.push({ id: el.id, title: el.textContent.trim(), text: '' });
    } else if (!el.classList.contains('page-head') && !el.classList.contains('toc')) out[out.length - 1].text += textOf(el);
  }
  for (const s of out) s.text = s.text.replace(/\s+/g, ' ').trim();
  return out;
}
/** 표 칸·목록 항목 사이에 공백을 넣어 읽은 본문(textContent는 칸끼리 붙여 버린다) */
function textOf(root) {
  const w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let s = ' ';
  for (let n = w.currentNode; n; n = w.nextNode()) s += n.nodeType === Node.TEXT_NODE ? n.nodeValue : /^(TD|TH|LI|P|DIV|BR|TR|DT|DD|H3)$/.test(n.tagName) ? ' ' : '';
  return s;
}

const GROUPS = ['문서', '직업', '전직', '스킬', '아이템', '몬스터', '지역', '레이드', '퀘스트', 'NPC'];
let searchIndex = [];
function buildSearch() {
  const ph = (name) => `<span class="ico sm ph">${icon(name)}</span>`;
  const entries = [];
  const add = (group, name, href, kind, iconHtml, text = '', keys = '', cls = '') => entries.push({ group, name, href, kind, icon: iconHtml, text, cls, keys: fold(keys).t, nameF: fold(name), nameC: fold(name, true), textF: fold(text) });
  for (const [page, fn] of [['damage', pageDamage], ['drops', pageDrops], ['growth', pageGrowth], ['classes', pageClasses]]) {
    const body = new DOMParser().parseFromString(`<body>${fn()}</body>`, 'text/html').body;
    for (const s of sectionize(body)) add('문서', s.title || TITLES[page], s.id ? `#/${page}#${s.id}` : `#/${page}`, TITLES[page], ph('scroll-text'), s.text, TITLES[page]);
  }
  add('문서', TITLES.feedback, '#/feedback', '익명 의견 남기기', ph('message-square'), '버그 제보 건의 밸런스 의견 위키 오류', '피드백 게시판 건의 버그 제보 문의');
  for (const c of D.classes) add('직업', c.name, `#/classes/${c.id}`, `직업 · ${c.role}`, c.icon ? `<img class="ico sm" src="${esc(c.icon)}" alt="">` : ph('shield'), '', '직업');
  for (const b of D.branches) add('전직', b.name, `#/classes/${b.classId}#br-${b.id}`, `${classOf(b.classId).name} 전직`, ph('git-branch'), b.concept, `${classOf(b.classId).name}전직`);
  for (const b of D.branches) add('전직', b.second.name, `#/classes/${b.classId}#br2-${b.id}`, `${b.name} 2차 전직`, ph('git-branch'), b.second.concept, `${classOf(b.classId).name}${b.name}2차전직`);
  const skillOwner = (s) => (s.branchId ? `·${s.second ? M.branches.get(s.branchId).second.name : M.branches.get(s.branchId).name}` : '');
  for (const s of D.skills) add('스킬', s.name, `#/skills/${s.id}`, `${classOf(s.classId).name}${skillOwner(s)} 스킬`, skillIcon(s, 'sm'), [s.desc, ...s.lines].join(' · '), `${classOf(s.classId).name}${skillOwner(s).slice(1)}스킬`);
  for (const it of D.items) add('아이템', it.name, `#/items/${it.id}`, `${rarName(it.rarity)} ${KIND[it.kind]}${it.reqLevel ? ` · Lv${it.reqLevel}` : ''}`, itemIcon(it, 'sm'), it.desc, `${rarName(it.rarity)}${KIND[it.kind]}${it.classId ? classOf(it.classId).name : '공용'}`, `rar-${it.rarity}`);
  for (const m of D.mobs) add('몬스터', m.name, `#/mobs/${m.id}`, `${MOB_KIND[m.kind]} · Lv${m.level}`, ph(m.kind === 'field' ? 'skull' : 'crown'), m.islands.map(islandName).join(', '), `${MOB_KIND[m.kind]}몬스터`);
  for (const i of D.islands) {
    add('지역', i.name, `#/world#isl-${i.id}`, `섬 · Lv${i.levelRange[0]}~${i.levelRange[1]}`, ph('map'), '', '섬지역');
    for (const n of i.npcs) add('NPC', n.name, `#/world#isl-${i.id}`, `${i.name} · ${ROLE[n.role] ?? n.role}`, ph('info'), '', `npc${ROLE[n.role] ?? ''}`);
    for (const qid of i.quests) {
      const q = M.quests.get(qid);
      if (q) add('퀘스트', q.name, `#/world#isl-${i.id}`, `${i.name} 퀘스트 · Lv${q.minLevel}`, ph('scroll-text'), '', '퀘스트');
    }
  }
  for (const r of D.raids) add('레이드', r.name, `#/world#raid-${r.id}`, `레이드 · 입장 Lv${r.minLevel}`, ph('crown'), r.phases.map((p) => p.label).join(' · '), '레이드');
  add('레이드', D.infinite.name, `#/world#raid-${D.infinite.id}`, `웨이브 던전 · 입장 Lv${D.infinite.minLevel} · 혼자~${D.infinite.size}인`, ph('crown'), '무한 웨이브 랭킹 서버 최초 유니크', '레이드');
  add('레이드', D.augment.name, `#/world#raid-${D.augment.id}`, `웨이브 던전 베타 · ${D.augment.every}웨이브마다 증강 카드`, ph('crown'), D.augment.list.map((a) => `${a.name} ${a.desc}`).join(' · '), '레이드 증강 베타 카드');
  for (const w of D.worldBosses) add('레이드', w.name, `#/world#wb-${w.id}`, `필드 보스 원정 · ${M.mobs.get(w.bossId)?.name ?? ''}`, ph('crown'), w.phases.map((p) => p.label).join(' · '), '필드보스 월드보스 원정');
  searchIndex = entries;
}
/** 점수 높은 순 [{e, name, snip}] — 이름 > 분류어 > 본문 */
function search(raw) {
  const q = fold(raw).t;
  if (!q) return [];
  const cho = isChoQuery(q);
  const terms = raw.trim().split(/\s+/).map((w) => fold(w).t).filter(Boolean);
  const hits = [];
  for (const e of searchIndex) {
    const f = cho ? e.nameC : e.nameF;
    const sp = span(f, q);
    let score;
    let snip = null;
    if (sp) score = (f.t === q ? 100 : f.t.startsWith(q) ? 80 : 60) - (cho ? 5 : 0);
    else if (cho) continue;
    else if (e.keys.includes(q)) score = 30;
    else if (q.length >= 2 && (snip = span(e.textF, q))) score = 20;
    else if (terms.length > 1 && terms.every((t) => e.nameF.t.includes(t) || e.keys.includes(t) || e.textF.t.includes(t))) {
      // 띄어 쓴 낱말이 모두 들어 있으면(순서·붙어 있음 무관) 가장 낮은 점수로 잡는다
      score = 10;
      snip = terms.map((t) => span(e.textF, t)).find(Boolean) ?? null;
    }
    else continue;
    hits.push({ e, name: sp, snip, score });
  }
  return hits.sort((a, b) => b.score - a.score || GROUPS.indexOf(a.e.group) - GROUPS.indexOf(b.e.group) || a.e.name.length - b.e.name.length);
}
function hitBody(h) {
  return `${h.e.icon}<span class="sr-main"><span class="nm ${h.e.cls}">${hl(h.e.name, h.name)}</span>${h.snip ? `<span class="snip">${snippet(h.e.text, h.snip)}</span>` : ''}</span><span class="kind">${esc(h.e.kind)}</span>`;
}
const searchHref = (q) => `#/search/${encodeURIComponent(q.trim())}`;

/** 검색창 하나(상단·홈)에 자동완성 목록을 붙인다 */
function attachSearch(input, box) {
  let sel = -1;
  let links = [];
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); sel = -1; };
  const paint = () => {
    links.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel)));
    if (sel >= 0) input.setAttribute('aria-activedescendant', links[sel].id);
  };
  const go = (href) => { location.hash = href; input.value = ''; close(); input.blur(); };
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) return close();
    const hits = search(q);
    box.innerHTML = hits.length
      ? `${hits.slice(0, 8).map((h, i) => `<a role="option" id="${box.id}-${i}" href="${h.e.href}">${hitBody(h)}</a>`).join('')}<a role="option" id="${box.id}-all" class="more" href="${searchHref(q)}">${icon('search')}<span class="sr-main"><span class="nm">‘${esc(q)}’ 전체 결과 보기</span></span><span class="kind">${hits.length}개</span></a>`
      : `<div class="empty">‘${esc(q)}’에 맞는 결과가 없습니다. 초성(예: ㅋㄹㅋ)이나 다른 낱말로 찾아보세요.</div>`;
    links = [...box.querySelectorAll('a')];
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    sel = links.length ? 0 : -1;
    paint();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (box.hidden || !links.length) return;
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      paint();
      links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!box.hidden && sel >= 0) go(links[sel].getAttribute('href'));
      else if (input.value.trim()) go(searchHref(input.value));
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });
  box.addEventListener('click', (e) => { if (e.target.closest('a')) { input.value = ''; close(); } });
}
function initSearch() {
  const input = document.getElementById('q');
  attachSearch(input, document.getElementById('q-results'));
  // 검색창 밖을 누르면 열린 자동완성 목록을 닫는다(홈 검색창도 같은 규칙)
  document.addEventListener('click', (e) => {
    for (const box of document.querySelectorAll('.search-results:not([hidden])')) {
      if (box.parentElement.contains(e.target)) continue;
      box.hidden = true;
      box.parentElement.querySelector('input')?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      (document.getElementById('hq') ?? input).focus();
    }
  });
}

// ── 페이지: 검색 결과 ──
const searchState = { group: 'all' };
function pageSearch(q) {
  return `
    ${head('검색')}
    <div class="search big" role="search">${icon('search')}<input id="sq" type="search" value="${esc(q ?? '')}" placeholder="아이템·스킬·몬스터·공식을 찾아보세요 (초성도 됩니다)" autocomplete="off" spellcheck="false" aria-label="위키 검색"></div>
    <div class="filters" id="sr-groups"></div>
    <div id="sr-list"></div>`;
}
function renderSearch() {
  const q = document.getElementById('sq').value;
  const hits = search(q);
  const counts = new Map();
  for (const h of hits) counts.set(h.e.group, (counts.get(h.e.group) ?? 0) + 1);
  if (searchState.group !== 'all' && !counts.has(searchState.group)) searchState.group = 'all';
  const shown = searchState.group === 'all' ? hits : hits.filter((h) => h.e.group === searchState.group);
  document.getElementById('sr-groups').innerHTML = hits.length
    ? `<div class="seg" role="group" aria-label="분류"><button type="button" data-g="all" aria-pressed="${searchState.group === 'all'}">전체<span class="n">${hits.length}</span></button>${GROUPS.filter((g) => counts.has(g)).map((g) => `<button type="button" data-g="${g}" aria-pressed="${searchState.group === g}">${g}<span class="n">${counts.get(g)}</span></button>`).join('')}</div>`
    : '';
  document.getElementById('sr-list').innerHTML = !fold(q).t
    ? '<div class="empty-state">찾을 낱말을 입력하세요. 예: 크라켄, 불운 보정, 강화 확률, ㅎㄱㅅ</div>'
    : shown.length
      ? `<ul class="sr-list">${shown.slice(0, 200).map((h) => `<li><a class="sr-row" href="${h.e.href}">${hitBody(h)}</a></li>`).join('')}</ul>`
      : `<div class="empty-state">‘${esc(q)}’에 맞는 결과가 없습니다.</div>`;
}
function bindSearch() {
  const input = document.getElementById('sq');
  input.addEventListener('input', () => {
    history.replaceState(null, '', input.value.trim() ? searchHref(input.value) : '#/search');
    lastPath = `search/${input.value.trim()}`;
    renderSearch();
  });
  document.getElementById('sr-groups').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-g]');
    if (!b) return;
    searchState.group = b.dataset.g;
    renderSearch();
  });
  renderSearch();
  if (!input.value) input.focus();
}

// ── 피드백 게시판(서버 server/wiki/feedback.ts · 계약 shared/protocol/feedback.ts) ──
// 로그인 없이 익명으로 쓴다. 글을 올리면 서버가 준 열쇠를 이 브라우저(localStorage)에 두고, 그 열쇠가 있는 글만 지울 수 있다.
const FB_CATS = ['건의', '버그', '밸런스', '위키', '기타'];
const FB_BODY_MIN = 5;
const FB_BODY_MAX = 1000;
const FB_NICK_MAX = 12;
const FB_KEYS = 'wikiFeedbackKeys';
const FB_NICK = 'wikiFeedbackNick';
const FB_ERR = {
  bad_cat: '분류를 골라 주세요.',
  bad_body: `내용은 ${FB_BODY_MIN}~${FB_BODY_MAX}자로 써 주세요.`,
  bad_nick: `닉네임은 ${FB_NICK_MAX}자까지, 운영자처럼 보이는 이름은 쓸 수 없어요.`,
  too_many_links: '링크는 2개까지만 넣을 수 있어요.',
  too_many: '한 시간에 쓸 수 있는 글을 모두 썼어요. 조금 뒤에 다시 써 주세요.',
  board_full: '오늘 올라온 글이 너무 많아 잠시 닫았어요. 나중에 다시 써 주세요.',
  not_found: '이미 지워진 글이에요.',
  bad_key: '이 브라우저에서 쓴 글만 지울 수 있어요.',
};
const fb = { draft: '건의', cat: 'all', posts: [], more: false, status: 'loading', from: '', seq: 0 };

/** 게시판 서버 = 게임 서버. 로컬 미리보기만 ?api=http://127.0.0.1:포트 로 바꿀 수 있다 */
function fbBase() {
  const o = new URLSearchParams(location.search).get('api');
  return (o && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o) ? o : D.meta.gameUrl).replace(/\/$/, '');
}
function fbKeys() {
  try {
    const v = JSON.parse(localStorage.getItem(FB_KEYS) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function fbSetKey(id, key) {
  const keys = fbKeys();
  if (key) keys[id] = key;
  else delete keys[id];
  try { localStorage.setItem(FB_KEYS, JSON.stringify(keys)); } catch { /* 저장 공간이 없으면 지우기만 못 한다 */ }
}
/** 게시판 API 호출. 실패하면 Error{status(0 = 서버에 닿지 않음), code, retryAfter} */
async function fbFetch(path, body) {
  let res;
  try {
    res = await fetch(`${fbBase()}/wiki/feedback${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error('network'), { status: 0 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw Object.assign(new Error(data?.error ?? `HTTP ${res.status}`), { status: res.status, code: data?.error, retryAfter: data?.retryAfter });
  return data;
}
function fbErrText(err) {
  if (!err.status) return '게시판 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  if (err.code === 'too_fast') return `글은 조금씩 간격을 두고 올릴 수 있어요. ${err.retryAfter ?? 20}초 뒤에 다시 올려 주세요.`;
  return FB_ERR[err.code] ?? `처리하지 못했어요(HTTP ${err.status}). 잠시 뒤 다시 시도해 주세요.`;
}
/** 해시 경로 → 사람이 읽는 페이지 이름('아이템 도감 · 낡은 검') */
function pageLabel(hash) {
  let page = '';
  let id;
  try {
    [page = '', id] = hash.replace(/^#\/?/, '').split('#')[0].split('/').map(decodeURIComponent);
  } catch {
    return hash;
  }
  const name = id && (page === 'search' ? `‘${id}’` : M[page]?.get(id)?.name ?? id);
  return `${TITLES[page] ?? page}${name ? ` · ${name}` : ''}`;
}
function fbTime(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(at);
  return d.getFullYear() === new Date().getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : d.toLocaleDateString('ko-KR');
}
function fbPost(p, mine) {
  const at = new Date(p.at);
  return `<li class="fb-post" id="fb-${p.id}">
    <div class="fb-meta"><span class="chip${p.cat === '버그' ? ' bad' : ''}">${esc(p.cat)}</span><b>${esc(p.nick)}</b><time class="muted" datetime="${at.toISOString()}" title="${esc(at.toLocaleString('ko-KR'))}">${fbTime(p.at)}</time>${mine ? `<button type="button" class="icon-btn fb-del" data-del="${p.id}" aria-label="내 글 지우기">${icon('trash-2')}</button>` : ''}</div>
    <p class="fb-body">${esc(p.body)}</p>
    ${p.page?.startsWith('#/') ? `<a class="fb-page" href="${esc(p.page)}">${icon('scroll-text')}${esc(pageLabel(p.page))}</a>` : ''}
  </li>`;
}
function renderFbList() {
  const box = document.getElementById('fb-list');
  if (!box) return;
  if (fb.status === 'loading') box.innerHTML = '<p class="loading">불러오는 중…</p>';
  else if (fb.status === 'error') box.innerHTML = `<div class="empty-state">${fbErrText(fb.err)}<div class="fb-more"><button type="button" class="pill-btn" data-act="retry">${icon('rotate-cw')}다시 불러오기</button></div></div>`;
  else if (!fb.posts.length) box.innerHTML = `<div class="empty-state">${fb.cat === 'all' ? '아직 글이 없어요. 첫 의견을 남겨 주세요.' : `‘${esc(fb.cat)}’ 글이 아직 없어요.`}</div>`;
  else {
    const keys = fbKeys();
    box.innerHTML = `<ol class="fb-list">${fb.posts.map((p) => fbPost(p, Boolean(keys[p.id]))).join('')}</ol>${fb.more ? `<div class="fb-more"><button type="button" class="pill-btn" data-act="more">${icon('chevron-down')}더 보기</button></div>` : ''}`;
  }
}
/** 목록을 처음부터(append면 마지막 글 다음부터) 불러온다. 늦게 온 옛 응답은 버린다 */
async function fbLoad(append = false) {
  const seq = ++fb.seq;
  const q = new URLSearchParams();
  if (fb.cat !== 'all') q.set('cat', fb.cat);
  if (append && fb.posts.length) q.set('before', fb.posts.at(-1).id);
  if (!append) {
    fb.status = 'loading';
    renderFbList();
  }
  try {
    const r = await fbFetch(q.size ? `?${q}` : '');
    if (seq !== fb.seq) return;
    fb.posts = append ? fb.posts.concat(r.posts) : r.posts;
    fb.more = r.more;
    fb.status = 'ready';
  } catch (err) {
    if (seq !== fb.seq) return;
    fb.err = err;
    fb.status = 'error';
  }
  renderFbList();
}
function pageFeedback() {
  const seg = (id, label, list, cur) => `<div class="seg" role="group" aria-label="${label}" id="${id}">${list.map(([v, n]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === cur}">${esc(n)}</button>`).join('')}</div>`;
  let nick = '';
  try { nick = localStorage.getItem(FB_NICK) ?? ''; } catch { /* 저장소를 못 쓰면 비운다 */ }
  return `
    ${head('피드백 게시판', '로그인 없이 익명으로 의견을 남기는 곳이에요. 버그 제보, 건의, 밸런스 의견, 위키 오류 모두 좋아요.')}
    <form class="card fb-form" id="fb-form" novalidate>
      ${seg('fb-cat', '글 분류', FB_CATS.map((c) => [c, c]), fb.draft)}
      <textarea id="fb-body" class="field" rows="5" maxlength="${FB_BODY_MAX}" aria-label="내용" placeholder="어떤 점이 불편했나요? 버그라면 언제·어디서·무엇을 했는지 적어 주면 고치기 쉬워요."></textarea>
      <div class="fb-row">
        <input id="fb-nick" class="field" type="text" maxlength="${FB_NICK_MAX}" placeholder="닉네임 (비우면 익명)" aria-label="닉네임" autocomplete="off" value="${esc(nick)}">
        ${fb.from ? `<span class="chip" id="fb-from" title="글에 붙는 보던 페이지">${icon('scroll-text')}${esc(pageLabel(fb.from))}<button type="button" aria-label="보던 페이지 연결 빼기">${icon('x')}</button></span>` : ''}
        <span class="count" id="fb-count">0 / ${FB_BODY_MAX}</span>
        <button class="btn-primary" type="submit" id="fb-send">${icon('send')}<span>올리기</span></button>
      </div>
      <div class="fb-hp" aria-hidden="true"><label>웹사이트 <input id="fb-hp" type="text" tabindex="-1" autocomplete="off"></label></div>
      <p class="fb-msg" id="fb-msg" role="status" aria-live="polite"></p>
    </form>
    <p class="muted small fb-rules">연락처·계정 비밀번호 같은 개인정보는 쓰지 마세요. 욕설·광고·도배 글은 운영자가 숨겨요. 이 브라우저에서 쓴 글은 직접 지울 수 있어요.</p>
    <div class="filters">
      ${seg('fb-filter', '분류로 거르기', [['all', '전체'], ...FB_CATS.map((c) => [c, c])], fb.cat)}
      <button type="button" class="icon-btn" id="fb-reload" aria-label="목록 새로고침">${icon('rotate-cw')}</button>
    </div>
    <div id="fb-list"></div>`;
}
function bindFeedback() {
  const form = document.getElementById('fb-form');
  const body = document.getElementById('fb-body');
  const nick = document.getElementById('fb-nick');
  const count = document.getElementById('fb-count');
  const send = document.getElementById('fb-send');
  const msg = document.getElementById('fb-msg');
  const say = (text, bad = false) => {
    msg.textContent = text;
    msg.classList.toggle('bad', bad);
  };
  const pick = (seg, v) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  document.getElementById('fb-cat').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    fb.draft = b.dataset.v;
    pick(e.currentTarget, fb.draft);
  });
  document.getElementById('fb-from')?.querySelector('button').addEventListener('click', (e) => {
    fb.from = '';
    e.currentTarget.closest('.chip').remove();
    body.focus();
  });
  body.addEventListener('input', () => {
    count.textContent = `${body.value.trim().length} / ${FB_BODY_MAX}`;
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = body.value.trim();
    if (text.length < FB_BODY_MIN) {
      say(`내용을 ${FB_BODY_MIN}자 이상 써 주세요.`, true);
      body.focus();
      return;
    }
    send.disabled = true;
    say('올리는 중…');
    try {
      const r = await fbFetch('', { cat: fb.draft, body: text, nick: nick.value.trim(), page: fb.from, hp: document.getElementById('fb-hp').value });
      fbSetKey(r.post.id, r.key);
      try { localStorage.setItem(FB_NICK, nick.value.trim()); } catch { /* 닉네임 기억은 선택 */ }
      body.value = '';
      count.textContent = `0 / ${FB_BODY_MAX}`;
      say('올렸어요. 의견 고마워요!');
      if (fb.cat === 'all' || fb.cat === r.post.cat) {
        fb.posts.unshift(r.post);
        fb.status = 'ready';
        renderFbList();
      }
    } catch (err) {
      say(fbErrText(err), true);
    } finally {
      send.disabled = false;
    }
  });
  document.getElementById('fb-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === fb.cat) return;
    fb.cat = b.dataset.v;
    pick(e.currentTarget, fb.cat);
    fbLoad();
  });
  document.getElementById('fb-reload').addEventListener('click', () => fbLoad());
  document.getElementById('fb-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'retry') return fbLoad();
    if (b.dataset.act === 'more') {
      b.disabled = true;
      return fbLoad(true);
    }
    const id = Number(b.dataset.del);
    const key = fbKeys()[id];
    if (!id || !key || !confirm('이 글을 지울까요? 되돌릴 수 없어요.')) return;
    b.disabled = true;
    try {
      await fbFetch('/delete', { id, key });
      fbSetKey(id, null);
      fb.posts = fb.posts.filter((p) => p.id !== id);
      renderFbList();
      say('글을 지웠어요.');
    } catch (err) {
      if (err.code === 'not_found') {
        fbSetKey(id, null);
        fb.posts = fb.posts.filter((p) => p.id !== id);
        renderFbList();
      } else b.disabled = false;
      say(fbErrText(err), true);
    }
  });
  fbLoad();
}

// ── 메뉴(모바일) ──
function initNav() {
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  const scrim = document.querySelector('.scrim');
  const set = (open) => {
    nav.classList.toggle('open', open);
    scrim.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  scrim.addEventListener('click', () => set(false));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
}

// ── 라우터 ──
// 해시 형식: #/<페이지>[/<id>][#<앵커>]
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, anchor] = raw.split('#');
  const [page = '', id] = path.split('/').map(decodeURIComponent);
  return { page, id, anchor: anchor && decodeURIComponent(anchor) };
}
const TITLES = { '': '홈', damage: '데미지 공식', drops: '드랍률', classes: '직업·전직', skills: '스킬 도감', items: '아이템 도감', mobs: '몬스터 도감', world: '지역·레이드', growth: '성장·강화', search: '검색', feedback: '피드백 게시판' };
let lastPath = null;
/** 바로 전에 보던 해시(피드백 글에 '보던 페이지'로 붙인다) */
let lastHash = '';
function render() {
  const { page, id, anchor } = parseHash();
  const path = `${page}/${id ?? ''}`;
  let html;
  let after = () => {};
  let title = TITLES[page];
  switch (page) {
    case '': html = pageHome(); after = () => attachSearch(document.getElementById('hq'), document.getElementById('hq-results')); break;
    case 'search': html = pageSearch(id); after = bindSearch; title = id ? `‘${id}’ 검색` : '검색'; break;
    case 'damage': html = pageDamage(); after = bindCalc; break;
    case 'drops': html = pageDrops(); break;
    case 'classes': html = id ? pageClass(id) : pageClasses(); if (id) title = classOf(id)?.name; break;
    case 'skills': html = pageSkills(id); after = () => bindSkills(id); if (id) title = M.skills.get(id)?.name; break;
    case 'items': html = id ? pageItem(id) : pageItems(); if (!id) after = bindItems; else title = M.items.get(id)?.name; break;
    case 'mobs': html = id ? pageMob(id) : pageMobs(); if (!id) after = bindMobs; else title = M.mobs.get(id)?.name; break;
    case 'world': html = pageWorld(); break;
    case 'growth': html = pageGrowth(); after = bindGrowth; break;
    case 'feedback':
      // 다른 문서에서 넘어왔으면 그 페이지를 글에 붙일 후보로 둔다(홈·검색 제외)
      if (!lastPath?.startsWith('feedback/')) fb.from = /^#\/(?!$|feedback|search)/.test(lastHash) ? lastHash : '';
      html = pageFeedback();
      after = bindFeedback;
      break;
    default: html = notFound(); title = '찾을 수 없음';
  }
  main.innerHTML = html;
  after();
  // 절이 3개 이상인 문서 페이지는 머리 아래에 절 바로가기를 단다(검색의 문서 결과도 같은 id로 연결된다)
  if (!id && page !== 'search') {
    const secs = sectionize(main).filter((s) => s.id);
    if (secs.length >= 3) main.querySelector('.page-head')?.insertAdjacentHTML('afterend', `<nav class="toc" aria-label="이 페이지 목차">${secs.map((s) => `<a href="#/${page}#${s.id}">${esc(s.title)}</a>`).join('')}</nav>`);
  }
  document.title = `${title ? `${title} · ` : ''}${D.meta.title}`;
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.route === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (anchor) document.getElementById(anchor)?.scrollIntoView();
  else if (path !== lastPath && !(page === 'skills' && id)) window.scrollTo(0, 0);
  if (path !== lastPath && page !== 'search') main.focus({ preventScroll: true });
  lastPath = path;
  lastHash = location.hash;
}

async function start() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    D = await res.json();
  } catch (err) {
    main.innerHTML = `<p class="error">데이터를 불러오지 못했습니다(${esc(err.message)}). 새로고침해 주세요.</p>`;
    return;
  }
  for (const k of ['items', 'skills', 'mobs', 'classes', 'branches', 'islands', 'raids', 'worldBosses', 'quests']) M[k] = new Map(D[k].map((x) => [x.id, x]));
  M.wbIsland = new Map(D.worldBosses.map((w) => [w.islandId, w]));
  document.getElementById('play').href = D.meta.gameUrl;
  const built = new Date(D.meta.builtAt);
  document.getElementById('build-info').textContent = `실서버 게임 데이터(${D.meta.commit}) 기준 · ${built.toLocaleDateString('ko-KR')} 갱신`;
  resetCalcFor('knight');
  buildSearch();
  initSearch();
  initNav();
  window.addEventListener('hashchange', render);
  render();
}
start();
