// 페이븐 위키 화면. data.json(tools/wiki/build.ts가 게임 데이터에서 만든다)만 읽어 해시 라우팅으로 그린다.

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

const KIND = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발', accessory: '목걸이', ring: '반지', potion: '회복 물약', mp_potion: '마나 물약', scroll: '두루마리', material: '재료', box: '상자', ticket: '이용권', boost: '부스트' };
const EQUIP = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'accessory', 'ring'];
const ROLE = { chief: '촌장(전직)', quest: '퀘스트', shop: '상인', smith: '대장장이(강화)', sailor: '뱃사공(이동)', raid: '선술집(레이드·던전·원정)', gem: '젬 상인', storage: '창고', flavor: '주민' };
const MOB_KIND = { field: '일반', elite: '정예', boss: '필드 보스', raid: '레이드 보스', raidAdd: '레이드 소환수', worldBoss: '원정 필드 보스', worldBossAdd: '원정 소환수' };
const PASSIVE = { patkPct: ['물리 공격력', '%'], matkPct: ['마법 공격력', '%'], maxHpPct: ['최대 HP', '%'], maxMpPct: ['최대 MP', '%'], critPct: ['치명타 확률', '%p'] };
const DMG = { phys: '물리', magic: '마법' };
const RARITIES = ['common', 'rare', 'saga', 'epic', 'legendary', 'unique', 'absolute'];

let D; // data.json
const M = {}; // id → 정의

function rarName(r) { return D.constants.rarityName[r] ?? r; }
/** 퀘스트 장비 보상 한 줄: "직업 무기(희귀, 내 레벨 티어 · 귀속)" — 티어는 완료할 때 내 레벨로 정해진다 */
function questGearText(g) { return `${g.part === 'weapon' ? '직업 무기' : esc(KIND[g.part] ?? g.part)}(${esc(rarName(g.rarity))}, 내 레벨 티어 · 귀속)`; }
/** 반복 보상(웨이브·필드 보스) 경험치 문구: 한 레벨 몫의 비율. 한 레벨 몫은 Lv rewardLevelFrom 위로 그 레벨의 같은 레벨 몬스터 수로 고정된다 */
function levelShare(ratio) {
  const L = D.constants.rewardLevelFrom;
  return `현재 레벨 필요 경험치의 ${ratio} — Lv${L} 위로는 Lv${L} 기준(같은 레벨 몬스터 수)으로 고정`;
}
/** 성장 보너스 한 줄(레이드 클리어·필드 보스 원정): 기본 경험치와 따로 현재 레벨 필요 경험치의 share, 하루 perDay번, 기준 레벨보다 높으면 깎임 */
function growthLine(g, base, scope) {
  return `<li><b>성장 보너스</b>: 위 경험치와 따로 <b>현재 레벨 필요 경험치의 ${pct(g.share)}</b>를 더 받습니다(Lv${D.constants.rewardLevelFrom} 위에서도 고정되지 않음). 캐릭터마다 <b>하루 ${g.perDay}번</b>(한국 시간 자정에 다시 채워짐, ${scope}) · ${base}보다 ${D.constants.expPenaltyDiff[0]}레벨 이상 높으면 ${pct(g.minMul)}(더 깎이지 않음) · 경험치 이벤트·사료·월정액 경험치 배율은 붙지 않습니다.</li>`;
}
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
const islandName = (id) => M.islands.get(id)?.name ?? M.raids.get(id)?.name ?? M.wbIsland.get(id)?.name ?? M.dungeons.get(id)?.name ?? (id === D.infinite.id ? D.infinite.name : id);
const islandLink = (id) => (M.islands.has(id) ? `<a href="#/world#isl-${esc(id)}">${esc(islandName(id))}</a>` : M.raids.has(id) || id === D.infinite.id ? `<a href="#/world#raid-${esc(id)}">${esc(islandName(id))}</a>` : M.dungeons.has(id) ? `<a href="#/world#dungeons">${esc(islandName(id))}</a>` : M.wbIsland.has(id) ? `<a href="#/world#wb-${esc(M.wbIsland.get(id).id)}">${esc(islandName(id))}</a>` : esc(id));
/** 모항(노을마을) 젬 NPC 이름: gem = 젬 상인, storage = 창고지기 */
const npcNameOfRole = (role) => D.npcNames?.[role === 'gem' ? 'vg_gem' : 'vg_storage'] ?? (role === 'gem' ? '젬 상인' : '창고지기');
const RUBY_NOTE = '루비는 계정 공용 재화로 상점에서 씁니다. 일반·정예 몬스터와 월정액 추가·면제 회차에서는 나오지 않습니다. 드랍 이벤트 배율이 붙지 않습니다.';
/** 루비 드랍 한 줄: "루비 N% (a~b개)" */
function rubyLine(source) {
  const r = D.ruby.drops.find((d) => d.source === source);
  return `<b>루비</b> ${pct(r.chance)} (${r.qty[0]}~${r.qty[1]}개) — 참가자마다 따로, 계정 공용 재화`;
}
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
function damage(atk, coef, roll) {
  return Math.max(1, Math.round(atk * coef * (0.9 + roll * 0.2)));
}
/** 편차 0.9~1.1 균등 분포에서 반올림한 피해의 평균 */
function avgDamage(atk, coef) {
  let sum = 0;
  const N = 200;
  for (let i = 0; i <= N; i++) sum += damage(atk, coef, i / N);
  return sum / (N + 1);
}
/** 장비 1점 수치(server/systems/items/equip.ts gearStats). enh = 강화 단계, enhanceMax + 1 = 각성(+최대 배율 × 각성 배율) */
function gearStats(it, enh, rarity = it.rarity) {
  const per = D.constants.enhanceBonusPer[it.kind] ?? 0;
  const max = D.constants.enhanceMax;
  const mul = (it.mul?.[rarity] ?? D.constants.rarityMul[rarity]) * (enh > max ? (1 + per * max) * D.awaken.mul : 1 + per * enh);
  return { atk: Math.round(it.atk * mul), hp: Math.round(it.hp * mul) };
}
/** 레벨·장비·전직으로 능력치(GameServer.recomputeStats와 같은 순서: 직업 기본 + 레벨 성장(HP·공격력·MP) → 장비 합 + 올스탯 → 전직 패시브(1차 + 2차 + 3차 합산) → 직업 계수 classMul(공격력·HP 전체)) */
function playerStats(cls, level, gear, branch, second = false, third = false) {
  const ae = D.constants.allStatEffect;
  const grown = Math.max(0, level - 1);
  const baseAtk = Math.round(cls.baseAtk + cls.atkPerLevel * grown);
  const s = { patk: baseAtk, matk: baseAtk, maxHp: Math.round(cls.baseHp + cls.hpPerLevel * grown), maxMp: Math.round(cls.baseMp + cls.mpPerLevel * grown) };
  let gearAtk = 0, gearHp = 0;
  for (const g of gear) {
    const st = gearStats(g.item, g.enh);
    gearAtk += st.atk;
    gearHp += st.hp;
    const all = g.item.allStat ?? 0;
    s.patk += ae.atk * all;
    s.matk += ae.atk * all;
    s.maxHp += ae.maxHp * all;
    s.maxMp += ae.maxMp * all;
  }
  s.maxHp += gearHp;
  const p = { ...(branch?.passive ?? {}) };
  if (second && branch) for (const [k, v] of Object.entries(branch.second.passive)) p[k] = (p[k] ?? 0) + v;
  if (third && branch?.third) for (const [k, v] of Object.entries(branch.third.passive)) p[k] = (p[k] ?? 0) + v;
  if (p.patkPct) s.patk *= 1 + p.patkPct / 100;
  if (p.matkPct) s.matk *= 1 + p.matkPct / 100;
  if (p.maxHpPct) s.maxHp = Math.round(s.maxHp * (1 + p.maxHpPct / 100));
  if (p.maxMpPct) s.maxMp *= 1 + p.maxMpPct / 100;
  const m = cls.classMul;
  const patk = Math.round((s.patk + gearAtk) * m.atk);
  const matk = Math.round((s.matk + gearAtk) * m.atk);
  return { patk, matk, atk: cls.dmgType === 'magic' ? matk : patk, maxHp: Math.round(s.maxHp * m.hp), maxMp: Math.max(0, Math.round(s.maxMp)), crit: cls.critPct + (p.critPct ?? 0), gearAtk: Math.round(gearAtk) };
}
/** 슬롯 1~4 스킬(shared/data/branches.ts skillsFor). 2차 전직이면 네 칸 모두 2차 스킬, 3차 전직이면 네 칸 모두 3차 스킬. 슬롯 5 궁극기는 branch.third.ult */
function skillsFor(cls, branch, awakened, second = false, third = false) {
  if (!branch) return cls.skills;
  if (second && third && branch.third) return branch.third.skills;
  if (second) return branch.second.skills;
  return [branch.skill1 ?? cls.skills[0], branch.skills[0], branch.skills[1], awakened ? branch.awaken : branch.skills[2]];
}

/** 상점·출석·패스 보상 한 줄: 아이템 ×수량 · 꾸미기 · 베리 · 젬 */
function rewardText(r) {
  if (r.cosmeticId) return `꾸미기 <a href="#/drops#cosmetics">${esc(D.cosmetics.list.find((c) => c.id === r.cosmeticId)?.name ?? r.cosmeticId)}</a>`;
  if (r.gold !== undefined) return `${fmt(r.gold)} 베리`;
  if (r.gems !== undefined) return `${esc(D.gems.name)} ${fmt(r.gems)}개`;
  return `${itemLink(r.itemId)} ×${fmt(r.qty)}${r.bound ? ' <span class="muted small">귀속</span>' : ''}`;
}
/** 한국 시간 오늘 'YYYY-MM-DD' */
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
/** 'YYYY-MM-DD' → '10/4' */
const monthDay = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// ── 페이지: 홈 ──
function pageHome() {
  const c = D.constants;
  const tiles = [
    ['damage', 'calculator', '#6ea8ff', '데미지 공식', '피해식과 직접 넣어 보는 계산기'],
    ['drops', 'dices', '#ffb547', '드랍률', '등급 · 티어 장비 · 레이드 세트 · 합성 · 루비 상점 · 출석'],
    ['classes', 'git-branch', '#c29bff', '직업·전직', `직업 ${D.classes.length}개 · 전직 ${D.branches.length}갈래 · 각성`],
    ['skills', 'sparkles', '#3fd08a', '스킬 도감', `스킬 ${D.skills.length}개 · 계수 · 쿨다운`],
    ['items', 'backpack', '#ff8a4c', '아이템 도감', `아이템 ${D.items.length}개 · 얻는 곳`],
    ['mobs', 'skull', '#ff6b6b', '몬스터 도감', `몬스터 ${D.mobs.length}종 · 드랍표`],
    ['world', 'map', '#2dd4bf', '지역·레이드', `지역 ${D.islands.length}곳 · 레이드 ${D.raids.length}개 · 일일 던전 ${D.dungeons.list.length}개 · 필드 보스 원정 ${D.worldBosses.length}곳 · 퀘스트 ${D.quests.length}개`],
    ['growth', 'trending-up', '#f472b6', '성장·강화', '경험치 표 · 경험치 배율 · 강화 · 각성 · 합성 · 칭호'],
  ];
  const tries = ['합성', '강화서', '강화 성공률', '치명타', '크라켄', 'ㅎㄱㅅ'];
  const kv = [
    ['만렙', `Lv ${D.meta.maxLevel}`], ['1차 전직', `Lv ${c.advanceLevel}`], ['각성', `Lv ${c.awakenLevel}`], ['치명타 배율', `×${c.critMul}`],
    ['강화 한계', `+${c.enhanceMax}`], ['장비 티어', `T1~T${D.tiers.length}`], ['필드 장비 드랍', `${pct(c.gearDrop.field)} (T1 ${pct(c.gearDrop.fieldT1)})`], ['사망 후 부활', `${c.respawnSec}초`],
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
  const classRows = D.classes.map((k) => tr([
    `<a href="#/classes/${k.id}">${esc(k.name)}</a>`, DMG[k.dmgType], R(k.baseAtk), R(`×${k.classMul.atk}`), R(k.growth.find((g) => g.level === 100)?.atk ?? '-'), R(k.growth.find((g) => g.level === D.meta.maxLevel)?.atk ?? '-'), R(`${k.critPct}%`),
  ]));
  const rarRows = c.grades.list.map((r) => tr([`<span class="rar-${r.id}">${esc(r.name)}</span>`, ...c.grades.mulExamples.map((ex) => R(`×${ex.mul.find((x) => x.rarity === r.id).mul}`))]));
  const enhRows = EQUIP.map((k) => tr([KIND[k], R(`+${pct(c.enhanceBonusPer[k])}`), R(`×${(1 + c.enhanceBonusPer[k] * c.enhanceMax).toFixed(2)}`)]));
  return `
    ${head('데미지 공식', '게임 서버가 쓰는 식 그대로입니다.')}
    <div class="stack">
      <div class="formula">피해 = max(1, 반올림(<b>공격력</b> × <b>계수</b> × <b>편차</b>))
편차 = 0.9 ~ 1.1 사이 균등 난수
치명타면 피해 × ${c.critMul} (다시 반올림)</div>
      <ul class="plain">
        <li><b>계수</b>: 기본 공격·스킬마다 정해진 배율입니다(스킬 도감의 "계수"). 도적 기본 공격처럼 여러 번 때리는 공격은 타마다 따로 계산합니다.</li>
        <li>대상의 능력치와 상관없이 같은 공격은 같은 피해를 줍니다. 아무리 약해도 최소 1은 들어갑니다.</li>
        <li><b>받는 피해 감소 버프</b>(도발 등 guard)는 받는 피해에 (1 − %)를 곱합니다.</li>
        <li><b>다음 공격 강화</b>: dmgNext 버프는 공격력에 배율을 곱하고, critNext는 치명타를 확정합니다. 한 번 쓰면 사라집니다.</li>
        <li>중독 피해와 지속 장판(연막·먹물 등의 틱)은 치명타가 없고, 중독은 시전자 공격력으로 정해지는 고정 피해입니다(걸 때 시전자 공격력 × 초당 계수).</li>
        <li><b>중독 중첩</b>: 서로 다른 스킬(또는 다른 시전자)의 중독은 따로 쌓여 함께 들어갑니다(대상 하나에 최대 16개). 같은 스킬로 다시 걸면 남은 시간만 늘어나고 틱 박자는 그대로입니다. 화염술사의 화상은 0.1초마다, 나머지는 1초마다 들어갑니다.</li>
      </ul>
    </div>

    <h2 id="calc">계산기</h2>
    <div id="calc-root"></div>

    <h2>공격력은 어떻게 정해지나</h2>
    <div class="formula">공격력 = (직업 기본값(Lv1) + 레벨당 공격력 × (레벨 − 1) + 장비 공격력 합) × 직업 계수
전직 패시브(공격력 %)는 직업 기본값(레벨 성장 포함) 쪽에만 곱함 (+ 올스탯)
장비 수치 = 반올림(기본 수치 × 등급 배율 × (1 + 강화 단계 × 상승률))</div>
    <p class="muted small">전직 공격력 %는 장비 공격력(무기·장갑·반지)에는 붙지 않습니다. 물리·마법 공격력은 같은 값에서 출발하고, 직업 피해 종류(물리/마법)에 맞는 쪽을 씁니다.</p>
    ${table(['직업', '계열', { t: '기본 공격력(Lv1, 계수 전)', c: 'r' }, { t: '직업 공격 계수', c: 'r' }, { t: 'Lv100 일반 장비 공격력', c: 'r' }, { t: `Lv${D.meta.maxLevel} 일반 장비 공격력`, c: 'r' }, { t: '치명타', c: 'r' }], classRows)}
    <div class="grid g2" style="margin-top:12px">
      <div>${table(['등급', ...c.grades.mulExamples.map((ex) => ({ t: `T${ex.tier} 배율`, c: 'r' }))], rarRows)}<p class="muted small" style="margin-top:6px">등급 한 칸 = 티어 ¼칸(한 칸 최소 ×${c.grades.minMul}) · 티어마다 다른 곡선이라 <a href="#/drops">드랍률</a>에서 자세히 봅니다.</p></div>
      <div>${table(['장비 칸', { t: '강화 1단계당', c: 'r' }, { t: `+${c.enhanceMax} 배율`, c: 'r' }], enhRows)}</div>
    </div>

    <h2>HP·MP</h2>
    <div class="formula">최대 HP = (직업 기본 + 레벨당 HP × (레벨 − 1) + 장비 HP 합) → 전직 HP % 곱 → × 직업 계수(반올림)
최대 MP = 직업 기본 + 레벨당 MP × (레벨 − 1) → 전직 MP % 곱</div>
    <p class="muted small">레벨이 오르면 HP·공격력·MP가 조금씩 오르지만, 큰 몫은 장비입니다 — 더 높은 티어 장비·등급·강화가 곧 성장입니다. 직업 계수와 올스탯은 <a href="#/growth">성장·강화</a>에서 봅니다.</p>

    <h2>치명타</h2>
    <p>치명타 확률 = 직업 기본값 + 전직 패시브(%p). 치명타가 뜨면 피해 × ${c.critMul}. 활잽이는 기본 15%, 나머지 직업은 10%에서 시작합니다. 몬스터 공격은 치명타가 없습니다.</p>

    <h2>치유량·보호막</h2>
    <div class="formula">치유량(보호막) = 대상 최대 HP × 스킬 HP % + 시전자 마법 공격력 × 스킬 마법 공격력 %</div>
    <p class="muted small">힐러 스킬은 마법 공격력 비중이 커서 장비로 마법 공격력을 올려야 회복량이 늡니다(예: 치유의 빛 = 마법 공격력 150% + 대상 최대 HP 12%). 기사의 자가 회복·성역 보호막은 최대 HP만 탑니다. 스킬 도감의 수치 줄에 스킬마다 두 비율이 나옵니다. 회복 물약·마나 물약은 티어마다 정해진 양을 회복합니다(아이템 도감 참고, 쿨 회복 ${c.potionCdSec}초·마나 ${c.mpPotionCdSec}초 따로). 엘릭서는 HP·MP를 함께 채우고 회복 물약 쿨을 같이 씁니다.</p>

    <h2>몬스터가 주는 피해</h2>
    <div class="formula">받는 피해 = max(1, 반올림(몬스터 공격력 × 공격 계수 × 편차))</div>
    <ul class="plain">
      <li>몬스터는 치명타가 없습니다. 근접 공격은 휘두르기 시작 뒤 조금 있다 판정되어 대시로 피할 수 있습니다.</li>
      <li>정예 몬스터는 같은 섬 기준 몬스터보다 HP ×${c.elite.hpMul}, 공격력 ×${c.elite.atkMul}, 레벨 +${c.elite.levelBonus}입니다.</li>
      <li>레이드 보스는 제한 시간 안에 못 잡으면 격노해 피해가 커집니다(지역·레이드 참고).</li>
      <li><b>고레벨 사냥터</b>(Lv${c.hunt.fromLevel}~ 일반·정예 몬스터)는 레벨이 오를수록 HP·공격력이 커져 Lv${c.hunt.hp[1][0]}부터 HP ×${c.hunt.hp[1][1]}, 공격력 ×${c.hunt.atk[1][1]}입니다. 대신 경험치를 더 주고(<a href="#/growth">성장·강화</a>), <b>특수 공격</b>을 씁니다 — 근접 몬스터는 ${c.hunt.skill.melee.cdSec}초마다 '${esc(c.hunt.skill.melee.name)}'(제자리 반경 ${c.hunt.skill.melee.r}, ${c.hunt.skill.melee.warnSec}초 예고, 계수 ${Math.round(c.hunt.skill.melee.coef * 100)}%), 원거리 몬스터는 ${c.hunt.skill.proj.cdSec}초마다 '${esc(c.hunt.skill.proj.name)}'(대상 발밑 반경 ${c.hunt.skill.proj.r}, ${c.hunt.skill.proj.warnSec}초 예고, 계수 ${Math.round(c.hunt.skill.proj.coef * 100)}%). 바닥 표시를 보고 피하거나, 예고 중에 잡으면 취소됩니다. 정예는 재사용 대기 ×${c.hunt.skill.eliteCdMul}, 반경 +${c.hunt.skill.eliteR}.</li>
    </ul>`;
}

const calc = { cls: 'knight', branch: '', level: 100, gear: {}, mob: '' };
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
  calc.gear = defaultGear(cls, calc.level);
}
function renderCalc() {
  const root = document.getElementById('calc-root');
  if (!root) return;
  const cls = classOf(calc.cls);
  const branches = D.branches.filter((b) => b.classId === cls.id);
  const canAdvance = calc.level >= D.constants.advanceLevel;
  const branch = canAdvance ? M.branches.get(calc.branch) : undefined;
  const gear = EQUIP.map((k) => calc.gear[k]).filter((g) => g && g.id).map((g) => ({ item: M.items.get(g.id), enh: g.enh })).filter((g) => g.item);
  const second = !!branch && calc.level >= D.constants.secondLevel;
  const third = second && calc.level >= D.constants.thirdLevel;
  const st = playerStats(cls, calc.level, gear, branch, second, third);
  const mob = M.mobs.get(calc.mob);
  const awakened = !!branch && calc.level >= D.constants.awakenLevel;
  const slots = skillsFor(cls, branch, awakened, second, third).map((id) => M.skills.get(id));
  const crit = Math.min(100, st.crit) / 100;
  const rowsFor = (label, iconHtml, coefs, locked) => coefs.map((cf, i) => {
    const mn = damage(st.atk, cf.coef, 0);
    const mx = damage(st.atk, cf.coef, 1);
    const avg = avgDamage(st.atk, cf.coef);
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
  const mobHit = mob ? { mn: damage(mob.atk, mob.attack.coef, 0), mx: damage(mob.atk, mob.attack.coef, 1) } : null;

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
        <div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="small">장비 <span class="muted">(오른쪽은 강화 단계)</span></b><button class="chip accent" type="button" data-act="gear">레벨에 맞는 상점 장비</button></div>
        <div class="stack" style="--gap:6px">${EQUIP.map((kind) => {
          const g = calc.gear[kind] ?? { id: '', enh: 0 };
          return `<div class="gear-row"><span class="muted">${KIND[kind]}</span><select data-gear="${kind}"><option value="">없음</option>${gearOptions(kind).map((it) => `<option value="${it.id}" ${it.id === g.id ? 'selected' : ''}>${esc(it.name)} · ${rarName(it.rarity)} · Lv${it.reqLevel}${it.reqLevel > calc.level ? ' (착용 불가)' : ''}</option>`).join('')}</select><select data-enh="${kind}" aria-label="${KIND[kind]} 강화">${Array.from({ length: D.constants.enhanceMax + 2 }, (_, i) => `<option value="${i}" ${i === g.enh ? 'selected' : ''}>${i > D.constants.enhanceMax ? '각성' : `+${i}`}</option>`).join('')}</select></div>`;
        }).join('')}</div>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:200px">때릴 대상<select data-k="mob"><option value="">대상 지정 안 함</option>${mobGroups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((m) => `<option value="${m.id}" ${m.id === calc.mob ? 'selected' : ''}>${esc(m.name)} (Lv${m.level})</option>`).join('')}</optgroup>`).join('')}</select></label>
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <h3>내 능력치</h3>
        <dl class="stats">
          <div class="stat"><dt>${cls.dmgType === 'magic' ? '마법' : '물리'} 공격력</dt><dd>${fmt(st.atk)}</dd></div>
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
    if (t.dataset.gear) calc.gear[t.dataset.gear] = { id: t.value, enh: calc.gear[t.dataset.gear]?.enh ?? 0 };
    if (t.dataset.enh) calc.gear[t.dataset.enh] = { id: calc.gear[t.dataset.enh]?.id ?? '', enh: Number(t.value) };
    renderCalc();
  });
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'gear') calc.gear = defaultGear(classOf(calc.cls), calc.level);
    else return;
    renderCalc();
  });
  renderCalc();
}

// ── 페이지: 드랍률 ──
function pageDrops() {
  const c = D.constants;
  const g = c.grades;
  const gearAll = (mob) => {
    const gearIds = mob.loot.entries.filter((e) => EQUIP.includes(M.items.get(e.itemId)?.kind));
    return 1 - gearIds.reduce((m, e) => m * (1 - e.chance), 1);
  };
  const fieldMobs = D.mobs.filter((m) => m.kind !== 'raidAdd' && m.kind !== 'worldBossAdd').sort((a, b) => a.level - b.level);
  const GRADE_TABLE = { field: '필드 표', fieldBoss: '섬 보스 표' };
  const mobRows = fieldMobs.map((m) => {
    const other = m.loot.entries.filter((e) => !EQUIP.includes(M.items.get(e.itemId)?.kind)).map((e) => `${esc(M.items.get(e.itemId)?.name ?? e.itemId)} ${pct(e.chance)}`).join(', ');
    const gear = gearAll(m);
    return tr([mobLink(m.id), MOB_KIND[m.kind], R(`${fmt(m.loot.gold[0])}~${fmt(m.loot.gold[1])}`), R(gear ? pct(gear) : '—'), R(gear ? `T${m.gearTier}` : '—'), gear ? GRADE_TABLE[m.gearGrades] : '—', `<span class="small">${other || '—'}</span>`]);
  });
  // 섬마다 상자 표가 따로 있다(그 섬 물약·베리, 섬 시작 레벨 티어 장비)
  const chestRows = D.islands.filter((isl) => isl.chestLoot).map((isl) => {
    const loot = isl.chestLoot;
    const gearIds = loot.entries.filter((e) => EQUIP.includes(M.items.get(e.itemId)?.kind));
    const gearP = 1 - gearIds.reduce((m, e) => m * (1 - e.chance), 1);
    const scroll = loot.entries.find((e) => e.itemId === D.scrolls.id);
    const gearTier = M.items.get(gearIds[0]?.itemId)?.tier;
    return tr([islandLink(isl.id), R(`${fmt(loot.gold[0])}~${fmt(loot.gold[1])}`), R('100%'), R(pct(loot.entries.find((e) => e.itemId === 'scroll_return')?.chance ?? 0)), R(`${pct(gearP)}${gearTier ? ` · T${gearTier}` : ''}`), R(scroll ? pct(scroll.chance) : '—')]);
  });
  const gradeRows = g.list.map((r) => tr([`<span class="rar-${r.id}">${esc(r.name)}</span>`, R(`${r.step}칸`), ...g.mulExamples.map((ex) => R(`×${ex.mul.find((x) => x.rarity === r.id).mul}`))]));
  const tierRows = D.tiers.map((t) => tr([R(`T${t.tier}`), esc(t.set), R(`Lv${t.fromLevel}`), R(t.band), t.shops.map(islandLink).join(', ') || '—', t.bosses.map(mobLink).join(', ') || '—']));
  const raidSetRows = D.raidSets.map((s) => tr([R(s.rank), s.raidId ? islandLink(s.raidId) : esc(s.raidName), R(`Lv${s.reqLevel}`), esc(`${s.prefix} 세트`), s.bossId ? mobLink(s.bossId) : '—']));
  const inf = D.infinite;
  const m = c.market;
  const raidRows = D.raids.map((r) => {
    const set = D.raidSets.find((s) => s.raidId === r.id);
    return tr([islandLink(r.id), R(`Lv${r.minLevel}`), `${set ? `${esc(set.prefix)} 세트` : '보스 세트'} 1점 ${r.rewards.gearChance >= 1 ? '확정' : pct(r.rewards.gearChance)}${r.rewards.firstClearUnique ? ' · 캐릭터 첫 클리어 때 원하는 부위 1개를 유니크로' : ''}`, r.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ×${i.qty}`).join(', ')]);
  });
  const wbRows = D.worldBosses.map((w) => tr([islandLink(w.islandId), R(`${w.minSharePct}% 이상`), w.rewards.legendaryChance ? `전설 등급 ${pct(w.rewards.legendaryChance)}(내 레벨 티어 장비 부위)` : '—', `${fmt(w.rewards.gold)} 베리 · ${esc(D.gems.name)} ${w.rewards.gems[0]}~${w.rewards.gems[1]}개 · ${w.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ${i.qty[0]}~${i.qty[1]}개`).join(', ')} · 경험치(${levelShare(pct(w.rewards.expLevelFrac))})`]));
  return `
    ${head('드랍률', '게임 서버의 전리품 규칙 그대로입니다.')}
    <h2 style="margin-top:0">몬스터 한 마리를 잡으면</h2>
    <ol class="plain">
      <li><b>베리</b>: 처치를 인정받은 사람마다 따로 굴려 바로 들어옵니다(줍지 않아도 됨).</li>
      <li><b>전리품</b>: 몬스터 드랍표의 항목마다 <b>독립적으로</b> 한 번씩 굴립니다. 몬스터당 한 번이며, 바닥에 떨어진 뒤 ${c.dropOwnerSec}초 동안은 처치 인정자(파티 포함)만 보고 주울 수 있고(다른 사람 화면에는 보이지 않음), ${c.dropDespawnSec}초 뒤 사라집니다. ${itemLink(D.scrolls.id)}도 여기서 나옵니다(필드 몬스터 ${pct(D.scrolls.fieldDrop)}).</li>
      <li><b>장비</b>: 몬스터 레벨의 티어 장비 11종이 드랍표에 들어 있고(하나 이상 나올 확률 필드 몬스터 ${pct(c.gearDrop.field)}(T1은 ${pct(c.gearDrop.fieldT1)}) · 섬 보스 ${pct(c.gearDrop.boss)}), 떨어질 때 <a href="#/drops#grades">등급</a>을 한 번 굴립니다. 정예는 레벨 보너스를 뺀 원종 레벨의 티어입니다.</li>
    </ol>

    <h2 id="grades">장비 등급</h2>
    <p>장비의 등급은 아이템 종류가 아니라 <b>얻을 때 굴려서</b> 정해집니다. 등급은 ${g.list.map((r) => `<span class="rar-${r.id}">${esc(r.name)}</span>`).join(' → ')} 6단계입니다. <b>등급 한 칸은 티어 ¼칸</b>이되 한 칸에 최소 ×${g.minMul}입니다: 티어 간격이 큰 T1·T2는 ${esc(rarName('legendary'))}(4칸)이 다음 티어 ${esc(rarName('common'))}과 같고, T3부터는 한 칸마다 ×${g.minMul}입니다. 티어 장비·레이드 세트 모두 ${esc(g.mergeCaps.name)}까지 합성할 수 있고, ${esc(rarName('unique'))}는 레이드 보스 드랍으로만 나옵니다.</p>
    ${table(['등급', { t: '칸', c: 'r' }, ...g.mulExamples.map((ex) => ({ t: `T${ex.tier} (${esc(ex.name)}) 배율`, c: 'r' }))], gradeRows)}
    <p class="muted small" style="margin-top:8px">배율은 그 장비 일반 등급 수치에 곱하는 값입니다. 티어 사이는 로그 선형으로 이어 계산합니다. 등급 개편 전 장비(옛 전설·영웅·유니크)는 옛 고정 배율(${Object.entries(c.rarityMul).filter(([k]) => k !== 'absolute').map(([k, v]) => `<span class="rar-${k}">${rarName(k)}</span> ×${v}`).join(' · ')})을 씁니다.</p>
    ${table(['어디서', '등급'], [
      tr(['필드 몬스터·정예·보물상자의 티어 장비', esc(g.fieldText)]),
      tr(['섬 보스의 티어 장비', esc(g.fieldBossText)]),
      tr([`${esc(inf.name)} — 티어 장비`, `${esc(g.infiniteText)} · 웨이브 클리어마다 ${pct(g.infiniteChance.wave)}(보스 웨이브 ${pct(g.infiniteChance.boss)}) · ${inf.gear.floorsPerTier}층마다 한 티어씩(1~${inf.gear.floorsPerTier}층 T1, ${inf.gear.floorsPerTier + 1}~${inf.gear.floorsPerTier * 2}층 T2 …), 내 레벨 티어까지`]),
      tr([`${esc(inf.name)} — 레이드 세트`, `${g.infiniteRaidRoll.fromWave}웨이브부터 웨이브 클리어마다 ${rarName('legendary')} ${pct(g.infiniteRaidRoll.legendary)} · ${rarName('unique')} ${pct(g.infiniteRaidRoll.unique)}(10웨이브마다 +${pct(g.infiniteRaidRoll.uniquePer10)}) (내가 입장할 수 있는 가장 높은 레이드 세트)`]),
      tr(['<a href="#/world#dungeons">장비 던전</a>', `완주하면 내 레벨 티어 장비 ${D.dungeons.list.find((d) => d.kind === 'gear')?.clearGear ?? 0}점 · 한 점마다 ${esc(g.gearDungeonText)}`]),
      tr(['레이드 클리어', `${esc(g.raidText)} — 그 보스 전용 세트 1점 확정`]),
    ])}
    <p class="muted small" style="margin-top:8px">같은 장비·같은 등급 세 개를 <a href="#/growth#merge">합성</a>하면 한 등급 위가 됩니다. 등급 개편 전의 전설·영웅·유니크 전용 장비는 가진 것은 그대로 쓰지만 더 이상 나오지 않습니다.</p>
    <h3 id="absolute"><span class="rar-absolute">${esc(g.absolute.name)}</span> 장비</h3>
    <p>굴려서 나오는 등급 위에 따로 있는 최상위 장비입니다. 부위마다 지금 얻을 수 있는 가장 센 ${esc(rarName('unique'))} 장비(+0)의 <b>${g.absolute.overUnique}배</b> 수치에 모든 능력치 +${g.absolute.allStat}이 붙고, 착용 Lv${g.absolute.reqLevel}입니다. 귀속이라 거래·판매할 수 없고, 끼면 캐릭터에 붉은 금빛 불꽃이 둘러집니다(메뉴 › 설정 › 내 장비 후광으로 끕니다).</p>
    <p>${islandLink(g.absolute.raid)} 클리어마다 참가자 각자 <b>${pct(g.absolute.chance)}</b> 확률로 자기 직업이 낄 수 있는 ${esc(g.absolute.name)} 장비 1점이 나옵니다(혼자 도전·이벤트 배율 없음, 나오면 서버 전체 공지). 후보: ${g.absolute.items.map((id) => itemLink(id)).join(' ')}</p>
    ${note(`처치 인정: 막타를 친 사람과 한 대라도 때린 사람, 그리고 그 파티원 중 같은 맵(같은 채널)에 있는 사람 모두입니다. 가상 유저(봇) 파티 덕에만 인정받은 경우 베리·경험치가 ${pct(c.botCarryShare)}로 줄어듭니다.`)}

    <h2 id="tiers">장비 티어 (T1~T${D.tiers.length})</h2>
    <p class="muted small">티어는 레벨 구간입니다. 티어 장비는 <b>그 티어 시작 레벨</b>부터 낄 수 있고, 한 티어에 장비 11종(직업 무기 5 + 공용 6부위)이 있습니다. 섬 상점은 그 섬 레벨대에 걸친 티어를 모두 팝니다.</p>
    ${table([{ t: '티어', c: 'r' }, '장비 세트', { t: '착용', c: 'r' }, { t: '레벨 구간', c: 'r' }, '파는 상점', '떨어뜨리는 섬 보스'], tierRows)}

    <h2 id="raid-sets">레이드 세트</h2>
    <p class="muted small">레이드 보스마다 전용 세트가 하나씩 있습니다. 레이드를 클리어하면 그 세트 중 쓸 수 있는 부위 1점이 반드시 나옵니다(등급 ${esc(g.raidText)}). 순위는 티어 곡선 위의 기준점이라 수치·강화·각성 비용에 쓰입니다.</p>
    ${table([{ t: '순위', c: 'r' }, '레이드', { t: '입장', c: 'r' }, '장비 세트', '보스'], raidSetRows)}

    <h2>몬스터별 드랍</h2>
    <p class="muted small">장비 칸은 그 몬스터 티어 장비 11종 중 하나 이상이 떨어질 확률입니다(항목마다 따로 굴림). 필드 몬스터 ${pct(c.gearDrop.field)}(T1은 ${pct(c.gearDrop.fieldT1)}), 섬 보스 ${pct(c.gearDrop.boss)}로 맞춰져 있고, 등급은 필드 표(${esc(g.fieldText)}) 또는 섬 보스 표(${esc(g.fieldBossText)})로 굴립니다. 항목별 확률은 몬스터 이름을 누르세요.</p>
    ${table(['몬스터', '종류', { t: '베리', c: 'r' }, { t: '장비', c: 'r' }, { t: '티어', c: 'r' }, '등급표', '기타'], mobRows, { scroll: true })}

    <h2>보물상자</h2>
    <p class="muted small">섬마다 놓인 상자를 F로 엽니다. 연 뒤 ${c.chestRespawnSec / 60}분 뒤 다시 생깁니다. 그 섬 회복 물약 1~2개는 반드시 나오고, 장비는 그 섬 시작 레벨 티어(등급은 필드 표)입니다.</p>
    ${table(['섬', { t: '베리', c: 'r' }, { t: '회복 물약', c: 'r' }, { t: '귀환 두루마리', c: 'r' }, { t: '장비(아무거나)', c: 'r' }, { t: '강화서', c: 'r' }], chestRows)}

    <h2>암거래상</h2>
    <div class="card">
      <h3>${esc(m.name)}</h3>
      <ul class="plain small">
        <li>서버가 켜지고 ${m.firstDelaySec[0] / 60}~${m.firstDelaySec[1] / 60}분 뒤 처음 나타나고, 그 뒤 ${m.intervalSec[0] / 60}~${m.intervalSec[1] / 60}분마다 다시 나타납니다.</li>
        <li>사람이 있는 섬의 부두 근처에 ${m.staySec / 60}분 머뭅니다(서버 전체 공지).</li>
        <li>재고: 등장마다 공용 부위(갑옷·목걸이·보조 4) 중 ${m.epicStock}종을 뽑아 영웅 등급으로 팝니다(값 ×${m.gradePriceMul.epic}). 티어는 사는 캐릭터 레벨 +${m.levelAhead}까지 낄 수 있는 가장 높은 티어라, 지금 또는 곧 낄 장비만 보입니다.</li>
      </ul>
    </div>

    <h2 id="ruby">루비</h2>
    <p>${RUBY_NOTE} 1루비는 ${D.ruby.krw}원 기준이고, 아래는 한 번 굴릴 때(참가자마다 따로) 값입니다.</p>
    ${table(['출처', { t: '확률', c: 'r' }, { t: '개수', c: 'r' }, { t: '기대값', c: 'r' }], D.ruby.drops.map((r) => tr([esc(r.label), R(pct(r.chance)), R(`${r.qty[0]}~${r.qty[1]}개`), R(`약 ${fmt(r.chance * (r.qty[0] + r.qty[1]) / 2)}루비`)])))}
    ${cashShopSection()}
    ${cosmeticsSection()}

    <h2 id="gems">${esc(D.gems.name)} · 고급 상자</h2>
    <p><b>${esc(D.gems.name)}</b>은 레이드 · ${esc(D.infinite.name)} · 필드 정예 몬스터에서 낮은 확률로, 필드 보스 원정에서는 확정으로 나오는 재화입니다(캐릭터마다 따로 쌓입니다). 노을마을의 ${esc(npcNameOfRole('gem'))}에게서 쓸 수 있습니다(한 번에 ${D.gems.buyMax}개까지). Lv ${D.relics.level}부터는 <a href="#/growth#relics">유물</a> 뽑기에도 씁니다.</p>
    <div class="grid g2">
      <div class="card">
        <h3>얻는 곳</h3>
        <ul class="plain small">
          <li>레이드 클리어 1회: ${pct(D.gems.drop.raid.chance)} 확률로 ${D.gems.drop.raid.qty[0]}~${D.gems.drop.raid.qty[1]}개(참가자마다 따로)</li>
          <li>${esc(D.infinite.name)} 웨이브 클리어: ${pct(D.gems.drop.wave.chance)} 확률로 ${D.gems.drop.wave.qty[0]}개, <b>${D.gems.drop.wave.highFromWave}웨이브부터 ${pct(D.gems.drop.wave.high)}</b> 확률로 ${D.gems.drop.wave.highQty[0]}~${D.gems.drop.wave.highQty[1]}개. 보스 웨이브는 확률 ×${D.gems.drop.wave.bossMul}</li>
          <li>필드 정예 몬스터 처치: ${pct(D.gems.drop.elite.chance)} 확률로 ${D.gems.drop.elite.qty[0]}개(처치 인정자마다 따로, 레이드 · 던전 안 제외)</li>
          ${D.worldBosses.map((w) => `<li><a href="#/world#wb-${esc(w.id)}">${esc(w.name)}</a> 처치: 기여 지분 ${w.minSharePct}% 이상이면 <b>반드시</b> ${w.rewards.gems[0]}~${w.rewards.gems[1]}개</li>`).join('')}
          <li>선술집 의뢰 보상: 개인 의뢰 ${D.tavern.tiers.map((t) => `${esc(t.name)} ${t.gems}개`).join(' · ')}, 공용 의뢰는 그 절반(올림) — <a href="#/world#tavern">선술집 의뢰</a></li>
          <li>게스트 계정 연동(이름·비밀번호 또는 Google): <b>계정당 한 번</b> ${D.gems.link.gems}개 — 연동 뒤 처음 입장한 캐릭터가 받습니다. 게스트 캐릭터가 Lv.${D.gems.link.promptLevel}에 오르면 연동을 권하는 창이 뜹니다</li>
        </ul>
        <h3 style="margin-top:12px">젬 상점</h3>
        ${table(['물건', { t: '젬', c: 'r' }, '효과'], D.gems.shop.map((e) => tr([itemLink(e.itemId), R(`<span style="white-space:nowrap">${e.gems}</span>`), `<span class="small">${esc(M.items.get(e.itemId)?.desc ?? '')}</span>`])))}
        <p class="muted small" style="margin-top:8px">가방 확장권 1장 = 가방 +${D.gems.bag.step}칸(제한 없이 계속, 캐릭터마다). 계정 창고는 누구나 기본 ${D.gems.storage.base}칸을 쓰고, 창고 구매권 1장마다 +${D.gems.storage.step}칸(구매분 최대 ${D.gems.storage.max}칸) 늘어납니다. 창고는 노을마을 ${esc(npcNameOfRole("storage"))}에게서 열며 같은 계정의 모든 캐릭터(부캐릭터 포함)가 아이템과 베리를 함께 씁니다. 귀속 아이템은 넣을 수 없습니다.</p>
      </div>
      <div class="card">
        <h3>${itemLink('premium_box')}</h3>
        <p class="small muted">젬으로만 사는 상자. 여는 사람의 직업·레벨 티어에 맞춰 아래 중 하나가 나오고(장비는 내 레벨 티어 장비 부위), 여는 순간 등급에 따라 빛이 달라지는 연출이 나옵니다.</p>
        ${table(['결과', { t: '확률', c: 'r' }], [
          tr([`<span class="rar-unique">유니크 등급</span> 레이드 세트 장비(들어갈 수 있는 가장 높은 레이드, 아직 없으면 첫 레이드)`, R(pct(D.gems.premium.unique))]),
          tr([`<span class="rar-legendary">전설 등급</span> 장비(들어갈 수 있는 레이드가 있으면 ${pct(D.gems.premium.raidShare)}는 가장 높은 레이드 세트, 나머지는 레벨 티어 장비)`, R(pct(D.gems.premium.legendary))]),
          tr([`<span class="rar-epic">영웅 등급</span> 장비(전설과 같은 방식)`, R(pct(D.gems.premium.epic))]),
          tr([`베리 ${fmt(D.gems.premium.gold[0])}~${fmt(D.gems.premium.gold[1])} + 강화서 ${D.gems.premium.scrolls[0]}~${D.gems.premium.scrolls[1]}장`, R(pct(1 - D.gems.premium.unique - D.gems.premium.legendary - D.gems.premium.epic))]),
        ])}
        <p style="margin-top:10px"><b>천장</b>: 유니크 없이 ${D.gems.pity - 1}번 열면 <b>${D.gems.pity}번째는 유니크 확정</b>입니다. 유니크가 나오면(확률이든 천장이든) 카운트가 처음부터 다시 셉니다. 남은 횟수는 젬 상점과 개봉 화면에 보입니다(캐릭터마다).</p>
      </div>
    </div>

    ${attendanceSection()}

    <h2>레이드 보상</h2>
    ${table(['레이드', { t: '입장', c: 'r' }, '장비', '고정 보상'], raidRows)}
    <p class="muted small" style="margin-top:8px">레이드 장비는 참가자마다 따로 굴리며, 내 직업이 쓸 수 있는 부위 중에서만 뽑힙니다. 등급은 ${esc(g.raidText)}입니다. 클리어마다 ${pct(D.gems.drop.raid.chance)} 확률로 ${esc(D.gems.name)}도 나옵니다.</p>

    <h2>필드 보스 원정 보상</h2>
    ${table(['전장', { t: '기여 지분', c: 'r' }, '장비', '고정 보상'], wbRows)}
    <p class="muted small" style="margin-top:8px">처치 순간 기여(보스에게 넣은 피해 + 보스와 싸우는 동안 채운 치유량 × ${c.worldBossHealWeight})가 전체의 기준 % 이상인 사람만 받습니다. 힐러는 치유로도 기준을 넘길 수 있습니다. 전장을 떠나 다른 곳에 있어도 받고, 접속을 끊었으면 그 캐릭터로 다음에 들어올 때 받습니다. 처치 경험치와 전리품은 없습니다.</p>`;
}
const CASH_KIND = { starter: '스타터 팩', subscription: '월정액', pass: '레벨 패스', pet: '펫', blessing: '서버 축복', bundle: '아이템', cosmetic: '꾸미기' };
/** 루비 상점: 상품 표(꾸미기 상품은 꾸미기 표로) · 월정액·자석펫·축복·패스·선물 규칙 · 레벨 패스 단계별 보상 */
function cashShopSection() {
  const cs = D.cashShop;
  const mp = cs.magnetPet;
  const sup = cs.supporter;
  const bl = cs.blessing;
  const limit = (p) => (p.perAccountMax ? `계정당 ${p.perAccountMax}번` : p.perDayMax ? `계정당 하루 ${p.perDayMax}번` : '');
  const rows = cs.products.filter((p) => p.kind !== 'cosmetic').map((p) => tr([
    `<b>${esc(p.name)}</b><div class="muted small">${[CASH_KIND[p.kind] ?? p.kind, limit(p)].filter(Boolean).map(esc).join(' · ')}</div>`,
    R(`${fmt(p.priceRuby)}루비<div class="muted small">${fmt(p.priceKrw)}원</div>`),
    `<span class="small">${p.contents.map(esc).join('<br>')}</span><div class="muted small">${esc(p.desc)}</div>`,
  ]));
  const passes = cs.passes.map((p) => `<details style="margin-top:12px"><summary>${esc(p.name)} 단계별 보상 (Lv${p.from}~${p.to} · ${p.steps.length}단계)</summary>${table([{ t: '단계', c: 'r' }, '무료 줄', '유료 줄'], p.steps.map((s) => tr([R(`Lv${s.level}`), `<span class="small">${s.free.map(rewardText).join('<br>')}</span>`, `<span class="small">${s.paid.map(rewardText).join('<br>')}</span>`])))}</details>`).join('');
  return `
    <h2 id="cash-shop">루비 상점</h2>
    <p>메뉴(ESC) › <b>상점</b>에서 루비로 삽니다. 루비는 계정 공용이고 1루비는 ${D.ruby.krw}원 기준입니다. 꾸미기 상품은 아래 <a href="#/drops#cosmetics">꾸미기</a> 표에 있습니다.</p>
    ${table(['상품', { t: '값', c: 'r' }, '구성'], rows)}
    <ul class="plain small" style="margin-top:12px">
      <li><b>모험가 월정액</b>: 계정의 모든 캐릭터에 ${sup.days}일 동안 혜택이 붙습니다. 쓰는 중에 또 사면 ${sup.days}일이 더해집니다(최대 ${sup.maxDays}일). 경험치 +${pct(sup.expBonus)}는 다른 경험치 보너스와 더합니다(<a href="#/growth#exp-bonus">경험치 배율</a>).</li>
      <li><b>${esc(mp.name)}</b>: 계정의 모든 캐릭터 곁을 떠다니며 주변 드랍을 끌어와 줍습니다. 자동 줍기 거리가 기본 ${mp.basePickup}의 ${mp.pickupRadius}배가 됩니다. 계정에 영구로 남고, 모험가 월정액을 사면 함께 받습니다. ${esc(mp.name)}을 이미 가진 계정은 월정액을 ${fmt(mp.priceRuby)}루비 싸게 삽니다.</li>
      <li><b>서버 축복</b>: 받는 순간 서버 전체에 ${bl.minutes / 60}시간 동안 경험치 +${pct(bl.expBonus)}가 붙습니다. 축복 중에 또 받으면 시간이 늘어납니다(남은 시간 최대 ${bl.maxQueueMinutes / 60}시간). 계정당 하루 ${bl.perAccountPerDay}번까지 삽니다.</li>
      <li><b>레벨 패스</b>: 무료 줄은 누구나, 유료 줄은 패스를 산 계정만 받습니다. 캐릭터마다 그 단계 레벨에 닿으면 상점 창에서 각자 받고, 지난 단계도 받을 수 있습니다. 유료 줄 보상은 강화서 말고는 귀속입니다.</li>
      ${(() => { const sp = cs.passes.find((p) => p.line === 'style'); const prod = sp && cs.products.find((p) => p.id === sp.id); return sp && prod ? `<li><b>${esc(sp.name)}</b>: 꾸미기만 주는 패스로 값은 모험가 월정액과 같고(${fmt(prod.priceRuby)}루비) 계정당 한 번 삽니다. Lv${sp.from}~${sp.to} ${sp.steps.length}단계 모두 유료 줄에 꾸미기가 하나씩 있고, 마지막 Lv${sp.steps[sp.steps.length - 1].level}은 이 패스에서만 나오는 ${rewardText(sp.steps[sp.steps.length - 1].paid[0])}입니다. 무료 줄도 몇 단계는 꾸미기, 나머지는 물약입니다. 꾸미기는 계정 소유라 한 캐릭터가 받으면 모든 캐릭터가 쓰고 능력치 효과는 없습니다. 레벨 패스와 진행이 따로입니다.</li>` : ''; })()}
      <li><b>친구 선물</b>: 루비로 산 상품을 <a href="#/world#friends">친구</a>에게 선물할 수 있습니다. 선물은 친구 우편함으로 가고 친구가 받는 캐릭터에서 열립니다. 구매 제한은 받는 계정 기준입니다.</li>
    </ul>
    ${passes}`;
}
/** 꾸미기: 능력치 없음 · 계정 소유 · 칸마다 하나 장착. 얻는 곳은 build.ts가 붙인다 */
function cosmeticsSection() {
  const cm = D.cosmetics;
  const slotName = (id) => cm.slots.find((s) => s.id === id)?.name ?? id;
  const rows = cm.list.map((c) => tr([
    `<span class="name-cell">${c.img ? `<img class="ico sm" src="${esc(c.img)}" alt="" loading="lazy" width="40" height="40">` : ''}<b style="color:${esc(c.color)}">${esc(c.name)}</b></span><div class="muted small">${esc(c.desc)}</div>`,
    esc(slotName(c.slot)),
    `<span class="small">${c.sources.map(esc).join('<br>')}</span>`,
  ]));
  return `
    <h2 id="cosmetics">꾸미기</h2>
    <p>꾸미기는 능력치 효과 없이 모양만 바꿉니다. 계정이 가지며, 캐릭터마다 ${cm.slots.map((s) => esc(s.name)).join(' · ')} 칸에 하나씩 장착합니다. 장착한 꾸미기는 주변 사람에게도 보입니다.</p>
    ${table(['꾸미기', '칸', '얻는 곳'], rows)}`;
}
/** 출석 이벤트: 기간 · 규칙 · 칸별 보상(진행 단계는 보는 날 기준) */
function attendanceSection() {
  const a = D.attendance;
  const today = kstToday();
  const phase = today < a.start ? '시작 전' : today <= a.end ? '진행 중' : today <= a.claimUntil ? '놓친 날 채우기 기간' : '끝남';
  return `
    <h2 id="attendance">출석 이벤트</h2>
    <p><b>${esc(a.name)}</b> <span class="chip">${monthDay(a.start)}~${monthDay(a.end)}</span> <span class="chip">놓친 날 채우기 ~${monthDay(a.claimUntil)}</span> <span class="chip accent">${phase}</span></p>
    <ul class="plain small">
      <li>메뉴(ESC) › <b>출석</b>에서 받습니다. 계정마다 하루(한국 시간) 한 칸이고, 그날 처음 「받기」를 누른 캐릭터가 다음 칸 보상을 받습니다. 같은 계정의 다른 캐릭터는 그날 더 받을 수 없습니다.</li>
      <li>날마다 이어서 오지 않아도 됩니다. 출석 기간이 끝난 뒤에도 ${monthDay(a.claimUntil)}까지는 접속한 날마다 놓친 칸을 하나씩 채울 수 있습니다(모두 ${a.days}칸).</li>
      <li>아이템은 받는 캐릭터에 귀속되고, 베리·${esc(D.gems.name)}도 받는 캐릭터에게 들어갑니다. 가방이 모자라면 아무것도 받지 않으니, 가방을 비우고 그날 다시 받으면 됩니다.</li>
    </ul>
    ${table([{ t: '칸', c: 'r' }, '보상'], a.rewards.map((list, i) => tr([R(`${i + 1}일째`), `<span class="small">${list.map(rewardText).join('<br>')}</span>`])))}`;
}


// ── 페이지: 직업·전직 ──
function passiveText(p) {
  return Object.entries(p).map(([k, v]) => `<span class="chip accent">${PASSIVE[k][0]} +${v}${PASSIVE[k][1]}</span>`).join(' ');
}
function pageClasses() {
  return `
    ${head('직업·전직', `직업 ${D.classes.length - 1}개와 히든 직업 1개, 전직 갈래 ${D.branches.length}개, 2차 전직 ${D.branches.length}개, 3차 전직 ${D.branches.filter((b) => b.third).length}개`)}
    <div class="grid g3">${D.classes.map((k) => `
      <a class="card class-card" href="#/classes/${k.id}" style="--c:${k.color}">
        ${k.icon ? `<img class="ico lg" src="${esc(k.icon)}" alt="" style="width:64px;height:64px">` : ''}
        <div><b style="font-size:18px;color:var(--text)">${esc(k.name)}</b><div class="muted small">${esc(k.role)}</div>
        <div class="chips" style="margin-top:6px"><span class="chip">${DMG[k.dmgType]}</span>${k.id === D.blacksmith.id ? '<span class="chip accent">히든 직업</span>' : `<span class="chip">갈래 ${D.branches.filter((b) => b.classId === k.id).length}개</span>`}</div></div>
      </a>`).join('')}
    </div>
    <h2>전직 흐름</h2>
    <div class="steps">
      <span class="step"><b>견습</b> Lv1~${D.constants.advanceLevel - 1} · 직업 기본 스킬 4개</span>${icon('chevron-right')}
      <span class="step"><b>1차 전직</b> Lv${D.constants.advanceLevel} · 섬의 촌장에게 갈래 선택(되돌릴 수 없음)</span>${icon('chevron-right')}
      <span class="step"><b>각성</b> Lv${D.constants.awakenLevel} · 선택 없이 4번 스킬 강화</span>${icon('chevron-right')}
      <span class="step"><b>2차 전직</b> Lv${D.constants.secondLevel} · 촌장에게 의식(갈래마다 정해진 상위 직업)</span>${icon('chevron-right')}
      <span class="step"><b>3차 전직</b> Lv${D.constants.thirdLevel} · 촌장에게 의식, 1~5번 칸 3차 스킬 · 3차 기본 공격 · 직업 기믹</span>
    </div>
    <p class="muted small" style="margin-top:10px">전직하면 2·3·4번 스킬이 갈래 전용 스킬로 바뀌고(공허술사·합주가·전투 시인처럼 1번 스킬까지 바뀌는 갈래도 있습니다) 패시브 능력치가 붙습니다. 2차 전직하면 1~4번 스킬이 모두 훨씬 강한 2차 스킬로 바뀌고 2차 패시브가 1차 패시브에 더해집니다. 3차 전직하면 1~4번 스킬이 모두 3차 스킬로 바뀌고 5번 칸에 궁극기가 생기며, 기본 공격이 갈래 전용 3차 기본 공격으로 바뀌고 걸음·주기·자동 사격으로 터지는 직업 기믹이 늘 켜집니다. 3차 패시브도 더해집니다. 궁극기 가운데 변신은 해골술사의 태고의 골신 하나뿐입니다(켜 둔 동안 거인이 되어 기본 공격이 훨씬 넓어지고 MP가 빠르게 닳습니다).</p>
    ${table(['직업', '갈래', '콘셉트', '패시브', '2차 전직', '2차 패시브', '3차 전직', '3차 패시브'], D.branches.map((b) => tr([esc(classOf(b.classId).name), `<a href="#/classes/${b.classId}#br-${b.id}" style="color:${esc(b.color)}">${esc(b.name)}</a>`, `<span class="small">${esc(b.concept)}</span>`, passiveText(b.passive), `<a href="#/classes/${b.classId}#br2-${b.id}" style="color:${esc(b.second.color)}">${esc(b.second.name)}</a>`, passiveText(b.second.passive), b.third ? `<a href="#/classes/${b.classId}#br3-${b.id}" style="color:${esc(b.third.color)}">${esc(b.third.name)}</a>` : '—', b.third ? passiveText(b.third.passive) : '—'])))}`;
}
function skillRow(s, compareTo) {
  if (!s) return '';
  const chips = [`<span class="chip">Lv${s.unlockLevel} 해금</span>`, `<span class="chip">${icon('clock')}${s.cdSec}초</span>`, `<span class="chip">${icon('droplet')}MP ${s.mpCost}</span>`];
  if (s.castSec) chips.push(`<span class="chip">시전 ${s.castSec}초</span>`);
  if (s.toggle) chips.push(`<span class="chip accent">켜기/끄기</span>`, `<span class="chip">${icon('droplet')}지속 마나 ${s.toggle.mpPctPerSec}%/초</span>`);
  if (s.awaken) chips.push('<span class="chip accent">각성</span>');
  if (s.second) chips.push('<span class="chip accent">2차</span>');
  if (s.third) chips.push(`<span class="chip accent">${s.slot === 5 ? (s.toggle ? '3차 궁극 변신' : '3차 궁극기') : '3차'}</span>`);
  const base = compareTo && compareTo.id !== s.id ? `<div class="muted small">기본: ${esc(compareTo.name)}</div>` : '';
  return `<div class="skill-row" id="sk-${esc(s.id)}">${skillIcon(s)}<div><b>${esc(s.name)}</b> <span class="slot" title="슬롯">${s.slot}</span>${base}<div class="meta">${chips.join('')}</div><div class="small">${esc(s.desc)}</div><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></div>`;
}
function pageClass(id) {
  const k = classOf(id);
  if (!k) return notFound();
  if (id === D.blacksmith.id) return pageBlacksmith(k);
  const brs = D.branches.filter((b) => b.classId === id);
  const basicLine = k.basic.kind === 'melee' ? `근접 ${k.basic.arc}° · 사거리 ${k.basic.range}` : `투사체 사거리 ${k.basic.range}`;
  const growthRows = k.growth.map((g) => tr([R(`Lv${g.level}`), R(`T${g.tier}`), R(fmt(g.atk)), R(fmt(g.maxHp)), R(fmt(g.maxMp))]));
  return `
    ${crumb('#/classes', '직업 목록')}
    <div class="detail-head">${k.icon ? `<img class="ico lg" src="${esc(k.icon)}" alt="">` : ''}<div><h1 style="color:${esc(k.color)}">${esc(k.name)}</h1>
      <div class="chips"><span class="chip">${esc(k.role)}</span><span class="chip">${DMG[k.dmgType]} 피해</span><span class="chip">치명타 ${k.critPct}%</span><span class="chip">직업 계수 공격 ×${k.classMul.atk} · HP ×${k.classMul.hp}</span></div></div></div>
    <div class="grid g2">
      <div class="card"><h3>레벨별 능력치(그 티어 일반 장비 7칸)</h3><p class="muted small">레벨마다 HP +${k.hpPerLevel} · 공격력 +${k.atkPerLevel} · MP +${k.mpPerLevel}씩 오릅니다. 표는 그 레벨 성장분에 그 레벨 티어의 일반 장비 7칸을 모두 끼고 직업 계수를 곱한 능력치입니다(강화·등급 제외).</p>${table([{ t: '레벨', c: 'r' }, { t: '장비 티어', c: 'r' }, { t: '공격력', c: 'r' }, { t: '최대 HP', c: 'r' }, { t: '최대 MP', c: 'r' }], growthRows)}</div>
      <div class="card"><h3>기본 공격</h3>
        <div class="skill-row">${skillIcon({ icon: k.basicIcon })}<div><b>기본 공격</b><div class="meta"><span class="chip">${icon('clock')}${k.basic.cdSec}초</span><span class="chip">MP 0</span></div><ul><li>${basicLine} · 계수 ${Math.round(k.basic.coef * 100)}%${k.basic.hits > 1 ? ` × ${k.basic.hits}타` : ''}</li></ul></div></div>
        <h3 style="margin-top:14px">견습 스킬</h3>
        ${k.skills.map((sid) => skillRow(M.skills.get(sid))).join('')}
      </div>
    </div>
    ${k.id === 'necromancer' ? summonSection() : ''}${k.id === 'bard' ? songSection() : ''}
    <h2>전직 갈래</h2>
    <div class="tree">
      <div class="tree-root card"><b>견습 ${esc(k.name)}</b><div class="muted small">Lv${D.constants.advanceLevel}에 하나 선택</div></div>
      <div class="tree-lines" aria-hidden="true"></div>
      <div>${brs.map((b) => `
        <div class="card branch" id="br-${b.id}" style="--c:${esc(b.color)}">
          <h3><span style="color:${esc(b.color)}">${esc(b.name)}</span> ${passiveText(b.passive)}</h3>
          <p class="muted small">${esc(b.concept)}</p>
          ${[...(b.skill1 ? [b.skill1] : []), ...b.skills, b.awaken].map((sid) => { const s = M.skills.get(sid); return skillRow(s, M.skills.get(k.skills[s.slot - 1])); }).join('')}
        </div>
        ${secondCard(k, b)}${thirdCard(b)}`).join('')}</div>
    </div>`;
}
/** 히든 직업 대장장이: 레벨 대신 숙련도, 제련 옵션, 증강. 되는 방법은 싣지 않는다 */
function pageBlacksmith(k) {
  const B = D.blacksmith;
  const top = B.ranks[B.ranks.length - 1];
  const bodyRows = k.growth.map((g) => tr([R(`Lv${g.level}`), R(`T${g.tier}`), R(fmt(g.atk)), R(fmt(g.maxHp)), R(fmt(g.maxMp))]));
  const rankRows = B.ranks.map((r) => tr([`<b>${esc(r.name)}</b>`, R(fmt(r.score)), esc(r.spec), R(`${r.lines}줄`), r.band, R(`${r.cost}%`), R(`×${r.reqMul}`), R(`${r.augs}개`), R(`${r.odds.silver}% · ${r.odds.gold}% · ${r.odds.prism}%`)]));
  const optRows = B.options.map((o) => tr([`<b>${esc(o.name)}</b>`, ...o.bands.map((b) => R(`${b.min}~${b.max}${o.unit}`)), `<span class="small">${o.slots.map((s) => KIND[s]).join(' · ')}</span>`]));
  const C = B.craft;
  const itemLink = (id) => `<a href="#/items/${id}">${esc(M.items.get(id)?.name ?? id)}</a>`;
  const recipeRows = C.recipes.map((r) => tr([`${islandLink(r.raidId)}<div class="muted small">Lv${r.reqLevel} · ${itemLink(r.outId)}</div>`, `${itemLink(r.boss)} ×${r.bossQty}`, `${itemLink(r.mat)} ×${r.matQty}`, R(r.scrolls), R(fmt(r.gold)), R(r.score)]));
  const atkRows = C.recipes.map((r) => tr([`<b>${esc(r.raidName)}</b>`, ...r.atk.map((a, i) => R(`${fmt(a)}<div class="muted small">레이드 ${fmt(r.baseAtk[i])}</div>`))]));
  const oddsRows = C.odds.map((o) => tr([`<b>${esc(o.name)}</b>`, R(fmt(o.score)), ...C.grades.map((g) => R(`${o.odds[g.id] >= 1 ? +o.odds[g.id].toFixed(1) : +o.odds[g.id].toFixed(2)}%`))]));
  return `
    ${crumb('#/classes', '직업 목록')}
    <div class="detail-head">${k.icon ? `<img class="ico lg" src="${esc(k.icon)}" alt="">` : ''}<div><h1 style="color:${esc(k.color)}">${esc(k.name)}</h1>
      <div class="chips"><span class="chip accent">히든 직업</span><span class="chip">${esc(k.role)}</span><span class="chip">${DMG[k.dmgType]} 피해</span><span class="chip">레벨 없음 · 숙련도 랭크</span></div></div></div>
    <p>망치로 동료의 장비를 제련하고 전투 중 증강 카드를 벼려 주는 지원 직업입니다. 서버에 한 사람씩 조용히 나타나는 히든 직업이며, 한 계정에 한 명만 될 수 있습니다.</p>
    <div class="grid g2">
      <div class="card"><h3>몸(레벨 없음)</h3><p class="muted small">레벨과 경험치가 없습니다. 레이드·던전은 입장 레벨, 필드는 그 섬의 기준 레벨에 맞춘 몸이 됩니다(그 티어 일반 장비 7칸 기준). 입장 레벨 제한을 받지 않고, 드랍과 레이드 보상은 그대로 받습니다. 결투는 하지 않고, 직접 주는 피해는 낮습니다.</p>${table([{ t: '기준 레벨', c: 'r' }, { t: '장비 티어', c: 'r' }, { t: '공격력', c: 'r' }, { t: '최대 HP', c: 'r' }, { t: '최대 MP', c: 'r' }], bodyRows)}</div>
      <div class="card"><h3>스킬</h3>
        ${k.skills.map((sid) => skillRow(M.skills.get(sid))).join('')}
        <p class="muted small" style="margin-top:8px">장비는 대장장이의 망치 하나뿐이고, 다른 장비는 낄 수 없습니다.</p>
      </div>
    </div>
    <h2 id="mastery">숙련도</h2>
    <p class="muted small">제련할 때마다 그 장비 티어 숫자만큼 오르고, 다른 사람의 장비(의뢰)는 랭크별 의뢰 배율을 곱합니다(낮은 랭크일수록 큽니다). 전문 구간보다 낮은 티어 장비는 한 랭크 아래 ×${B.overCap[1]}, 두 랭크 이상 아래 ×${B.overCap[2]}만 오릅니다. 레이드를 클리어하면 이 대장장이의 증강을 지닌 파티원 수만큼 더 오릅니다. 랭크 이름은 이름표 앞에 붙습니다.</p>
    <p class="muted small">전문 구간: 장비 티어마다 제련이 닿는 랭크 한도가 있어, 한도보다 높은 랭크가 제련해도 결과는 한도 랭크와 같습니다. 낮은 랭크일수록 제련 비용(베리·강화서·지역 재료)이 싸므로 낮은 티어 장비는 그 구간 대장장이에게 맡기는 편이 이득입니다.</p>
    ${table(['랭크', { t: '숙련도', c: 'r' }, '전문 구간', { t: '제련 줄 수', c: 'r' }, '옵션 값', { t: '비용', c: 'r' }, { t: '의뢰 숙련도', c: 'r' }, { t: '1인 증강', c: 'r' }, { t: '카드 은 · 금 · 프리즘', c: 'r' }], rankRows)}
    <h2 id="refine">제련 옵션</h2>
    <p class="muted small">장비 7칸 어디든 무작위 옵션을 1줄~랭크 최대 줄 수만큼 붙이고 각인을 남깁니다. 실패는 없고 강화·각성과는 따로입니다. 한 장비에 같은 옵션은 겹치지 않습니다. 이미 옵션이 있는 장비는 새 결과와 비교해 유지·교체를 고릅니다. 비용은 장비 순위 × ${fmt(B.cost.goldPerRank)} 베리, 강화서 ${B.cost.scrolls}장, 그 티어 지역 재료 ${B.cost.matQty}개에 위 표의 랭크별 비용 비율을 곱합니다(강화서·재료는 올림). ${esc(top.name)}는 ${esc(top.spec)} 장비에서 ${B.masterworkPct}% 확률로 줄 수·값이 모두 최대인 걸작 제련이 되고 서버 전체에 알려집니다. 공격 속도는 유물과 합쳐 ${B.fxCap.aspdPct}%, 재사용 대기 감소는 ${B.fxCap.cdrPct}%까지입니다.</p>
    ${table(['옵션', ...['하', '중', '상'].map((t) => ({ t: `값 ${t}`, c: 'r' })), '붙는 장비'], optRows)}
    <p class="muted small" style="margin-top:8px">제련 의뢰: 1:1 거래 거리 안에서 의뢰인이 장비 하나를 골라 신청하면, 대장장이가 회당 수고비와 최대 횟수를 먼저 제시하고 의뢰인이 받아들여야 시작됩니다. 신청 창과 제시 카드에서 그 대장장이가 붙일 수 있는 옵션과 값의 최소~최대를 볼 수 있습니다. 제련비·강화서·재료는 대장장이가 내고(한 번 할 만큼은 있어야 제시할 수 있습니다), 의뢰인은 실제로 제련한 횟수만큼 수고비만 냅니다(수고비에는 거래 수수료가 붙습니다). 장비는 의뢰인 가방에 잠긴 채로 남습니다. 제련한 장비는 거래소에 올릴 수 있고 옵션이 툴팁·살펴보기·매물에 보입니다.</p>
    <h2 id="craft">무기 제작</h2>
    <p class="muted small">노을마을 대장장이 NPC의 「무기 제작」에서 ${esc(C.baseMin)} 이상 레이드 무기(어느 직업이든, 가방에 있는 것) 하나를 녹이고 그 레이드의 보스 재료와 함께 새 무기를 벼립니다. 만들 무기의 직업은 대장장이가 고르고, 이름은 「대장장이 이름의 무기 종류」가 됩니다(예: 「철수의 대검」). 등급은 바탕 등급 아래로 나오지 않습니다 — ${esc(C.baseMin)} 바탕은 ${esc(C.baseMin)} 또는 유니크, 유니크 바탕은 늘 유니크입니다. ${esc(C.baseMin)} 바탕의 유니크 확률은 숙련도가 높을수록 오르고 ${C.uniqueCap}%를 넘지 않습니다. 바탕 무기의 강화·제련은 사라지고, 귀속·계정 귀속은 그대로 이어집니다. 만든 무기는 다시 강화·제련할 수 있습니다.</p>
    <p class="muted small">보스 재료는 각 레이드를 클리어할 때 한 사람마다 ${pct(C.drop)} 확률로 1개 떨어지고 귀속되지 않습니다.</p>
    ${table(['조합법(레이드)', '보스 재료', '지역 재료', { t: '강화서', c: 'r' }, { t: '베리', c: 'r' }, { t: '숙련도', c: 'r' }], recipeRows)}
    <h3>등급별 공격력(+0, 기사 무기)</h3>
    <p class="muted small">제작 무기는 같은 레이드 무기보다 한 단계 강하고, 유니크는 그보다 더 크게 오릅니다. 가장 높은 조합법의 유니크가 게임에서 가장 강한 무기입니다.</p>
    ${table(['조합법', ...C.grades.map((g) => ({ t: g.name, c: 'r' }))], atkRows, { scroll: true })}
    <h3>랭크별 등급 확률(${esc(C.baseMin)} 바탕)</h3>
    ${table(['랭크', { t: '숙련도', c: 'r' }, ...C.grades.map((g) => ({ t: g.name, c: 'r' }))], oddsRows)}
    <h2 id="buff">장비 손질</h2>
    <p class="muted small">「장비 손질」은 플레이어 대장장이에게 맡기는 일시 효과입니다. 대장장이를 눌러 플레이어 메뉴에서 「장비 손질」을 신청하면 대장장이가 수고비를 제시하고, 받아들이면 바로 손질됩니다. 손질 비용인 베리(받는 사람 레벨 티어 × ${fmt(B.buff.goldPerTier)})와 그 티어 지역 재료 ${B.buff.matQty}개는 대장장이가 내고, 받는 사람은 수고비만 냅니다(거래 수수료를 떼고 대장장이에게). 대장장이는 손질 한 번에 받는 사람 레벨 티어 장비의 의뢰 제련 한 번 숙련도의 ×${B.buff.scoreMul}을 얻습니다(전문 구간보다 낮은 티어면 제련처럼 깎입니다). 같은 손질을 다시 받으면 시간이 새로 채워지고(겹치지 않음), 두 가지는 함께 걸 수 있습니다. 죽거나 결투해도 사라지지 않고, 접속을 끊어도 시간은 흐릅니다.</p>
    ${table(['손질', '효과', { t: '지속', c: 'r' }], B.buff.list.map((b) => tr([`<b>${esc(b.name)}</b>`, b.kind === 'atk' ? `공격력 +${b.pct}%` : `경험치 +${b.pct}%`, R(`${b.min}분`)])))}
    <h2 id="augments">증강</h2>
    <p class="muted small">벼리기와 걸작은 무한 웨이브의 증강 카드 표를 씁니다. 카드 ${B.aug.choices}장 중 하나를 고르고, ${B.aug.pickSec}초 안에 고르지 않으면 가장 높은 등급이 자동으로 골라집니다. 증강은 레이드·던전을 나갈 때까지, 필드에서는 ${Math.round(B.aug.fieldSec / 60)}분 동안 남습니다. 한 사람이 같은 증강을 두 번 받을 수 없고, 무한 웨이브 증강 칸과는 따로입니다. 한 파티에는 대장장이 한 명의 증강만 적용됩니다. 망치질은 ${B.vuln.sec}초 동안 받는 피해를 ${B.vuln.pct}% 늘립니다.</p>
    <p class="muted small">대장장이는 거래소에서 살 수는 있지만 올릴 수는 없습니다. 베리는 자유롭게 오갑니다.</p>`;
}
/** 네크로맨서: 소환수 표와 공통 규칙 */
function summonSection() {
  const S = D.summons;
  const atk = (a) => `${a.kind === 'melee' ? `근접 ${a.arc === 360 ? '전방위' : `${a.arc}°`}` : `투사체${a.aoeR ? ` · 착탄 반경 ${a.aoeR} 폭발` : ''}`} · 사거리 ${a.range} · ${a.cdSec}초마다 · 계수 ${Math.round(a.coef * 100)}%`;
  const rows = S.list.map((s) => tr([
    `<b>${esc(s.name)}</b>`, `<span class="small">${atk(s.attack)}</span>`, R(`${s.hpPct}%`), R(`${s.lifeSec}초`),
    s.taunt ? `<span class="small">${s.taunt.everySec}초마다 반경 ${s.taunt.r} 적 ${s.taunt.sec}초 도발</span>` : '<span class="muted small">-</span>',
    `<span class="small">${s.callers.map((c) => `<a href="#/skills/${c.id}">${esc(c.name)}</a> ${c.n}기 <span class="muted">(${esc(c.stage)})</span>`).join('<br>')}</span>`,
  ]));
  return `
    <h2 id="summons">소환수</h2>
    <div class="card">
      <p class="muted small">소환수의 공격 한 번은 주인 마법 공격력 × 계수, 최대 HP는 주인 최대 HP × 비율입니다. 피해식과 치명타는 주인과 같습니다.</p>
      ${table(['소환수', '공격', { t: '최대 HP(주인 HP 대비)', c: 'r' }, { t: '유지 시간', c: 'r' }, '도발', '부르는 스킬'], rows)}
      <ul class="small" style="margin-top:10px">
        <li>한 사람이 부릴 수 있는 소환수는 <b>최대 ${S.max}기</b>입니다. 아홉 번째를 부르면 가장 오래된 소환수가 무너지고 새 소환수로 바뀝니다.</li>
        <li>주인이 쓰러지거나 다른 섬으로 옮기거나 접속을 끊으면 소환수가 모두 사라집니다. 유지 시간이 끝나거나 HP가 다해도 사라집니다.</li>
        <li>소환수가 준 피해와 처치, 경험치·드랍·퀘스트·레이드 지분은 모두 <b>주인에게</b> 갑니다.</li>
        <li>주인에게서 ${S.leash} 넘게 떨어지면 주인 곁으로 순간이동하고, 주인 반경 ${S.aggroR} 안의 적만 노립니다.</li>
        <li>소환수 피해는 일반 몬스터에게 ×${S.fieldMul}, 보스에게 ×${S.bossMul}입니다(주인 곁을 지키는 전투용, 서 있기만 해서 사냥터를 덮지 못하게).</li>
        <li>일반 몬스터는 도발을 당했을 때만 소환수를 노립니다. 보스는 도발이 통하지 않지만 광역 공격과 투사체에는 소환수도 맞습니다.</li>
        <li>소환수는 버프·디버프를 받지 않습니다.</li>
      </ul>
      ${S.empowers.length ? `<h3 style="margin-top:14px">소환수 강화</h3>${S.empowers.map((e) => `<div class="small"><a href="#/skills/${e.id}"><b>${esc(e.name)}</b></a> <span class="muted">(${esc(e.stage)})</span> — ${e.lines.map(esc).join(' · ')}</div>`).join('')}` : ''}
    </div>`;
}
/** 바드: 노래 표와 겹침 규칙·궁극기 */
function songSection() {
  const Sg = D.songs;
  const amt = (so, c) => (so.id === 'songCdr' ? `−${c.pct}%${c.cdCut ? ` · 즉시 ${c.cdCut}%` : ''}` : `+${c.pct}%`);
  const cards = Sg.list.map((so) => `
    <div class="card">
      <h3>${so.icon ? `<img class="ico sm" src="${esc(so.icon)}" alt=""> ` : ''}${esc(so.name)}</h3>
      <p class="muted small">${esc(so.effect)}</p>
      ${table(['스킬', '단계', { t: '수치', c: 'r' }, { t: '지속', c: 'r' }, { t: '반경', c: 'r' }], so.casts.map((c) => tr([`<a href="#/skills/${c.skillId}">${esc(c.skillName)}</a>`, `<span class="small">${esc(c.stage)}</span>`, R(amt(so, c)), R(`${c.sec}초`), R(c.r)])))}
    </div>`).join('');
  const ult = Sg.ultimates.map((u) => `<div class="skill-row" id="sk-${esc(u.id)}">${u.icon ? `<span class="ico lg"><img src="${esc(u.icon)}" alt=""></span>` : ''}<div><b><a href="#/skills/${u.id}">${esc(u.name)}</a></b> <span class="muted small">(${esc(u.stage)})</span><div class="meta"><span class="chip">${icon('clock')}${u.cdSec}초</span><span class="chip">${icon('droplet')}MP ${u.mpCost}</span></div><div class="small">${esc(u.desc)}</div><ul>${u.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></div>`).join('');
  return `
    <h2 id="songs">노래</h2>
    <p class="muted small">노래는 바드 자신을 포함해 반경 안 아군 플레이어 전원에게 걸리는 버프입니다. 슬롯마다 노래가 하나씩이고, 노래를 부르면 주변 적에게 음파 피해도 줍니다.</p>
    <div class="grid g2">${cards}</div>
    ${note('<b>겹침 규칙</b> — 같은 노래는 하나만 걸립니다. 바드 둘이 같은 노래를 불러도 쌓이지 않고 더 센 쪽만 남으며(같거나 더 세면 지속 시간만 갱신), 더 센 노래가 걸려 있는 동안 약한 노래는 덮어쓰지 못합니다. 서로 다른 노래끼리는 함께 걸리고, 다른 버프와도 곱해집니다.')}
    <h3 style="margin-top:14px">궁극기</h3>
    <div class="card">${ult}</div>`;
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
/** 3차 전직 카드: 이름·콘셉트·추가 패시브·스킬 4개(2차 스킬과 비교)·슬롯 5 궁극기·3차 기본 공격·직업 기믹 */
function thirdCard(b) {
  if (!b.third) return '';
  const t = b.third;
  return `<div class="card branch" id="br3-${b.id}" style="--c:${esc(t.color)}">
    <h3><span class="muted small">Lv${D.constants.thirdLevel} 3차</span> <span style="color:${esc(t.color)}">${esc(t.name)}</span> ${passiveText(t.passive)}</h3>
    <p class="muted small">${esc(t.concept)}</p>
    ${t.skills.map((sid, i) => skillRow(M.skills.get(sid), M.skills.get(b.second.skills[i]))).join('')}
    ${skillRow(M.skills.get(t.ult))}
    <div class="skill-row"><span class="ico ph">${icon('swords')}</span><div><b>${esc(t.basicName)}</b><div class="meta"><span class="chip accent">3차 기본 공격</span></div><div class="small">${esc(t.basicDesc)}</div></div></div>
    <div class="skill-row"><span class="ico ph">${icon('sparkles')}</span><div><b>${esc(t.gimmickName)}</b><div class="meta"><span class="chip accent">직업 기믹 · 늘 켜짐</span></div><div class="small">${esc(t.gimmickDesc)}</div></div></div>
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
      ${brs.map((b) => `<div class="card branch" style="--c:${esc(b.color)}"><h3><a href="#/classes/${k.id}#br-${b.id}" style="color:${esc(b.color)}">${esc(b.name)}</a> ${passiveText(b.passive)}</h3>${[...(b.skill1 ? [b.skill1] : []), ...b.skills, b.awaken].map((sid) => { const s = M.skills.get(sid); return skillRow(s, M.skills.get(k.skills[s.slot - 1])); }).join('')}</div>${secondCard(k, b)}${thirdCard(b)}`).join('')}
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
const itemState = { group: 'all', rarity: 'all', cls: 'all', q: '', sort: 'default', src: 'all' };
/** 얻는 곳 한 줄 요약(도감 목록 칸). 레이드 출처는 무한의 던전·레이드를 가른다 */
const SRC_LABEL = { shop: '상점', mob: '몬스터', rare: '등급 드랍', chest: '보물상자', worldBoss: '필드 보스', quest: '퀘스트', questDrop: '퀘스트 수집', premium: '고급 상자', gemShop: '젬 상점', legacy: '옛 장비', grant: '운영자 지급', cash: '현금 상점', guildRank: '길드 랭킹', craft: '대장장이 제작' };
function srcLabel(s) {
  if (s.type === 'raid') return s.raid === D.infinite.id ? '무한의 던전' : M.dungeons.has(s.raid) ? '일일 던전' : '레이드';
  if (s.type === 'market') return D.constants.market.name;
  return SRC_LABEL[s.type] ?? s.type;
}
const obtainable = (it) => it.sources.some((s) => s.type !== 'legacy' && s.type !== 'grant');
function pageItems() {
  const gone = D.items.filter((it) => !obtainable(it)).length;
  return `
    ${head('아이템 도감', `아이템 ${D.items.length}개 · 지금 얻을 수 있는 것 ${D.items.length - gone}개. 이름을 누르면 강화 수치와 얻는 곳이 나옵니다.`)}
    <div class="filters">
      <div class="seg" role="group" aria-label="종류" data-f="group">${Object.entries(ITEM_GROUPS).map(([k, [n]]) => `<button type="button" data-v="${k}" aria-pressed="${itemState.group === k}">${n}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="등급" data-f="rarity"><button type="button" data-v="all" aria-pressed="${itemState.rarity === 'all'}">전 등급</button>${RARITIES.map((r) => `<button type="button" data-v="${r}" aria-pressed="${itemState.rarity === r}" class="rar-${r}">${rarName(r)}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="얻는 곳" data-f="src">${[['all', '모두'], ['now', '지금 얻을 수 있음'], ['gone', '옛 장비·운영자 지급']].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${itemState.src === k}">${n}</button>`).join('')}</div>
    </div>
    <div class="filters">
      <select data-f="cls" aria-label="직업"><option value="all">모든 직업</option>${D.classes.map((c) => `<option value="${c.id}" ${itemState.cls === c.id ? 'selected' : ''}>${esc(c.name)}이 쓸 수 있는</option>`).join('')}</select>
      <select data-f="sort" aria-label="정렬"><option value="default">기본 순서</option><option value="level">착용 레벨 순</option><option value="atk">공격력 순</option><option value="hp">HP 순</option><option value="price">가격 순</option></select>
      <input class="field" type="text" data-f="q" placeholder="이름으로 거르기" value="${esc(itemState.q)}" aria-label="아이템 이름으로 거르기">
      <span class="count" id="item-count"></span>
    </div>
    <div id="item-list"></div>`;
}
function renderItemList() {
  const kinds = ITEM_GROUPS[itemState.group][1];
  let list = D.items.filter((it) => (!kinds || kinds.includes(it.kind)) && (itemState.rarity === 'all' || it.rarity === itemState.rarity) && (itemState.cls === 'all' || !it.classId || it.classId === itemState.cls) && (itemState.src === 'all' || (itemState.src === 'now') === obtainable(it)) && nameMatches(it.name, itemState.q));
  const key = itemState.sort;
  if (key === 'level') list = [...list].sort((a, b) => (a.reqLevel ?? 0) - (b.reqLevel ?? 0));
  else if (key !== 'default') list = [...list].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  document.getElementById('item-count').textContent = `${list.length}개`;
  const rows = list.map((it) => {
    const st = [it.atk && `공격 ${it.atk}`, it.hp && `HP ${it.hp}`, it.allStat && `올스탯 ${it.allStat}`, it.heal && `HP 회복 ${it.heal}`, it.mp && `MP 회복 ${it.mp}`].filter(Boolean).join(' · ');
    const where = [...new Set(it.sources.map(srcLabel))];
    return tr([itemLink(it.id), KIND[it.kind], `<span class="rar-${it.rarity}">${rarName(it.rarity)}</span>`, R(it.reqLevel ? `Lv${it.reqLevel}` : '—'), it.classId ? esc(classOf(it.classId).name) : '<span class="muted">공용</span>', `<span class="small">${st || '—'}</span>`, `<span class="small${obtainable(it) ? '' : ' muted'}">${where.length ? where.slice(0, 3).map(esc).join(' · ') + (where.length > 3 ? ` <span class="muted">외 ${where.length - 3}곳</span>` : '') : '—'}</span>`, R(it.price ? fmt(it.price) : '—')]);
  });
  document.getElementById('item-list').innerHTML = list.length ? table(['이름', '종류', '등급', { t: '착용', c: 'r' }, '직업', '능력치', '얻는 곳', { t: '가격', c: 'r' }], rows) : '<div class="empty-state">조건에 맞는 아이템이 없습니다.</div>';
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
  if (mob.length) {
    const grades = [...new Set(mob.map((s) => s.grades).filter(Boolean))].map((k) => `${k === 'fieldBoss' ? '섬 보스' : '필드 몬스터'} ${esc(D.constants.grades[`${k}Text`])}`);
    out.push(`<div class="card"><h3>몬스터 드랍</h3>${table(['몬스터', { t: '확률', c: 'r' }, { t: '개수', c: 'r' }], mob.map((s) => tr([mobLink(s.mob), R(pct(s.chance)), R(s.qty ? `${s.qty[0]}~${s.qty[1]}` : 1)])), { scroll: mob.length > 10 })}${grades.length ? `<p class="muted small" style="margin:8px 0 0">떨어질 때 등급을 굴립니다: ${grades.join(' / ')}</p>` : ''}</div>`);
  }
  const chest = by('chest');
  if (chest.length) out.push(`<div class="card"><h3>보물상자</h3>${table(['섬', { t: '확률', c: 'r' }], chest.map((s) => tr([islandLink(s.island), R(`${pct(s.chance)}${s.qty ? ` · ${s.qty[0]}~${s.qty[1]}개` : ''}`)])))}</div>`);
  const raid = by('raid');
  if (raid.length) out.push(`<div class="card"><h3>레이드</h3><ul class="plain">${raid.map((s) => `<li>${islandLink(s.raid)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  const wb = by('worldBoss');
  if (wb.length) out.push(`<div class="card"><h3>필드 보스 원정</h3><ul class="plain">${wb.map((s) => `<li>${islandLink(M.worldBosses.get(s.boss)?.islandId ?? s.boss)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  const quest = by('quest');
  if (quest.length) out.push(`<div class="card"><h3>퀘스트 보상</h3><ul class="plain">${quest.map((s) => `<li>${esc(M.quests.get(s.quest)?.name ?? s.quest)} ${s.note ? `— ${esc(s.note)}` : `×${s.qty}`}</li>`).join('')}</ul></div>`);
  const qdrop = by('questDrop');
  if (qdrop.length) out.push(`<div class="card"><h3>퀘스트 수집품</h3><ul class="plain">${qdrop.map((s) => `<li>${esc(M.quests.get(s.quest)?.name ?? s.quest)} 진행 중 ${mobLink(s.mob)}에게서 ${pct(s.chance)} (${s.n}개 필요)</li>`).join('')}</ul></div>`);
  const market = by('market');
  if (market.length) out.push(`<div class="card"><h3>${esc(D.constants.market.name)}</h3><ul class="plain">${market.map((s) => `<li>${esc(s.note)} · ${fmt(Math.round(it.price * D.constants.market.gradePriceMul.epic))} 베리</li>`).join('')}</ul></div>`);
  const gemShop = by('gemShop');
  if (gemShop.length) out.push(`<div class="card"><h3>${esc(npcNameOfRole('gem'))} (노을마을)</h3><ul class="plain">${gemShop.map((s) => `<li>${esc(D.gems.name)} ${s.gems}개</li>`).join('')}</ul></div>`);
  const premium = by('premium');
  if (premium.length) out.push(`<div class="card"><h3>고급 상자</h3><ul class="plain">${premium.map((s) => `<li>${pct(s.chance)} — ${esc(s.note)}</li>`).join('')}</ul></div>`);
  if (by('legacy').length) out.push(`<div class="card"><h3>더 이상 얻을 수 없음</h3><p>등급 개편 전 장비입니다. 이미 가진 사람을 위해 남아 있을 뿐, 드랍·상점·상자 어디에서도 나오지 않습니다. 지금은 티어 장비·레이드 세트의 같은 부위가 일반~유니크 등급으로 굴려져 나옵니다(<a href="#/drops">드랍률</a>).</p></div>`);
  const grant = by('grant');
  if (grant.length) out.push(`<div class="card"><h3>운영자 지급</h3><ul class="plain">${grant.map((s) => `<li>${esc(s.note)}</li>`).join('')}</ul><p class="muted small" style="margin:8px 0 0">드랍·상점·상자에서는 나오지 않습니다.</p></div>`);
  const cash = by('cash');
  if (cash.length) out.push(`<div class="card"><h3>현금 상점</h3><ul class="plain">${cash.map((s) => `<li>${esc(s.note)}</li>`).join('')}</ul><p class="muted small" style="margin:8px 0 0">드랍·상점·상자에서는 나오지 않습니다.</p></div>`);
  const guildRank = by('guildRank');
  if (guildRank.length) out.push(`<div class="card"><h3><a href="#/world#guild-rank">길드 랭킹 일일 보상</a></h3><ul class="plain">${guildRank.map((s) => `<li>${esc(s.note)}</li>`).join('')}</ul></div>`);
  const craft = by('craft');
  if (craft.length) out.push(`<div class="card"><h3><a href="#/classes/${D.blacksmith.id}#craft">대장장이 무기 제작</a></h3><ul class="plain">${craft.map((s) => `<li>${esc(s.note)}</li>`).join('')}</ul><p class="muted small" style="margin:8px 0 0">이름 앞에 만든 대장장이의 이름이 붙습니다(예: 「철수의 ${esc(it.name)}」).</p></div>`);
  if (!out.length) out.push('<div class="empty-state">지금은 게임 안에서 얻는 곳이 없습니다.</div>');
  return out.join('');
}
function pageItem(id) {
  const it = M.items.get(id);
  if (!it) return notFound();
  const c = D.constants;
  const equip = EQUIP.includes(it.kind);
  const tier = it.gearTier ? D.tiers[it.gearTier - 1] : undefined;
  const chips = [`<span class="chip">${KIND[it.kind]}</span>`, `<span class="chip rar-${it.rarity}">${rarName(it.rarity)}</span>`];
  if (tier) chips.push(`<span class="chip">T${tier.tier} ${esc(tier.set)}</span>`);
  else if (it.raidTier) chips.push(`<span class="chip" title="착용 레벨 티어보다 강한 레이드 세트">${esc(it.raidTier)}</span>`);
  if (equip && it.rank !== null) chips.push(`<span class="chip">장비 순위 ${it.rank}</span>`);
  if (it.reqLevel) chips.push(`<span class="chip">착용 Lv${it.reqLevel}</span>`);
  chips.push(`<span class="chip">${it.classId ? `${esc(classOf(it.classId).name)} 전용` : '공용'}</span>`);
  if (it.bound) chips.push(it.disposable ? '<span class="chip accent">귀속 · 거래 불가(판매·버리기 가능)</span>' : '<span class="chip accent">귀속</span>');
  const stats = [['공격력', it.atk], ['HP', it.hp], ['올스탯', it.allStat], ['HP 회복', it.heal], ['MP 회복', it.mp], ['구매가', it.price && fmt(it.price)], ['판매가', it.sell && fmt(it.sell)]].filter(([, v]) => v);
  let enh = '';
  if (equip) {
    const keys = [['atk', '공격력'], ['hp', 'HP']].filter(([k]) => it[k]);
    const rows = Array.from({ length: c.enhanceMax + 2 }, (_, lv) => {
      const g = gearStats(it, lv);
      return tr([R(lv > c.enhanceMax ? '<span style="color:var(--bad)">각성</span>' : `+${lv}`), ...keys.map(([k]) => R(fmt(g[k]))), R(lv < c.enhanceMax ? `${D.enhance[lv].rate}%` : lv === c.enhanceMax ? `각성 ${D.awaken.rate}% (실패마다 +${D.awaken.step}%)` : '—'), R(lv < c.enhanceMax ? `${fmt(Math.round(D.enhance[lv].goldPerRank * it.rank))} 베리 + 강화서 ${D.enhance[lv].scrolls}장` : lv === c.enhanceMax ? `${fmt(D.awaken.tiers[0].gold * it.rank)} 베리 + 강화서 ${D.scrolls.awaken}장` : '—')]);
    });
    const gradeIds = c.grades.list.map((x) => x.id);
    const gradeRows = it.mul ? c.grades.list.filter((r) => gradeIds.indexOf(r.id) <= gradeIds.indexOf(it.maxGrade)).map((r) => { const g = gearStats(it, 0, r.id); return tr([`<span class="rar-${r.id}">${esc(r.name)}</span>`, R(`×${it.mul[r.id]}`), ...keys.map(([k]) => R(fmt(g[k])))]); }) : [];
    const gradeTable = gradeRows.length ? `<h3>등급별 수치 (+0)</h3>${table(['등급', { t: '배율', c: 'r' }, ...keys.map(([, n]) => ({ t: n, c: 'r' }))], gradeRows)}<p class="muted small">이 장비는 ${esc(rarName(it.maxGrade))} 등급까지 합성할 수 있습니다. 같은 장비·같은 등급 세 개를 대장장이에게서 <a href="#/growth#merge">합성</a>하면 한 등급 위가 됩니다.</p>` : '';
    enh = `<h2>강화 수치</h2><p class="muted small">${rarName(it.rarity)} 등급 기준(×${it.mul?.[it.rarity] ?? c.rarityMul[it.rarity]}). 단계당 +${pct(c.enhanceBonusPer[it.kind])}, 각성은 +${c.enhanceMax} 배율의 ×${D.awaken.mul}. 비용·성공률은 그 단계에서 다음 단계로 올릴 때 값입니다(장비 순위 ${it.rank} 기준).</p>${table([{ t: '단계', c: 'r' }, ...keys.map(([, n]) => ({ t: n, c: 'r' })), { t: '다음 성공률', c: 'r' }, { t: '비용', c: 'r' }], rows)}${gradeTable}`;
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
  document.getElementById('mob-list').innerHTML = table(['이름', '종류', { t: 'HP', c: 'r' }, { t: '공격력', c: 'r' }, { t: '경험치', c: 'r' }, '지역', '선공'], list.map((m) => tr([mobLink(m.id), MOB_KIND[m.kind], R(fmt(m.hp)), R(fmt(m.atk)), R(fmt(m.exp)), m.islands.map(islandLink).join(', '), m.aggro === 'aggressive' ? '<span style="color:var(--bad)">선공</span>' : '<span class="muted">비선공</span>'])));
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
  const stats = [['레벨', m.level], ['HP', fmt(m.hp)], ['공격력', fmt(m.atk)], ['공격 계수', `${Math.round(atk.coef * 100)}%`], ['공격 간격', `${atk.cdSec}초`], ['공격 방식', atk.kind === 'melee' ? `근접 ${atk.range}` : `원거리 ${atk.range}`], ...(m.skill ? [['특수 공격', `${esc(m.skill.name)} · ${m.skill.at === 'self' ? '제자리' : '대상 발밑'} 반경 ${Math.round(m.skill.r * 10) / 10} · ${m.skill.warnSec}초 예고 · 계수 ${Math.round(m.skill.coef * 100)}% · ${Math.round(m.skill.cdSec * 10) / 10}초마다`]] : []), ['이동 속도', m.speed], ['경험치', fmt(m.exp)], ['리스폰', m.respawnSec ? `${m.respawnSec >= 60 ? `${m.respawnSec / 60}분` : `${m.respawnSec}초`}` : '—']];
  const lootRows = [...m.loot.entries].sort((a, b) => b.chance - a.chance).map((e) => tr([itemLink(e.itemId), R(pct(e.chance)), R(e.qty ? `${e.qty[0]}~${e.qty[1]}` : 1), R(`<span class="muted small">${oneIn(e.chance)}</span>`)]));
  const gearIds = m.loot.entries.filter((e) => EQUIP.includes(M.items.get(e.itemId)?.kind));
  const gearP = 1 - gearIds.reduce((p, e) => p * (1 - e.chance), 1);
  const gearNote = gearIds.length ? `<p class="small" style="margin-top:10px">장비: T${m.gearTier} ${esc(D.tiers[m.gearTier - 1]?.set ?? '')} 11종 중 하나 이상 ${pct(gearP)}(항목마다 따로 굴림). 떨어질 때 등급을 굴립니다: ${esc(m.gearGrades === 'fieldBoss' ? D.constants.grades.fieldBossText : D.constants.grades.fieldText)}</p>` : '';
  const raid = D.raids.find((r) => r.bossId === m.id);
  const wb = D.worldBosses.find((w) => w.bossId === m.id);
  return `
    ${crumb('#/mobs', '몬스터 도감')}
    <div class="detail-head"><span class="ico lg ph">${icon(m.kind === 'field' ? 'skull' : 'crown', 'i')}</span><div><h1>${esc(m.name)}</h1><div class="chips"><span class="chip">${MOB_KIND[m.kind]}</span><span class="chip" ${m.aggro === 'aggressive' ? 'style="color:var(--bad)"' : ''}>${m.aggro === 'aggressive' ? '선공' : '비선공'}</span>${m.islands.map((i) => `<span class="chip">${islandLink(i)}</span>`).join('')}</div></div></div>
    <dl class="stats">${stats.map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${raid ? `<p style="margin-top:12px">${islandLink(raid.id)}의 보스입니다. 보상은 레이드 클리어 보상으로 나옵니다.</p>` : ''}
    ${wb ? `<p style="margin-top:12px">${islandLink(wb.islandId)}의 원정 필드 보스입니다. 처치 때 기여 지분(피해 + 치유) ${wb.minSharePct}% 이상인 사람만 <a href="#/world#wb-${esc(wb.id)}">원정 보상</a>을 받습니다.</p>` : ''}
    ${m.kind === 'boss' ? `<p style="margin-top:12px">${rubyLine('island_boss')} <a href="#/drops#ruby">루비 드랍표</a></p>` : ''}
    <h2>드랍표 <span class="muted small">베리 ${fmt(m.loot.gold[0])}~${fmt(m.loot.gold[1])}</span></h2>
    ${table(['아이템', { t: '확률', c: 'r' }, { t: '개수', c: 'r' }, { t: '', c: 'r' }], lootRows)}
    ${gearNote}
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
    case 'level': return `Lv ${o.n} 달성`;
    default: return esc(o.k);
  }
}
/** 퀘스트 표(이름·NPC · 최소 레벨 · 목표 · 보상) — 섬 카드와 고양이 의뢰가 쓴다 */
function questTable(quests) {
  return table(['퀘스트', { t: 'Lv', c: 'r' }, '목표', '보상'], quests.map((q) => tr([`${esc(q.name)}${q.side ? ' <span class="chip">곁가지</span>' : ''}<div class="muted small">${esc(q.npc)}</div>`, R(q.minLevel), `<span class="small">${q.objectives.map(objectiveText).join('<br>')}</span>`, `<span class="small">경험치 ${fmt(q.rewards.exp)} · ${fmt(q.rewards.gold)} 베리${(q.rewards.items ?? []).map((i) => `<br>${esc(M.items.get(i.itemId)?.name ?? i.itemId)} ×${i.qty}`).join('')}${q.rewards.gear ? `<br>${questGearText(q.rewards.gear)}` : ''}</span>`])));
}
function pageWorld() {
  const islands = D.islands.map((isl) => {
    const elite = isl.mobs.map((id) => M.mobs.get(id)).find((m) => m?.kind === 'elite');
    const normal = isl.mobs.map((id) => M.mobs.get(id)).filter((m) => m && m.kind === 'field');
    const quests = isl.quests.map((q) => M.quests.get(q));
    return `
      <section class="card" id="isl-${isl.id}">
        <h2 style="margin-top:0">${esc(isl.name)} ${isl.hub ? '<span class="chip accent">모항 · 시작 마을</span> <span class="chip">사냥터 없음</span>' : `<span class="chip">Lv${isl.levelRange[0]}~${isl.levelRange[1]}</span> <span class="chip">입장 Lv${isl.minLevel}</span>`} <span class="chip">상점 ${isl.shopTiers.map((t) => `T${t}`).join('·')}</span></h2>
        <div class="grid g2">
          <div>
            ${isl.hub ? `<p class="small">새 캐릭터가 처음 서는 마을입니다. 대장간·잡화점·창고·젬 상점이 모여 있고, 레이드·일일 던전·필드 보스 원정은 모두 <b>선술집 주인</b>에게서 출발합니다. 귀환 두루마리를 쓰면 이 마을 부두로 돌아옵니다. 광장 모닥불가에 둘러앉을 수 있고, 음유시인은 류트 연주를 할 수 있습니다.</p>` : `<h3>몬스터</h3>
            <ul class="plain">${normal.map((m) => `<li>${mobLink(m.id)}</li>`).join('')}
              ${elite ? `<li><span class="chip">정예</span> ${mobLink(elite.id)} · ${D.constants.elite.respawnSec / 60}분마다</li>` : ''}
              ${isl.bossId ? `<li><span class="chip accent">필드 보스</span> ${mobLink(isl.bossId)} · ${D.constants.bossRespawnSec}초마다</li>` : ''}</ul>`}
            <h3 style="margin-top:12px">NPC</h3>
            <p class="small">${isl.npcs.map((n) => `${esc(n.name)} <span class="muted">(${ROLE[n.role] ?? n.role})</span>`).join(' · ')}</p>
            ${isl.hub ? '' : `<p class="small muted">보물상자 ${isl.chests}개 · 상자 보상은 <a href="#/drops">드랍률</a> 참고</p>`}
          </div>
          <div>
            <h3>상점</h3>
            <div class="chips">${isl.shop.map((id) => { const it = M.items.get(id); return `<a class="chip" href="#/items/${id}">${esc(it?.name ?? id)}</a>`; }).join('')}</div>
          </div>
        </div>
        ${quests.length ? `<details style="margin-top:12px"><summary>퀘스트 ${quests.length}개 (곁가지 의뢰 ${quests.filter((q) => q.side).length}개 — 섬 안내인이 주는 선택 퀘스트, 한 번씩)</summary>${questTable(quests)}</details>` : ''}
      </section>`;
  }).join('');
  const raids = D.raids.map((r) => `
    <section class="card" id="raid-${r.id}">
      <h2 style="margin-top:0">${esc(r.name)} <span class="chip">입장 Lv${r.minLevel}</span>${r.guild ? ' <span class="chip">길드 레이드</span>' : ''} <span class="chip">${r.minParty === 1 ? '혼자' : r.minParty}~${r.size}인</span> <span class="chip">제한 ${r.timeLimitSec / 60}분</span>${r.cooldownSec ? ` <span class="chip">클리어 뒤 재입장 ${Math.round(r.cooldownSec / 60)}분</span>` : ''}</h2>
      <p>보스: ${mobLink(r.bossId)} · HP ${fmt(M.mobs.get(r.bossId)?.hp ?? 0)}${r.bossHpScale ? ` × (${r.bossHpScale.base} + ${r.bossHpScale.perExtra} × (입장 인원 − ${r.bossHpScale.from ?? 1}${(r.bossHpScale.from ?? 1) > 1 ? ', 0 미만이면 0' : ''}))` : ''}${r.guideIsland ? ` · ${islandLink(r.guideIsland)}의 레이드 안내인에게서 출발` : ''}</p>
      ${r.guild ? '<p class="small">길드장·부길드장이 출발을 요청하면 접속한 길드원 전원(입장 레벨 이상·재입장 대기 아님)에게 준비 확인이 갑니다. 어느 섬에 있든 준비 완료를 누르면 바로 들어가고, 끝나면 각자 있던 섬으로 돌아옵니다. 보스는 뛰어올라 내리꽂고(도약) 직선으로 돌진하며, 보스 품이 안전한 고리(도넛) 패턴이 있습니다.</p>' : '<p class="small">레이드 창의 <b>레이드 파티</b>에서 이 레이드를 함께 갈 사람을 따로 모으거나(모집 글) 다른 사람의 레이드 파티에 참가할 수 있습니다. 레이드 파티에 있으면 출발할 때 필드 파티 대신 레이드 파티로 가고, 필드 파티는 그대로 남습니다. 레이드 파티가 없으면 필드 파티(없으면 혼자)로 출발합니다. 일일 던전·무한의 던전도 같습니다.</p>'}
      <p class="small">혼자 입장해 클리어하면 보상(베리·경험치·아이템 수량·장비/희귀/유니크 확률)이 ×${r.soloMul}입니다. 2명 이상이면 그대로입니다.</p>
      ${table(['페이즈', { t: '보스 HP', c: 'r' }, '패턴'], r.phases.map((p) => tr([`${p.phase}`, R(`${p.fromHpPct}% 이하`), esc(p.label) + (p.lethal ? ' <span class="small">· 즉사 패턴</span>' : '') + (p.debuffs?.length ? `<br><span class="small">맞으면: ${p.debuffs.map(esc).join(' · ')}</span>` : '')])))}
      ${r.enrage ? `<p class="small" style="margin-top:8px">격노: 시작 ${r.enrage.afterSec / 60}분 뒤 보스 피해 ×${r.enrage.damageMultiplier}</p>` : ''}
      <h3>보상 (참가자 전원)</h3>
      <ul class="plain small">
        <li>경험치 ${fmt(r.rewards.exp)} · ${fmt(r.rewards.gold)} 베리 · ${r.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ×${i.qty}`).join(', ')}${r.rewards.byLevel ? ` (입장 레벨 Lv${r.minLevel} 기준 — <b>받는 사람 레벨에 맞춰 늘어남</b>: 베리 ×(내 레벨 ÷ ${r.minLevel}), 아이템 ×(1 + 내 레벨 ÷ ${r.minLevel}) ÷ 2, 경험치는 내 레벨의 한 레벨 몫 비율만큼)` : ''}</li>
        <li>${r.rewards.gearChance >= 1 ? '<b>반드시</b>' : `${pct(r.rewards.gearChance)} 확률로`} ${esc(D.raidSets.find((s) => s.raidId === r.id)?.prefix ?? '이 보스')} 세트 1점(${r.rewards.gearPool.length}종 중 내가 쓸 수 있는 것, 첫 클리어는 자기 직업 무기). 등급: ${esc(D.constants.grades.raidText)}</li>
        <li>${rubyLine('raid')}</li>
        ${growthLine(r.growth, `입장 레벨(Lv${r.minLevel})`, '모든 레이드 합산, 혼자 도전해도 그대로')}
        ${r.rewards.firstClearUnique ? '<li><b>캐릭터마다 처음 깰 때 한 번</b>: 이 레이드 세트 중 내 직업 무기 + 직업 무관 부위에서 원하는 1개를 골라 <b>유니크 등급</b>으로 받습니다(귀속 아님). 가방이 차 있거나 창을 닫아도 다음에 접속할 때 다시 고를 수 있습니다. 서버 최초 칭호는 없습니다.</li>' : ''}
      </ul>
    </section>`).join('');
  const worldBosses = D.worldBosses.map((w) => `
    <section class="card" id="wb-${w.id}">
      <h2 style="margin-top:0">${esc(w.name)} <span class="chip">누구나 참여</span> <span class="chip">처치 뒤 ${w.respawnSec / 60}분마다</span></h2>
      <p>보스: ${mobLink(w.bossId)} · HP ${fmt(M.mobs.get(w.bossId)?.hp ?? 0)} · 노을마을 선술집 주인에게서 「원정」으로 건너갑니다. 파티 · 인원 제한이 없습니다.</p>
      <p><b>1인 피해 한도</b>: 한 사람이 깎을 수 있는 보스 HP는 최대 HP의 ${w.maxDamagePct}%까지입니다. 넘은 피해는 들어가지 않으므로 최소 ${Math.ceil(100 / w.maxDamagePct)}명이 모여야 잡을 수 있습니다. 한도에 닿은 뒤에도 무력화 타수는 채울 수 있고, 치유 기여는 한도가 없습니다.</p>
      ${table(['페이즈', { t: '보스 HP', c: 'r' }, '패턴'], w.phases.map((p) => tr([`${p.phase}`, R(`${p.fromHpPct}% 이하`), esc(p.label)])))}
      ${w.enrage ? `<p class="small" style="margin-top:8px">격노: 교전 ${w.enrage.afterSec / 60}분 뒤 보스 피해 ×${w.enrage.damageMultiplier}</p>` : ''}
      <h3>보상 (처치 때 기여 지분 ${w.minSharePct}% 이상인 사람 — 기여 = 피해 + 치유 × ${D.constants.worldBossHealWeight})</h3>
      <ul class="plain small">
        <li>${fmt(w.rewards.gold)} 베리 · 경험치(${levelShare(pct(w.rewards.expLevelFrac))}) · ${w.rewards.items.map((i) => `${esc(M.items.get(i.itemId)?.name)} ${i.qty[0]}~${i.qty[1]}개`).join(', ')}</li>
        ${w.rewards.legendaryChance ? `<li>${pct(w.rewards.legendaryChance)} 확률로 내 레벨 티어 장비 부위 1점을 전설 등급으로</li>` : ''}
        <li>젬 ${w.rewards.gems[0]}~${w.rewards.gems[1]}개(보상을 받는 사람 모두)</li>
        ${growthLine(w.growth, `보스 레벨(Lv${w.growth.level})`, '보상을 받은 처치만 셈')}
        <li>지분이 모자라면 보상이 없습니다. 전투 중 보스 바 아래에 내 지분·순위와 내 피해(한도 대비)가 보입니다.</li>
      </ul>
    </section>`).join('');
  const inf = D.infinite;
  const infCard = `
    <section class="card" id="raid-${inf.id}">
      <h2 style="margin-top:0">${esc(inf.name)} <span class="chip">입장 Lv${inf.minLevel}</span> <span class="chip">혼자~${inf.size}인</span> <span class="chip">최대 ${inf.maxWave}웨이브</span> <span class="chip">재입장 대기 없음</span></h2>
      <p>노을마을 선술집 주인의 레이드 목록에서 출발합니다(파티 없이 혼자도 가능). ${inf.firstWaveSec}초 뒤 1웨이브가 몰려오고, 투기장의 몬스터를 모두 쓰러뜨리면 웨이브 클리어 → ${inf.breakSec}초 쉬고 다음 웨이브. ${inf.bossEvery}웨이브마다 보스(호위 ${inf.bossEscorts})가 나옵니다. <b>${inf.maxWave}웨이브를 넘기면 완주</b>로 도전이 끝나고 잠시 뒤 원래 자리로 돌아갑니다.</p>
      <p class="small">몬스터 수치는 웨이브마다 곱으로 커집니다: HP ${fmt(inf.scaling.hp)} × ${inf.scaling.hpGrowth}^(웨이브−1), 공격력 ${inf.scaling.atk} × ${inf.scaling.atkGrowth}^(웨이브−1). 보스 = HP ×${inf.scaling.bossHpMul} · 공격력 ×${inf.scaling.bossAtkMul}. 처치 경험치·처치 드랍은 없습니다(보상은 웨이브 클리어 때).</p>
      ${inf.bossTimeSec ? `<p class="small"><b>보스 웨이브 제한 시간 ${Math.round(inf.bossTimeSec / 60)}분</b>: 보스가 나온 순간부터 화면 위 웨이브 표시에 남은 시간이 흐릅니다. 그 안에 웨이브를 정리하지 못하면 남은 몬스터가 사라지고 도전이 끝납니다(그 보스 웨이브는 기록·보상에 들지 않고, 앞 웨이브까지의 보상·기록은 그대로).${inf.finalBoss ? ` 마지막 ${inf.maxWave}웨이브 보스는 천공의 왕좌의 ${mobLink(inf.finalBoss)}(같은 패턴, 수치는 웨이브 공식)입니다.` : ''}</p>` : ''}
      ${table([{ t: '웨이브', c: 'r' }, { t: '몬스터', c: 'r' }, { t: 'HP', c: 'r' }, { t: '공격력', c: 'r' }, '보스', { t: '클리어 베리', c: 'r' }, { t: '경험치', c: 'r' }, { t: '강화서', c: 'r' }, { t: esc(D.gems.name), c: 'r' }], inf.waves.map((w) => tr([R(w.wave), R(w.count), R(fmt(w.mob.hp)), R(fmt(w.mob.atk)), w.bossId ? `${mobLink(w.bossId)} <span class="muted small">HP ${fmt(w.bossStats.hp)} · 공격력 ${fmt(w.bossStats.atk)}</span>` : '', R(fmt(w.gold)), R(pct(w.expPct)), R(w.scrolls || ''), R(pct(w.gem.chance))])), { scroll: true })}
      <h3>보상 (웨이브를 넘길 때마다 투기장 안 전원)</h3>
      <ul class="plain small">
        <li>${fmt(inf.rewards.gold)} × ${inf.rewards.goldGrowth}^(웨이브−1) 베리 · 경험치(${levelShare(`${pct(inf.rewards.expPct)} × (1 + ${inf.rewards.expGrowth} × (웨이브−1))`)} — <b>높은 웨이브일수록 많이</b>) · 보스 웨이브는 ${itemLink(D.scrolls.id)}(${inf.bossEvery}웨이브마다 ${inf.rewards.scrollsPerBoss}장씩 늘어남)</li>
        <li>${esc(D.gems.name)}: 웨이브마다 ${pct(D.gems.drop.wave.chance)}, <b>${D.gems.drop.wave.highFromWave}웨이브부터 ${pct(D.gems.drop.wave.high)}</b>(보스 웨이브는 ×${D.gems.drop.wave.bossMul})</li>
        <li>${rubyLine('infinite')}</li>
        <li>지역 재료: 웨이브마다 ${pct(inf.mat.wave)}, 보스 웨이브 ${pct(inf.mat.boss)} 확률로 ${inf.mat.qty[0]}~${inf.mat.qty[1]}개(보스 웨이브는 2배, 한 명마다 따로). 층 티어(${inf.gear.floorsPerTier}층마다 한 티어, 내 레벨 티어까지)에서 <b>아래로 ${inf.mat.spread}티어 사이</b> 무작위 티어의 지역 재료(대장장이 제련 재료)가 나옵니다.</li>
        <li>티어 장비: 웨이브마다 ${pct(inf.gear.chance.wave)}, 보스 웨이브 ${pct(inf.gear.chance.boss)} 확률로 1점(한 명마다 따로). <b>${inf.gear.floorsPerTier}층마다 한 티어씩</b> 올라갑니다: 1~${inf.gear.floorsPerTier}층은 T1(${esc(D.tiers[0].set)}), ${inf.gear.floorsPerTier + 1}~${inf.gear.floorsPerTier * 2}층은 T2(${esc(D.tiers[1].set)}) … T${D.tiers.length}까지. 다만 <b>내 레벨 티어를 넘지 않습니다</b>. 등급: ${esc(inf.gear.gradesText)}</li>
        <li>레이드 세트 장비: <b>${inf.gear.raidRoll.fromWave}웨이브부터</b> 웨이브 클리어마다 내가 입장할 수 있는 가장 높은 레이드 세트에서 ${rarName('legendary')} ${pct(inf.gear.raidRoll.legendary)} · ${rarName('unique')} ${pct(inf.gear.raidRoll.unique)}를 따로 굴립니다. <b>유니크는 10웨이브마다 ${pct(inf.gear.raidRoll.uniquePer10)}씩 오릅니다</b>(${inf.gear.raidRoll.fromWave + 10}웨이브 ${pct(inf.gear.raidRoll.unique + inf.gear.raidRoll.uniquePer10)} …).</li>
        <li><b>서버 최초로 ${inf.firstClearWave}웨이브를 넘긴 파티 전원</b>에게 내 레벨 티어 장비 부위 1점을 유니크 등급으로(한 번뿐)</li>
        ${inf.completeTitle ? `<li><b>서버 최초로 ${inf.maxWave}웨이브를 완주한 파티 전원</b>에게 칭호 <b style="color:${esc(inf.completeTitle.color)}">「${esc(inf.completeTitle.name)}」</b>(한 번뿐 · 랭킹에 최초 완주 기록이 남습니다)</li>` : ''}
        <li>라이프 토큰 ${inf.lifeTokens}개 · 투기장 안 전원이 한꺼번에 쓰러지면 도전이 끝납니다. 웨이브 보상과 기록은 웨이브마다 바로 남습니다.</li>
        <li>싸우다 접속이 끊겨도 ${Math.round(inf.rejoinSec / 60)}분 안에 다시 들어오면 그 던전으로 돌아갑니다(남은 토큰·증강·보상 합계 그대로, 레이드도 같습니다).</li>
        <li>랭킹: 메뉴 › 랭킹 › 무한의 던전 — 같은 파티 구성마다 최고 기록(웨이브 → 걸린 시간 순)</li>
      </ul>
    </section>`;
  const aug = D.augment;
  const augCard = `
    <section class="card" id="raid-${aug.id}">
      <h2 style="margin-top:0">${esc(aug.name)} <span class="chip">베타</span> <span class="chip">입장 Lv${inf.minLevel}</span> <span class="chip">혼자~${inf.size}인</span></h2>
      <p>${esc(inf.name)}와 같은 투기장·웨이브·보상 규칙(${inf.maxWave}웨이브에서 완주)에 <b>${aug.every}웨이브를 넘길 때마다 증강 카드 3장 중 1장</b>을 고릅니다(${aug.pickSec}초 안에, 다시 뽑기 ${aug.rerolls}회, 시간이 지나면 무작위). 모두 고를 때까지 다음 웨이브를 기다립니다. 증강은 이번 도전 동안만 유지되고 투기장을 나가면 사라집니다. 같은 증강은 한 번만 가질 수 있습니다.</p>
      <p class="small">베타: 랭킹·서버 최초 돌파 보상·완주 칭호는 없고 개인 최고 기록만 따로 남습니다.</p>
      ${table(['선택', ...Object.values(aug.tierNames).map((n) => ({ t: esc(n), c: 'r' }))], aug.odds.map((o, i) => tr([`${(i + 1) * aug.every}웨이브${i === aug.odds.length - 1 ? '부터' : ''}`, R(`${o.silver}%`), R(`${o.gold}%`), R(`${o.prism}%`)])))}
      ${table(['증강', '등급', '효과'], aug.list.map((a) => tr([esc(a.name), esc(aug.tierNames[a.tier]), esc(a.desc)])))}
    </section>`;
  const du = D.duel;
  const duelCard = `
    <section class="card" id="duel">
      <h2 style="margin-top:0">${esc(du.name)} <span class="chip">PvP</span> <span class="chip">입장 Lv${du.minLevel}</span> ${du.modes.map((m) => `<span class="chip">${esc(m.name)}</span>`).join(' ')}</h2>
      <p>메뉴(ESC) › 결투장에서 모드별로 <b>매칭</b>을 시작하거나, 다른 플레이어에게 <b>결투 신청</b>을 보냅니다(우클릭 메뉴 · 접속자 목록 · 채팅 <code>/결투 이름</code>, 3 대 3은 <code>/결투3 이름</code>).</p>
      <ul class="plain small">
        <li>점수: 모드마다 따로, 처음 ${du.ratingStart}점. 매칭 경기만 점수가 바뀝니다(Elo, K=${du.eloK}, 편 평균 점수끼리 · 최저 ${du.ratingMin}점).</li>
        <li>매칭: 점수 차 <b>${du.matchRange}점 이내</b>끼리만 잡힙니다(기다려도 범위가 넓어지지 않습니다). 3 대 3은 혼자 또는 파티장이 3명 이하 파티째로 들어가고, 한 경기에 든 모든 대기 묶음(파티는 파티원 평균)이 서로 ${du.matchRange}점 이내여야 합니다.</li>
        <li>결투 신청(친선): 점수와 무관하게 싸우고 점수·전적이 바뀌지 않습니다. 1 대 1은 누구에게나, 3 대 3은 3명 파티의 파티장이 상대 3명 파티에게(상대 파티장이 받습니다). 응답 시간 ${du.challengeSec}초.</li>
        <li>경기: 입장하면 HP·MP가 가득 차고 버프가 지워집니다. ${du.countdownSec}초 뒤 시작, 제한 시간 ${du.modes.map((m) => `${esc(m.name)} ${m.timeLimitSec / 60}분`).join(' · ')}.</li>
        <li>승패: 상대 편 전원을 쓰러뜨리면 승리. 제한 시간이 끝나면 남은 HP 비율 합이 큰 편이 이기고, 같으면 무승부. 도중에 나가거나 접속을 끊으면 그 사람은 패배로 처리됩니다.</li>
        <li>규칙: 플레이어끼리 주는 피해 ${pct(du.damageMul)}, 치유·보호막 ${pct(du.healMul)}. 물약과 자연 회복은 없습니다. 쓰러지면 경기가 끝날 때까지 부활할 수 없고 관전합니다.</li>
        <li>끝나면 ${du.resultSec}초 뒤 모두 원래 자리로 돌아가고, 쓰러진 사람도 되살아납니다.</li>
      </ul>
    </section>`;
  const gr = D.guildRank;
  const sc = gr.score;
  const gsh = D.guildShop;
  const lv = (r) => `${r.base} + 레벨 × ${r.perLevel}`;
  const guildRankCard = `
    <section class="card" id="guild-rank">
      <h2 style="margin-top:0">길드 점수·랭킹 일일 보상 <span class="chip">매일 0시(한국 시간)</span> <span class="chip">우편 + 길드 금고</span></h2>
      <p>길드원이 아래 활동을 하면 <b>오늘 길드 점수</b>가 쌓입니다. 메뉴(ESC) › 랭킹 › 길드 랭킹은 <b>오늘 길드 점수 → 길드원 레벨 합 → 인원 → 이름</b> 순입니다. 매일 0시에 그날 점수 순위로 아래 보상을 <b>길드원 모두</b>에게 우편으로, ${esc(gr.coinName)}는 <b>길드 금고</b>로 보낸 뒤 점수는 0부터 다시 셉니다. 점수가 0인 길드는 받지 않습니다.</p>
      ${table(['순위', { t: '베리', c: 'r' }, '아이템(우편)', { t: esc(gr.coinName), c: 'r' }], gr.rewards.map((r) => tr([`<b>${r.from === r.to ? `${r.from}위` : `${r.from}~${r.to}위`}</b>`, R(fmt(r.gold)), r.items.map((i) => `${itemLink(i.itemId)} ×${i.qty}`).join(' '), R(fmt(r.coins))])))}
      <h3>길드 점수 얻는 법 <span class="chip">레벨은 소수점 버림</span></h3>
      ${table(['활동', '점수'], [
        ['일반 몬스터 처치', `${lv(sc.hunt)} (몬스터 레벨)`],
        ['정예 몬스터 처치', `${lv(sc.elite)} (몬스터 레벨)`],
        ['섬 보스 처치', `${lv(sc.islandBoss)} (몬스터 레벨)`],
        ['필드 보스(보상을 받은 사람마다)', fmt(sc.fieldBoss)],
        ['일일 던전 완주', `${lv(sc.dungeon)} (내 레벨)`],
        ['무한의 던전 보스 웨이브', fmt(sc.infiniteBoss)],
        ['파티 레이드 클리어', `${lv(sc.raid)} (레이드 입장 레벨)`],
        ['길드 레이드 클리어', fmt(sc.guildRaid)],
      ].map(([a, b]) => tr([a, b])))}
      <ul class="plain small" style="margin-top:12px">
        <li>한 사람이 하루(한국 시간)에 쌓는 점수는 <b>${fmt(sc.dailyCap)}점</b>까지, 그중 사냥(일반·정예·섬 보스) 몫은 <b>${fmt(sc.huntDailyCap)}점</b>까지입니다.</li>
        <li>내 레벨보다 ${sc.greyGap}레벨 넘게 낮은 몬스터, 봇 파티원이 대신 잡은 처치, 훈련장·결투장은 점수가 없습니다.</li>
        <li>점수 <b>${sc.scorePerCoin}점마다 ${esc(gr.coinName)} 1개</b>가 길드 금고에 들어옵니다. 주화는 0시에 초기화되지 않습니다(길드가 해체되면 사라집니다).</li>
        <li>길드를 탈퇴하거나 추방되면 <b>${gr.rejoinHours}시간</b> 동안 어느 길드에도 들어갈 수 없습니다(새 길드를 만드는 것은 됩니다).</li>
        <li>같은 계정의 캐릭터가 한 길드에 여럿이어도 우편은 계정마다 한 통입니다. 접속하지 않은 길드원도 받습니다.</li>
        <li>서버가 0시에 꺼져 있었다면 다시 켜진 뒤 바로 지급합니다(하루 한 번).</li>
        <li>개인 랭킹은 전체와 직업별 탭으로 볼 수 있습니다.</li>
      </ul>
    </section>
    <section class="card" id="guild-shop">
      <h2 style="margin-top:0">길드 상점 <span class="chip">${esc(gr.coinName)}</span> <span class="chip">길드장·부길드장만 구매</span></h2>
      <p>메뉴(ESC) › 길드 › <b>상점</b> 탭. 길드 금고의 ${esc(gr.coinName)}로 길드 전체에 적용되는 강화와 축복을 삽니다. 길드원은 누구나 볼 수 있습니다.</p>
      <h3>영구 강화 <span class="chip">단계마다 값이 오릅니다</span></h3>
      ${table(['강화', '효과', { t: '단계', c: 'r' }, `단계별 값(${esc(gr.coinName)})`], gsh.upgrades.map((u) => tr([`<b>${esc(u.name)}</b>`, esc(u.effect), R(u.costs.length), u.costs.map(fmt).join(' → ')])))}
      <p class="small">길드 정원은 기본 ${gr.maxMembers}명에서 정원 확장 한 단계마다 늘어납니다.</p>
      <h3>길드 축복 <span class="chip">${gsh.buffHours}시간</span> <span class="chip">최대 ${gsh.buffMaxHours}시간까지 쌓임</span></h3>
      ${table(['축복', { t: '효과', c: 'r' }, { t: '값', c: 'r' }], gsh.buffs.map((b) => tr([`<b>${esc(b.name)}</b>`, R(`+${b.pct}%`), R(fmt(b.cost))])))}
      <ul class="plain small" style="margin-top:12px">
        <li>경험치 축복은 다른 경험치 배율(이벤트·사료)에 더해지고, 베리 축복은 처치 베리에, 전리품 축복은 아이템이 떨어질 확률에 곱해집니다.</li>
        <li>이미 켜진 축복을 또 사면 남은 시간에 ${gsh.buffHours}시간이 더해집니다(남은 시간이 ${gsh.buffMaxHours}시간을 넘으면 살 수 없습니다). 접속하지 않아도 시간은 흐릅니다.</li>
      </ul>
    </section>`;
  const gs = D.guildStorage;
  const guildStorageCard = `
    <section class="card" id="guild-storage">
      <h2 style="margin-top:0">길드 창고 <span class="chip">길드 공용</span> <span class="chip">기본 ${gs.base}칸 · 최대 ${gs.base + gs.maxLevel * gs.perLevel}칸</span></h2>
      <p>메뉴(ESC) › 길드 › <b>창고</b> 탭에서 어디서나 엽니다. 길드원 모두가 함께 쓰는 아이템 창고입니다. 기본 ${gs.base}칸이고, 길드 상점의 <b>창고 확장</b>을 한 단계 살 때마다 +${gs.perLevel}칸(최대 ${gs.maxLevel}단계) 늘어납니다.</p>
      <ul class="plain small">
        <li><b>넣기</b>: 길드원 누구나. 귀속·잠근 아이템, 거래에 올린 아이템, 제련 결과를 고르지 않은 장비는 넣을 수 없습니다(개인 거래와 같은 규칙). 겹치는 아이템은 수량을 정해 일부만 넣을 수 있습니다.</li>
        <li><b>꺼내기</b>: 길드장·부길드장은 언제나 꺼냅니다. 일반 길드원은 길드장이 「길드원 꺼내기」를 허용했을 때만, 하루(한국 시간) ${gs.memberTakeDay}번까지 꺼냅니다.</li>
        <li>최근 ${gs.logMax}건의 입출고 기록(누가 · 무엇을 · 몇 개 · 언제)을 창고 탭에서 볼 수 있습니다.</li>
        <li>길드가 해체되면 창고에 남은 아이템은 마지막 길드원에게 우편으로 돌아갑니다(우편 한 통에 ${gs.returnPerMail}칸씩).</li>
      </ul>
    </section>`;
  const tv = D.tavern;
  const tvTier = (id) => tv.tiers.find((t) => t.id === id);
  const tvChip = (id) => `<span class="chip" style="color:${tvTier(id).color}">${esc(tvTier(id).name)}</span>`;
  const tvReward = (r) => `${r.exp ? `경험치 ${fmt(r.exp)}<div class="muted small">` : '<div>'}${fmt(r.gold)} 베리</div>`;
  const tvItems = (t) => t.items.map((i) => `${esc(M.items.get(i.itemId)?.name ?? i.itemId)} ×${i.qty}`).join(' · ');
  const tavernCard = `
    <section class="card" id="tavern">
      <h2 style="margin-top:0">선술집 의뢰 <span class="chip">노을마을 선술집 안 · ${esc(tv.hall)}</span> <span class="chip">${tv.rotateHours}시간마다 교체</span></h2>
      <p>노을마을 선술집 정문에서 F를 눌러 안으로 들어가, <b>${esc(tv.broker)}</b>에게 말을 걸면 의뢰 게시판이 열립니다. 의뢰는 한국 시간 0시부터 <b>${tv.rotateHours}시간마다</b>(0·4·8·12·16·20시) 새로 들어옵니다. 보상은 모두 <b>받는 캐릭터의 레벨</b> 기준이고, 경험치에는 경험치 이벤트·사료 같은 경험치 배율이 붙지 않습니다(만렙은 경험치 없음).</p>
      <h3>개인 의뢰 <span class="chip">캐릭터마다 ${tv.personalCount}개</span> <span class="chip">동시에 ${tv.maxActive}개까지</span></h3>
      <ul class="plain small">
        <li>캐릭터마다 다른 의뢰 ${tv.personalCount}개가 게시판에 붙습니다. 목표는 <b>내 레벨에 맞는 사냥터</b>의 몬스터·정예·섬 보스 처치이고, 지옥 의뢰는 레이드 클리어를 요구하기도 합니다.</li>
        <li>한 의뢰는 교체 시간마다 한 번만 받을 수 있습니다. 받은 의뢰는 교체 뒤에도 남아 있어 천천히 깨도 되고, 포기하면 그 칸은 이번 시간대에 다시 받을 수 없습니다.</li>
        <li>목표를 채운 뒤 선술집에서 「완료」를 눌러야 보상이 들어옵니다.</li>
      </ul>
      ${table(['난이도', { t: '등장 비율', c: 'r' }, { t: '경험치(보통 대비)', c: 'r' }, { t: esc(D.gems.name), c: 'r' }, '아이템'], tv.tiers.map((t) => tr([tvChip(t.id), R(pct(t.share)), R(`×${t.expMul}`), R(t.gems), tvItems(t)])))}
      <p class="muted small" style="margin-top:8px">보통 의뢰 한 장은 그 레벨 처음(0%)부터 아래 표의 레벨 수만큼 오르는 경험치를 줍니다(Lv150~170 2레벨 → Lv200 1레벨 → Lv280 0.2레벨). 물약은 내 레벨 사냥터 등급의 회복·마나 물약으로 나옵니다(위 표는 Lv1 기준 이름).</p>
      <h3>레벨별 보상 예시 (경험치 · 베리)</h3>
      ${table(['레벨 (사냥터)', { t: '보통 = 레벨', c: 'r' }, ...tv.tiers.map((t) => ({ t: tvChip(t.id), c: 'r' }))], tv.levels.map((l) => tr([`<b>Lv${l.level}</b><div class="muted small">${esc(l.island)}</div>`, R(`${Math.round(l.normalLevels * 100) / 100}레벨`), ...l.rewards.map((r) => R(tvReward(r)))])))}
      <h3>공용 의뢰 <span class="chip">서버 전체 ${tv.publicCount}개</span> <span class="chip">보상 ${pct(tv.publicMul)}</span></h3>
      <ul class="plain small">
        <li>서버의 모든 캐릭터가 함께 채우는 의뢰입니다. 받을 필요 없이 그 활동을 하면 바로 쌓입니다.</li>
        <li>목표를 채우면 <b>목표의 ${pct(tv.minShareFrac)} 이상(최소 1)</b>을 직접 채운 캐릭터마다 보상을 받습니다: 베리·${esc(D.gems.name)}은 같은 난이도 개인 의뢰의 ${pct(tv.publicMul)}(${esc(D.gems.name)}은 올림), 경험치는 레벨 몫의 ${pct(tv.publicExpFrac)} × 난이도 배율, 아이템은 개인 의뢰와 같습니다.</li>
        <li>보상은 다음 교체 뒤에도 ${tv.rotateHours}시간 동안 받을 수 있습니다.</li>
        <li>처치 목표는 내 레벨보다 ${tv.publicLevelGap}레벨 넘게 낮은 몬스터를 세지 않습니다.</li>
      </ul>
      ${table(['의뢰', '목표', ...['normal', 'hard', 'very_hard', 'hell'].map((id) => ({ t: tvChip(id), c: 'r' }))], tv.publicKinds.map((k) => tr([`<b>${esc(k.name)}</b>`, esc(k.label), ...['normal', 'hard', 'very_hard', 'hell'].map((id) => R(fmt(k.target[id])))])))}
      <p class="muted small" style="margin-top:8px">공용 의뢰는 한 번에 보통·어려움과 매우 어려움 또는 지옥 하나씩, 서로 다른 종류로 붙습니다.</p>
    </section>`;
  const cq = D.catQuests;
  const catQuests = cq.ids.map((id) => M.quests.get(id)).filter(Boolean);
  const catCard = `
    <section class="card" id="cat-quests">
      <h2 style="margin-top:0">고양이 의뢰 <span class="chip">${esc(cq.hall)} · ${esc(cq.npc)}</span> <span class="chip">Lv${catQuests[0]?.minLevel ?? 1}부터</span> <span class="chip">곁가지 ${catQuests.length}개 · 한 번씩</span></h2>
      <p>${esc(cq.hall)} 술대 위에 앉은 <b>${esc(cq.npc)}</b>가 주는 곁가지 퀘스트입니다. 앞 의뢰를 끝내야 다음 의뢰를 받고, 하나씩 한 번만 할 수 있습니다.</p>
      ${questTable(catQuests)}
    </section>`;
  const tg = D.training;
  const trainingCard = `
    <section class="card" id="training">
      <h2 style="margin-top:0">${esc(tg.name)} <span class="chip">누구나 · 레벨 제한 없음</span> <span class="chip">DPS 측정</span></h2>
      <p>어느 섬의 뱃사공에게서든 목록 맨 끝의 「훈련장」으로 건너갑니다. 허수아비는 움직이지도 반격하지도 않고, HP가 바닥나도 그 자리에서 다시 가득 찹니다. 경험치·전리품·퀘스트 진행은 없습니다.</p>
      ${table(['허수아비', { t: '레벨', c: 'r' }, { t: 'HP', c: 'r' }], tg.dummies.map((d) => tr([`<b>${esc(d.name)}</b>`, R(d.level), R(fmt(d.hp))])))}
      <ul class="plain small" style="margin-top:12px">
        <li>허수아비를 때리면 화면 위쪽에 <b>DPS 측정판</b>이 뜹니다: DPS · 총 피해 · 시간 · 타격 수 · 치명타 비율 · 최고 한 방 · 최고 DPS.</li>
        <li>마지막으로 때린 뒤 ${tg.resetSec}초가 지나면 한 판이 끝나고 허수아비 HP가 다시 가득 찹니다. 다시 때리면 새 판이 시작됩니다.</li>
        <li>내 공격이 실제로 얼마나 아픈지 순수 피해량을 잽니다(<a href="#/damage">데미지 공식</a>).</li>
      </ul>
    </section>`;
  const dg = D.dungeons;
  const lvDg = dg.list.find((d) => d.kind === 'levelup');
  const gearDg = dg.list.find((d) => d.kind === 'gear');
  const roomFlow = (d) => d.rooms.map((k, i) => `${i + 1}구역 ${k === 'mid' ? '<b>중간 보스</b>' : k === 'boss' ? '<b>최종 보스</b>' : `몬스터 ${d.packSize}마리`}`).join(' → ');
  const midNo = lvDg.rooms.indexOf('mid') + 1;
  const dungeonCards = `
    <section class="card" id="dungeons">
      <h2 style="margin-top:0">일일 던전 <span class="chip">하루(KST) 던전마다 ${lvDg.dailyLimit}번</span> <span class="chip">혼자~${lvDg.size}인</span> <span class="chip">${lvDg.maxWave}구역</span></h2>
      <p>노을마을 선술집 주인의 레이드 목록에서 출발합니다. 입장할 때마다 1회로 세고, 파티로 가면 <b>파티원 모두</b> 남은 횟수가 있어야 출발합니다. 랭킹·서버 최초 보상은 없습니다.</p>
      <p><b>방을 뚫고 나아가는 던전</b>입니다. 입구에서 회랑을 따라 방 ${lvDg.maxWave}곳을 차례로 지나며, <b>파티가 방에 들어서야</b> 그 방 몬스터가 나타납니다(방을 정리해야 다음 방이 열립니다). ${midNo}구역에는 <b>중간 보스</b>(한 단계 아래 지역의 섬 보스 · 최종 보스 수치 대비 HP ${pct(lvDg.midBoss?.hp ?? 0)} · 공격력 ${pct(lvDg.midBoss?.atk ?? 0)} · 호위 ${lvDg.midBoss?.escorts ?? 0}), 마지막 ${lvDg.maxWave}구역에는 <b>최종 보스</b>(그 레벨 지역의 섬 보스 · 호위 ${lvDg.bossEscorts})가 기다립니다. 진행 창의 화살표가 다음 방 쪽을 가리킵니다.</p>
      <p class="small">몬스터는 구역 번호가 아니라 <b>입장한 파티의 평균 레벨과 인원</b>에 맞춰집니다(그 레벨 지역의 몬스터를 기준으로 인원이 늘 때마다 HP가 불어납니다). 순서: ${roomFlow(lvDg)}</p>
      <div class="grid g2">
        <div class="card">
          <h3>${esc(lvDg.name)}</h3>
          <ul class="plain small">
            <li>경험치: 입장 레벨부터 <b>몇 레벨 오르는 만큼</b>을 줍니다(Lv100 위로는 한 레벨의 %, <b>Lv200부터는 하드캡</b>으로 크게 줄어듭니다). 구역마다 ${pct(dg.levelupWaveShare)}씩, 나머지는 최종 보스를 쓰러뜨릴 때 들어옵니다.</li>
            <li>최종 보스 처치 때 ${itemLink(D.scrolls.id)} ${lvDg.scrollsPerBoss}장.</li>
            <li>${rubyLine('daily_dungeon')}</li>
            <li>몬스터 HP: 파티원 1명 늘 때마다 +${pct(lvDg.partyHpMul)}.</li>
          </ul>
          ${table([{ t: '입장 레벨', c: 'r' }, { t: '한 번에 오르는 양', c: 'r' }], dg.levelup.map((l) => tr([R(`Lv${l.level}`), R(esc(l.text))])))}
        </div>
        <div class="card">
          <h3>${esc(gearDg.name)}</h3>
          <ul class="plain small">
            <li>구역에서는 장비가 나오지 않고, <b>완주(최종 보스 처치)하면 한 사람에게 ${gearDg.clearGear}점</b>을 한꺼번에 줍니다. 한 점마다 등급 ${esc(dg.gear.gradesText)}. 받은 장비는 결과 창에 보입니다.</li>
            <li>나오는 장비: <b>내 레벨 티어 장비</b> 중 내 직업이 쓰는 7부위(레이드 세트는 나오지 않습니다).</li>
            <li>최종 보스 처치 때 ${itemLink(D.scrolls.id)} ${gearDg.scrollsPerBoss}장.</li>
            <li>${rubyLine('daily_dungeon')}</li>
            <li>몬스터 HP: 파티원 1명 늘 때마다 +${pct(gearDg.partyHpMul)}.</li>
          </ul>
        </div>
      </div>
    </section>`;
  const so = D.social;
  const ex = so.exchange;
  const td = so.trade;
  const lt = so.letter;
  const fr = so.friends;
  const bb = D.boombox;
  const hof = D.hallOfFame;
  const socialCards = `
    <section class="card" id="exchange">
      <h2 style="margin-top:0">거래소 <span class="chip">수수료 ${ex.feePct}%</span> <span class="chip">동시 등록 ${ex.maxListings}개 (월정액 +${ex.supporterBonus})</span></h2>
      <p>메뉴(ESC) › <b>거래소</b>에서 엽니다. 가방의 물건에 값을 붙여 올리면 누구나 사 갈 수 있고, 팔리면 값에서 수수료 ${ex.feePct}%를 뗀 베리가 판매자에게 들어갑니다(예: ${fmt(ex.example.price)} 베리 → ${fmt(ex.example.payout)} 베리). 판매자가 접속해 있지 않아도 팔리고, 대금은 다음에 들어올 때 받습니다.</p>
      <ul class="plain small">
        <li>한 등록의 값은 최대 ${fmt(ex.priceMax)} 베리입니다. 귀속·잠금 아이템은 올릴 수 없습니다.</li>
        <li>캐릭터마다 동시에 ${ex.maxListings}개까지 올립니다. 모험가 월정액 중에는 +${ex.supporterBonus}개이고, 월정액이 끝나도 올려 둔 물건은 그대로입니다.</li>
        <li>거래 동향(팔린 기록)은 ${ex.salesKeepDays}일, 내 거래 기록은 ${ex.logKeepDays}일 동안 남습니다.</li>
        <li>대장장이는 거래소에서 살 수는 있지만 올릴 수는 없습니다.</li>
      </ul>
    </section>
    <section class="card" id="trade">
      <h2 style="margin-top:0">1:1 거래 <span class="chip">거리 ${td.range} 안</span> <span class="chip">한쪽 ${td.slots}칸 + 베리</span></h2>
      <p>가까이 있는 플레이어에게 거래를 신청하면 상대가 ${td.requestSec}초 안에 받아들여야 열립니다. 양쪽이 물건과 베리를 올리고 「준비」와 「확인」을 모두 누르는 순간 한꺼번에 맞바꿉니다. 귀속·잠금 아이템은 올릴 수 없습니다.</p>
      <ul class="plain small">
        <li>건넨 베리는 받는 쪽이 수수료 ${td.feePct}%를 떼고 받습니다(예: ${fmt(td.example.gold)} 베리 → ${fmt(td.example.gold - td.example.fee)} 베리). 거래소 수수료와 같은 값입니다.</li>
        <li>거리가 ${td.range}을 넘거나, 다른 곳으로 옮기거나, 접속이 끊기거나, 쓰러지면 거래가 취소되고 아무것도 옮겨지지 않습니다.</li>
      </ul>
    </section>
    <section class="card" id="letter">
      <h2 style="margin-top:0">편지·우편함 <span class="chip">계정당 하루 ${lt.perDay}통</span> <span class="chip">첨부 ${lt.attachMax}칸 + 베리</span></h2>
      <p>메뉴(ESC) › <b>우편함</b>에서 캐릭터 이름으로 편지를 보냅니다. 친구가 아니어도, 상대가 접속해 있지 않아도 됩니다(내 계정 캐릭터에게는 보낼 수 없습니다). 제목은 ${lt.titleMax}자, 본문은 ${lt.bodyMax}자까지입니다.</p>
      <ul class="plain small">
        <li>가방 아이템 ${lt.attachMax}칸과 베리(최대 ${fmt(lt.goldMax)})를 붙일 수 있습니다. 1:1 거래와 같은 규칙으로 귀속·잠금·장착 아이템은 안 되고, 강화 단계는 그대로 따라갑니다. 게임에서 얻은 루비도 보낼 수 있습니다(충전한 루비는 안 됩니다).</li>
        <li>우표값은 보내는 사람이 냅니다: ${fmt(lt.postageBase)} 베리 + 첨부 칸마다 ${fmt(lt.postagePerItem)} 베리 + 보내는 베리의 ${lt.feePct}%. 받는 사람은 보낸 베리를 그대로 받습니다.</li>
        <li>받지 않은 첨부 우편은 지워지지 않습니다. 첨부를 받은 우편과 첨부 없는 우편은 ${lt.keepDays}일 뒤 지워집니다.</li>
        <li>상점 상품·운영자 지급, 가방이 가득 차 못 받은 레이드·던전 보상도 우편으로 옵니다. 아이템은 「받기」를 누른 캐릭터 가방에 들어갑니다.</li>
      </ul>
      ${table([{ t: '첨부 칸', c: 'r' }, { t: '보내는 베리', c: 'r' }, { t: '우표값', c: 'r' }], lt.examples.map((e) => tr([R(e.stacks), R(fmt(e.gold)), R(`${fmt(e.postage)} 베리`)])))}
    </section>
    <section class="card" id="friends">
      <h2 style="margin-top:0">친구 <span class="chip">계정끼리</span> <span class="chip">최대 ${fr.max}명</span></h2>
      <p>친구는 캐릭터가 아니라 계정끼리 맺습니다. 메뉴(ESC) › <b>친구</b>나 접속자 목록에서 요청하고 상대가 받아들이면 친구가 됩니다. 친구 목록에서는 친구의 지금 캐릭터(접속 중이 아니면 마지막으로 들어온 캐릭터)와 레벨·있는 곳·파티 상태를 봅니다.</p>
      <ul class="plain small">
        <li>요청은 ${fr.requestDays}일 뒤 사라지고, 받은 요청은 ${fr.requestInMax}개까지 쌓입니다.</li>
        <li>친구에게는 <a href="#/drops#cash-shop">루비 상점</a> 상품을 선물할 수 있습니다.</li>
      </ul>
    </section>
    <section class="card" id="board">
      <h2 style="margin-top:0">게시판 <span class="chip">모든 서버 공용</span> <span class="chip">말머리 ${D.social.board.tags.length}종</span></h2>
      <p>메뉴(ESC) › <b>게시판</b>에서 여는 인게임 자유 게시판입니다. 글은 서버에 남아 접속을 끊어도 사라지지 않습니다. 목록은 한 쪽에 ${D.social.board.page}개씩 새 글부터 보이고, 말머리(${D.social.board.tags.map(esc).join(' · ')})로 거르거나 제목·글쓴이로 검색합니다.</p>
      <ul class="plain small">
        <li>제목 ${D.social.board.titleMax}자, 본문 ${D.social.board.bodyMax}자, 댓글 ${D.social.board.commentMax}자까지 씁니다. 글쓴이는 쓸 때의 캐릭터 이름입니다.</li>
        <li>추천·비추천은 계정마다 글 하나에 한 번이고 내 글에는 못 합니다. 추천이 ${D.social.board.bestUp}개 이상이면 <b>개념글</b>이 되어 개념글 탭에 모입니다.</li>
        <li>도배 막기: 계정마다 글은 ${D.social.board.postGapSec / 60}분에 하나·하루 ${D.social.board.postsPerDay}개, 댓글은 ${D.social.board.commentGapSec}초에 하나·하루 ${D.social.board.commentsPerDay}개까지입니다. 채팅 금지 중에는 쓸 수 없고 금칙어는 가려집니다.</li>
        <li>내 글·댓글은 지울 수 있고, 운영자는 다른 사람의 글·댓글을 숨깁니다.</li>
      </ul>
    </section>
    <section class="card" id="boombox">
      <h2 style="margin-top:0">파티 붐박스 <span class="chip">${esc(D.gems.name)} ${bb.gemPrice}개 = ${bb.passMinutes}분</span> <span class="chip">대기열 ${bb.queueMax}곡</span></h2>
      <p>파티원끼리 같은 유튜브 곡을 같은 위치로 함께 듣습니다. 곡을 틀거나 넘기려면 이용권이 있어야 하고, 듣기만 하는 파티원은 이용권이 없어도 됩니다.</p>
      <ul class="plain small">
        <li>이용권: ${esc(D.gems.name)} ${bb.gemPrice}개로 ${bb.passMinutes}분(캐릭터마다). 남은 시간에 이어 붙고 최대 ${bb.maxPassMinutes / 60}시간까지 쌓입니다. 예전에 판매한 「붐박스 무제한」을 산 계정은 모든 캐릭터가 계속 씁니다.</li>
        <li>유튜브 주소(youtube.com/watch · youtu.be · shorts · live 등)나 영상 id를 넣습니다. 지금 곡 말고 ${bb.queueMax}곡까지 대기열에 올리고, 곡이 끝나면 다음 곡으로 넘어갑니다. 한 곡은 최대 ${bb.maxDurationSec / 3600}시간까지만 틉니다.</li>
        <li>이용권이 있는 파티원이 한 명이라도 남아 있는 동안 곡이 이어집니다. 마지막 이용권 보유자가 나가거나 이용권이 끝나면 곡과 대기열이 지워집니다.</li>
        <li>설정의 「파티 붐박스 듣기」와 볼륨으로 끄거나 줄일 수 있습니다.</li>
      </ul>
    </section>
    <section class="card" id="hall-of-fame">
      <h2 style="margin-top:0">명예의 전당 <span class="chip">${esc(hof.season)}</span> <span class="chip">노을마을 동상 ${hof.legends.length}개</span></h2>
      <p>${esc(hof.season)} 레벨 랭킹 상위 ${hof.legends.length}명의 동상이 노을마을 곳곳에 서 있습니다. 동상 받침에 순위와 이름이 새겨져 있습니다.</p>
      ${table([{ t: '순위', c: 'r' }, '이름', '직업'], hof.legends.map((l) => tr([R(`${l.rank}위`), `<b>${esc(l.name)}</b>`, `<a href="#/classes/${esc(l.classId)}">${esc(classOf(l.classId)?.name ?? l.classId)}</a>`])))}
      <p class="muted small" style="margin-top:8px">이름의 X는 금칙어를 가린 글자입니다.</p>
    </section>`;
  const index = `<nav class="isl-index" aria-label="지역 바로가기">${D.islands.map((isl) => `<a href="#/world#isl-${isl.id}"><b>${esc(isl.name)}</b><span>${isl.hub ? "모항" : `Lv${isl.levelRange[0]}~${isl.levelRange[1]}`}${isl.shopTiers.length ? ` · ${isl.shopTiers.map((t) => `T${t}`).join('·')}` : ''}</span></a>`).join('')}<a href="#/world#training"><b>${esc(tg.name)}</b><span>DPS 측정</span></a></nav>`;
  return `${head('지역·레이드', '지역(섬)은 뱃사공의 배로 옮겨 다닙니다. 입장 레벨이 되어야 갈 수 있습니다. 노을마을은 모든 항로가 모이는 모항입니다.')}<h2>지역 (${D.islands.length}곳)</h2>${index}<div class="stack">${islands}</div><h2>훈련장</h2><div class="stack">${trainingCard}</div><h2>레이드</h2><div class="stack">${raids}${infCard}${augCard}</div><h2>일일 던전</h2><div class="stack">${dungeonCards}</div><h2>필드 보스 원정</h2><div class="stack">${worldBosses}</div><h2>선술집 의뢰</h2><div class="stack">${tavernCard}${catCard}</div><h2>결투장 (PvP)</h2><div class="stack">${duelCard}</div><h2>길드</h2><div class="stack">${guildRankCard}${guildStorageCard}</div><h2>교류·편의</h2><div class="stack">${socialCards}</div>`;
}

// ── 페이지: 성장·강화 ──
const growthState = { rank: 1, level: 1 };
function pageGrowth() {
  const c = D.constants;
  const mulRows = D.classes.map((k) => tr([`<a href="#/classes/${k.id}">${esc(k.name)}</a>`, R(`×${k.classMul.atk}`), R(`×${k.classMul.hp}`), R(`+${k.atkPerLevel}`), R(`+${k.hpPerLevel}`), R(`+${k.mpPerLevel}`)]));
  const ae = c.allStatEffect;
  return `
    ${head('성장·강화')}
    <h2 style="margin-top:0">장비 성장</h2>
    <p>스탯 점수는 없습니다. 레벨이 오르면 <b>공격력·최대 HP·최대 MP가 조금씩</b> 오르고, 나머지는 <b>장비</b>가 정합니다. 더 높은 티어 장비, 더 높은 등급, 더 높은 강화가 곧 성장입니다. 장비 수치는 모든 직업이 같고, 직업마다 다른 <b>직업 계수</b>가 (기본값 + 레벨 성장 + 장비)로 얻은 공격력·HP 전체에 곱해집니다.</p>
    ${table(['직업', { t: '공격 계수', c: 'r' }, { t: 'HP 계수', c: 'r' }, { t: '레벨당 공격력(계수 전)', c: 'r' }, { t: '레벨당 HP(계수 전)', c: 'r' }, { t: '레벨당 MP', c: 'r' }], mulRows)}
    <p class="muted small" style="margin-top:8px">「모든 능력치 +1」(올스탯) 1점: 공격력 +${ae.atk}, 최대 HP +${ae.maxHp}, 최대 MP +${ae.maxMp}. 다른 능력치와 함께 직업 계수가 곱해집니다(MP 제외).</p>

    <h2>경험치</h2>
    <div class="formula">몬스터 경험치 = (10 + 6 × 몬스터 레벨) × (보스면 15)
내가 ${c.expPenaltyDiff[0]}레벨 이상 높으면 × 0.5, ${c.expPenaltyDiff[1]}레벨 이상 높으면 × 0.1</div>
    <ul class="plain">
      <li>처치에 기여한 사람과 같은 맵(같은 채널)에 있는 파티원이 거리와 상관없이 나눠 받습니다 — 1인당 (1 + ${c.partyExpBonus} × (인원 − 1)) ÷ 인원(2명 ${Math.round(((1 + c.partyExpBonus) / 2) * 100)}%, 4명 ${Math.round(((1 + c.partyExpBonus * 3) / 4) * 100)}%). 퀘스트 처치는 모두 인정됩니다.</li>
      <li>다음 레벨까지 잡아야 하는 같은 레벨 몬스터 수는 레벨이 오를수록 늘고, <b>Lv${c.rewardLevelFrom}부터 크게 가팔라집니다</b>(아래 표). 퀘스트 보상은 그 퀘스트 최소 레벨 필요 경험치의 ${c.questExpLevels}배(레벨 몫)이고, 최소 레벨보다 ${c.questExpSpan}레벨 높을 때까지는 <b>지금 레벨에서 같은 레벨 몫</b>을 받아 경험치 %가 줄지 않습니다(그보다 높으면 최소 레벨 + ${c.questExpSpan} 기준으로 고정). 무한의 던전·필드 보스·레이드 같은 반복 보상은 Lv${c.rewardLevelFrom} 위로 같은 레벨 몬스터 수 기준으로 고정돼 곡선을 따라 커지지 않습니다. 대신 레이드 클리어·필드 보스 원정은 하루 몇 번까지 <b>현재 레벨 필요 경험치의 일정 비율</b>을 성장 보너스로 더 줍니다(지역·레이드 페이지의 각 보상 칸).</li>
      <li>HP는 교전이 끝나고 ${c.hpRegen.delaySec}초 뒤부터 초당 ${c.hpRegen.pctPerSec}%씩 찹니다. MP는 전투 밖 초당 ${c.mpRegenPct}%, 전투 중 ${c.mpRegenCombatPct}%, 처치할 때 ${c.mpOnKillPct}% 찹니다.</li>
    </ul>
    <h3>고레벨 사냥터 (Lv${c.hunt.fromLevel}~)</h3>
    <ul class="plain">
      <li><b>경험치 배율</b>: 몬스터가 세진 만큼 처치 경험치를 더 줍니다 — Lv${c.hunt.exp[0][0]} ×${c.hunt.exp[0][1]} → Lv${c.hunt.exp[1][0]} ×${c.hunt.exp[1][1]} → Lv${c.hunt.exp[2][0]} ×${c.hunt.exp[2][1]}(사이는 직선). 아래 표의 몬스터 수에 들어 있습니다. 레이드·던전·퀘스트 보상에는 곱하지 않습니다.</li>
      <li><b>연속 처치</b>: ${c.hunt.combo.windowSec}초 안에 다음 고레벨 사냥터 몬스터를 잡으면 이어집니다. ${c.hunt.combo.step}마리마다 처치 경험치 +${Math.round(c.hunt.combo.stepBonus * 100)}%(최대 +${Math.round(c.hunt.combo.maxBonus * 100)}%). 쓰러지면 끊깁니다.</li>
      <li><b>사냥터 폭주</b>: 같은 채널에서 함께 ${c.hunt.frenzy.kills}마리를 잡으면 ${c.hunt.frenzy.sec}초 동안 일반 몬스터가 ×${c.hunt.frenzy.countMul}로 몰려오고 거의 바로 다시 나오며, 처치 경험치 +${Math.round(c.hunt.frenzy.expBonus * 100)}%입니다. 체력 막대 바로 위 칩에서 연속 처치 수와 「열기」 게이지를 봅니다.</li>
      <li><b>사냥터 채널</b>: 한 사냥터 정원이 차면 다음 사람은 채널 2·3…으로 나뉘고, 사람이 줄면 자동으로 합쳐집니다. 미니맵 이름표(모바일은 큰 지도 머리줄)의 「채널 N」을 누르면 채널마다 인원을 보고 자리가 남은 채널이나 <b>새 채널</b>(혼자 사냥)을 직접 고를 수 있습니다. 직접 고른 채널은 자동 조정으로 옮겨지지 않고, 마을로 돌아가거나 섬을 옮기면 풀립니다. 전투 중에는 못 고르고 10초마다 한 번 바꿀 수 있습니다. 다른 채널에 있는 파티에 들어가면 전투 중이어도 바로 파티장 채널로 옮겨집니다. 마을·부두 가장자리를 잠깐(2초 안) 스치기만 하면 채널은 그대로입니다.</li>
      <li>연속 처치·폭주 보너스는 서버 이벤트·사료·축복과 더합니다(합연산).</li>
    </ul>
    <div class="filters" style="margin-top:12px"><label class="f">레벨로 이동<input type="number" id="exp-jump" min="1" max="${D.meta.maxLevel}" value="${growthState.level}"></label></div>
    <div class="table-wrap scroll-y" id="exp-wrap"><table><thead><tr><th class="r">레벨</th><th class="r">다음 레벨까지</th><th class="r">누적 경험치</th><th class="r">같은 레벨 몬스터</th></tr></thead><tbody>
      ${D.expTable.map((e) => tr([R(e.level), R(e.toNext ? fmt(e.toNext) : '만렙'), R(fmt(e.total)), R(e.mobs ? `${fmt(e.mobs)}마리` : '—')], e.level === growthState.level ? 'hl' : '').replace('<tr', `<tr id="lv-${e.level}"`)).join('')}
    </tbody></table></div>

    ${expBonusSection()}

    <h2>강화</h2>
    <p>대장장이에게서 +${c.enhanceMax}까지 올립니다. <b>장비가 부서지지는 않습니다.</b> 목표가 +4 이하면 실패해도 그대로, +5~+${c.enhanceMax - 1}이면 한 단계 내려갑니다. <b>마지막 +${c.enhanceMax} 도전은 실패해도 그대로</b>입니다. 재료는 <b>베리와 ${itemLink(D.scrolls.id)}뿐</b>입니다.</p>
    <div class="filters"><label class="f">장비 순위(비용 기준)<select id="enh-tier">${enhRankOptions()}</select></label></div>
    <div id="enh-table">${enhanceTable()}</div>
    <p class="muted small" style="margin-top:8px">기대값은 +0에서 시작해 그 단계에 처음 닿을 때까지의 평균입니다(실패로 내려간 뒤 다시 올리는 비용 포함). 비용은 장비 순위 × 반올림(120 × (현재 단계 + 1)^1.7) 베리입니다. 티어 장비의 순위는 티어 번호(1~${D.tiers.length})이고, 레이드 세트는 티어 곡선 위의 소수 순위입니다. 강화서는 목표 +1~+4에 ${D.scrolls.perEnhance[0].scrolls}장, +5~+7에 ${D.scrolls.perEnhance[1].scrolls}장, +8~+10에 ${D.scrolls.perEnhance[2].scrolls}장입니다.</p>

    <h2>각성</h2>
    <p>+${c.enhanceMax} 장비는 대장장이에게서 각성에 도전할 수 있습니다. 성공률은 ${D.awaken.rate}%에서 시작해 <b>실패할 때마다 그 장비의 성공률이 ${D.awaken.step}%씩 오릅니다</b>. 실패해도 강화 단계는 +${c.enhanceMax} 그대로입니다(베리·강화서만 듭니다). 성공하면 칸 테두리가 붉게 빛나는 각성 장비가 되고 수치가 +${c.enhanceMax} 강화 배율의 ×${D.awaken.mul}이 됩니다. 각성 장비는 그대로 거래·경매장 등록이 됩니다. 1회 비용은 베리와 강화서 ${D.scrolls.awaken}장입니다.</p>
    ${table([{ t: '순위', c: 'r' }, '장비 세트', { t: '각성 베리', c: 'r' }, { t: '강화서', c: 'r' }], [...D.awaken.tiers, ...D.awaken.raidSets].sort((a, b) => a.rank - b.rank).map((a) => tr([R(a.rank), esc(a.label), R(fmt(a.gold)), R(a.scrolls)])))}

    <h2 id="merge">합성</h2>
    <p>대장장이에게서 <b>같은 장비·같은 등급 세 개</b>를 합쳐 <b>한 등급 위 장비 한 개</b>로 바꿉니다. 베리는 들지 않고, 강화 단계는 셋 중 가장 높은 것이 남습니다. ${esc(D.constants.grades.mergeCaps.text)}.</p>
    <p><b>일괄 합성</b>: 합성 탭에서 등급을 고르면 가방에 있는 그 등급 장비를 같은 장비끼리 세 개씩 한 번에 모두 합성합니다. 강화가 높은 장비가 결과로 남고 강화가 낮은 장비가 재료가 되며, 잠근 장비·착용 장비·거래 중인 장비는 빠집니다. 귀속 장비는 귀속 장비끼리 먼저 묶습니다. 합성으로 오른 장비는 같은 번에 다시 합치지 않습니다(다음 등급을 골라 한 번 더 누르면 됩니다).</p>
    <p class="muted small">등급 한 칸은 티어 ¼칸입니다(한 칸 최소 ×${D.constants.grades.minMul}): T1·T2는 ${esc(rarName('legendary'))}이 다음 티어 ${esc(rarName('common'))}과 같습니다. 자세한 배율은 <a href="#/drops#grades">드랍률</a>의 장비 등급을 보세요.</p>

    <h2 id="relics">유물</h2>
    <p><b>Lv ${D.relics.level}</b>부터 ESC 메뉴의 <b>유물</b> 창에서 ${esc(D.gems.name)}으로 유물을 뽑습니다(1회 ${D.relics.drawCost}개 · ${D.relics.drawMulti}회 ${D.relics.drawCost * D.relics.drawMulti}개). 최대 <b>${D.relics.slots}개</b>를 장착하면 아래 능력치가 오릅니다. 유물은 가방 밖 보관함(최대 ${D.relics.cap}개)에 있고 거래·판매할 수 없습니다.</p>
    <p>필드 정예 몬스터를 잡으면 Lv ${D.relics.level} 이상인 처치 인정자마다 <b>${pct(D.relics.eliteDrop.chance)}</b> 확률로 유물 1개가 보관함에 바로 들어옵니다(${D.relics.eliteDrop.grades.map((g) => `${esc(rarName(g.id))} ${pct(g.rate)}`).join(' · ')}). 보관함이 가득 차 있으면 나오지 않습니다.</p>
    <p><b>천장</b>: 캐릭터마다 ${D.relics.pity.map((t) => `마지막 ${esc(rarName(t.id))} 이상 뒤로 뽑은 횟수`).join('와 ')}를 셉니다(${esc(D.gems.name)}·유물 소환권, 1회·${D.relics.drawMulti}회 뽑기 모두 회차마다 1). ${D.relics.pity.map((t) => `<b>${t.at}번째</b> 뽑기는 <span class="rar-${t.id}">${esc(rarName(t.id))}</span> 이상 확정`).join(', ')}이고(둘이 겹치면 높은 쪽), 확정 회차의 등급은 그 이상 등급끼리 원래 확률 비율대로 정해집니다(${D.relics.pity.map((t) => `${esc(rarName(t.id))} 확정: ${t.grades.map((g) => `${esc(rarName(g.id))} ${pct(g.rate)}`).join(' · ')}`).join(' / ')}). ${esc(rarName('epic'))} 이상이 나오면 ${esc(rarName('epic'))} 횟수를, ${esc(rarName('legendary'))} 이상이 나오면 두 횟수를 모두 처음부터 셉니다. 합성·정예 몬스터 드랍은 세지 않습니다. 진행은 유물 창 소환 띠에 보입니다. 천장이 생기기 전(2026-10-07)에 뽑은 횟수도 소급합니다: 그 뒤 처음 접속할 때 밀린 만큼 전설·영웅 유물을 한 번 넣어 드립니다(뽑은 횟수는 보관함 유물 수로 추정).</p>
    <div class="grid g2">
      <div class="card">
        <h3>등급 · 뽑기 · 합성 확률</h3>
        ${table(['등급', { t: '뽑기', c: 'r' }, { t: '배율', c: 'r' }, { t: `합성 성공(${D.relics.mergeCount}개 → 다음 등급)`, c: 'r' }], D.relics.grades.map((g) => tr([`<span class="rar-${g.id}">${esc(rarName(g.id))}</span>`, R(pct(g.rate)), R(`×${g.mul}`), R(g.merge === null ? '—' : pct(g.merge))])))}
        <p class="muted small" style="margin-top:8px">합성은 잠금·장착하지 않은 <b>같은 등급 ${D.relics.mergeCount}개</b>를 씁니다. 실패하면 같은 등급 1개(무작위 종류)를 돌려받습니다. <b>일괄 합성</b>은 고른 등급까지 낮은 등급부터 ${D.relics.mergeCount}개씩 계속 합성하고, 성공해 오른 유물은 다음 등급 재료가 됩니다. 전설·유니크를 얻으면 서버 전체에 알립니다.</p>
      </div>
      <div class="card">
        <h3>유니크 특수 효과</h3>
        <p class="small">유니크 유물은 기본 능력치에 더해 아래 중 하나가 무작위로 붙습니다. 같은 효과를 둘 이상 껴도 하나만 칩니다.</p>
        <ul class="plain small">${D.relics.specials.map((s) => `<li><b>${esc(s.name)}</b> — ${esc(s.desc)}</li>`).join('')}</ul>
      </div>
    </div>
    <h3>종류별 능력치 (등급마다)</h3>
    ${table(['유물', '능력치', ...D.relics.grades.map((g) => ({ t: `<span class="rar-${g.id}">${esc(rarName(g.id))}</span>`, c: 'r' }))], D.relics.types.map((t) => tr([esc(t.name), esc(t.stat), ...t.values.map((v) => R(`+${v}${t.unit}`))])))}
    <p class="muted small" style="margin-top:8px">공격력은 물리·마법 공격력에 모두 곱합니다. 공격 속도는 기본 공격 재사용 대기를 줄입니다. 다중 사격은 투사체 직업이면 기본 공격 투사체가 한 발 더 나가고, 근접 직업이면 기본 공격을 한 번 더 휘두릅니다. 장착 유물을 모두 더해도 공격 속도는 +${D.relics.fxCap.aspdPct}%, 스킬 재사용 대기 감소(가속 포함)는 −${D.relics.fxCap.cdrPct}%까지만 칩니다.</p>

    <h2 id="scroll">${itemLink(D.scrolls.id)} 얻는 곳</h2>
    <ul class="plain">
      <li>필드 일반 몬스터: 처치마다 약 ${pct(D.scrolls.fieldDrop)}. 정예·섬 보스·보물상자는 더 많이 줍니다(몬스터 이름의 드랍표 참고).</li>
      <li>${esc(D.infinite.name)}: 보스 웨이브(${D.scrolls.infinite.bossEvery}웨이브마다) 클리어 때 ${D.scrolls.infinite.perBoss}장 × (웨이브 ÷ ${D.scrolls.infinite.bossEvery}).</li>
      <li>일일 던전: ${D.scrolls.dungeons.map((d) => `${esc(d.name)} 보스 웨이브 ${d.perBoss}장`).join(' · ')}.</li>
      <li>레이드 클리어 고정 보상: ${D.scrolls.raids.map((r) => `${esc(r.name)} ${r.qty}장`).join(' · ')}.</li>
      <li>필드 보스 원정 보상(기여 지분 이상)과 ${itemLink('premium_box')}(장비가 나오지 않을 때 ${D.scrolls.premium[0]}~${D.scrolls.premium[1]}장).</li>
      <li>상점에서는 팔지 않습니다.</li>
    </ul>

    ${titlesSection()}`;
}
/** 경험치 배율: 모든 보너스를 더한다(rewardExpMul). 붙는 보상 · 안 붙는 보상 · 운영자 확률 이벤트 */
function expBonusSection() {
  const x = D.expBonus;
  const g = D.guildShop.buffs.find((b) => b.id === 'exp');
  const bsExp = D.blacksmith.buff.list.filter((b) => b.kind === 'exp');
  const lvDg = D.dungeons.list.find((d) => d.kind === 'levelup');
  const example = 1 + (x.hourly.mul - 1) + (x.feed.mul - 1) + x.supporter;
  const ev = x.rateEvents;
  const rows = [
    tr(['<b>정각 이벤트</b>', R(`+${pct(x.hourly.mul - 1)}`), `매시 정각부터 ${x.hourly.minutes}분(한국 시간), 서버 전체. 시작·5분 전·끝에 공지가 나옵니다.`]),
    tr(['<b>운영자 경험치 이벤트</b>', R(`+(배율 − 1), 최대 ×${ev.mulMax}`), `운영자가 여는 기간 이벤트(최대 ${ev.minutesMax / 60}시간), 서버 전체. 정각 이벤트와 겹치면 둘 다 더합니다.`]),
    tr([itemLink(x.feed.id), R(`+${pct(x.feed.mul - 1)}`), `1개에 ${x.feed.minutes}분, 겹쳐 쓰면 시간이 더해집니다(최대 ${x.feed.maxMinutes / 60}시간). 캐릭터마다 따로이고, 접속해 있는 동안만 줄며 쓰러져도 남습니다.`]),
    tr(['<b>모험가 월정액</b>', R(`+${pct(x.supporter)}`), '구독 중인 계정의 모든 캐릭터(<a href="#/drops#cash-shop">루비 상점</a>)']),
    tr(['<b>서버 축복</b>', R(`+${pct(x.blessing.bonus)}`), `누군가 루비 상점에서 사면 서버 전체에 ${x.blessing.minutes / 60}시간(남은 시간 최대 ${x.blessing.maxMinutes / 60}시간까지 쌓임)`]),
    ...(g ? [tr([`<b>${esc(g.name)}</b>`, R(`+${g.pct}%`), `<a href="#/world#guild-shop">길드 상점</a>에서 사면 길드원 전체에 ${D.guildShop.buffHours}시간`])] : []),
    ...bsExp.map((b) => tr([`<b>${esc(b.name)}</b>`, R(`+${b.pct}%`), `플레이어 대장장이의 <a href="#/classes/${esc(D.blacksmith.id)}#buff">장비 손질</a>, ${b.min}분`])),
  ];
  return `
    <h2 id="exp-bonus">경험치 배율</h2>
    <p>아래 보너스는 서로 곱하지 않고 <b>더합니다</b>: 배율 = 1 + 보너스 합. 예를 들어 정각 이벤트 중에 사료와 모험가 월정액이 함께 붙으면 ×${fmt(example)}입니다. 지금 붙는 합산 배율은 경험치 바에 보입니다.</p>
    ${table(['보너스', { t: '더하는 값', c: 'r' }, '조건·기간'], rows)}
    <ul class="plain small" style="margin-top:12px">
      <li><b>붙는 보상</b>: 몬스터 처치 · 레이드 클리어 · 던전 웨이브(${esc(lvDg?.name ?? '레벨업 던전')} 제외) · 필드 보스 원정 경험치.</li>
      <li><b>붙지 않는 보상</b>: 퀘스트 보상 · 레이드·필드 보스 원정 성장 보너스 · ${esc(lvDg?.name ?? '레벨업 던전')} · <a href="#/world#tavern">선술집 의뢰</a>.</li>
      <li>고레벨 사냥터의 연속 처치·사냥터 폭주 보너스도 처치 경험치 배율에 더합니다.</li>
      <li>운영자 확률 이벤트에는 경험치 말고도 ${ev.kinds.filter((k) => k.id !== 'exp').map((k) => esc(k.label)).join(' · ')} 배율이 있습니다. 확률은 배율만큼 곱하되 100%를 넘지 않고, 불운 보정(천장)은 곱하지 않습니다. 운영자 이벤트는 서버가 다시 켜지면 끝나고, 정각 이벤트는 다시 켜진 서버가 그 시간대 안이면 남은 시간만큼 다시 켭니다.</li>
    </ul>`;
}
/** 칭호: 이름 장식(능력치 없음). 얻는 법은 build.ts가 정의에서 만든다 */
function titlesSection() {
  return `
    <h2 id="titles">칭호</h2>
    <p>칭호는 능력치 효과가 없는 이름 장식입니다. 가진 칭호 중 하나를 스탯 창에서 골라 달거나 뗍니다. 달고 있는 칭호는 이름표, 채팅(<b>[칭호]이름</b>), 접속자 목록, 장비 보기에 보입니다. 서버 최초 칭호는 처음 달성한 사람(파티)에게만 나갑니다.</p>
    ${table(['칭호', '얻는 법', '설명'], D.titles.map((t) => tr([`<b style="color:${esc(t.color)}">${esc(t.name)}</b>`, esc(t.how), `<span class="small">${esc(t.desc)}</span>`])))}`;
}
function enhRankOptions() {
  const rows = [...D.awaken.tiers.map((r) => ({ ...r, group: '티어 장비' })), ...D.awaken.raidSets.map((r) => ({ ...r, group: '레이드 세트' }))].sort((a, b) => a.rank - b.rank);
  return rows.map((r) => `<option value="${r.rank}" ${r.rank === growthState.rank ? 'selected' : ''}>순위 ${r.rank} · ${esc(r.label)}</option>`).join('');
}
function enhanceTable() {
  const t = growthState.rank;
  let cumA = 0, cumG = 0, cumS = 0;
  const prev = { a: 0, g: 0, s: 0 };
  const rows = D.enhance.map((e) => {
    const p = e.rate / 100;
    const cost = Math.round(e.goldPerRank * t);
    const drop = e.failTo < e.from;
    // 한 단계 올리는 기대 비용: 실패해 내려가면 아래 단계를 다시 올려야 한다
    const a = drop ? (1 + (1 - p) * prev.a) / p : 1 / p;
    const g = drop ? (cost + (1 - p) * prev.g) / p : cost / p;
    const s = drop ? (e.scrolls + (1 - p) * prev.s) / p : e.scrolls / p;
    prev.a = a; prev.g = g; prev.s = s;
    cumA += a; cumG += g; cumS += s;
    return tr([R(`+${e.from} → +${e.to}`), R(`${e.rate}%`), e.failTo === e.from ? '유지' : `<span style="color:var(--bad)">+${e.failTo}로 하락</span>`, R(fmt(cost)), R(e.scrolls), R(fmt(Math.round(cumA * 10) / 10)), R(fmt(Math.round(cumG))), R(fmt(Math.round(cumS * 10) / 10))]);
  });
  return table([{ t: '단계', c: 'r' }, { t: '성공률', c: 'r' }, '실패하면', { t: '1회 베리', c: 'r' }, { t: '강화서', c: 'r' }, { t: '누적 기대 시도', c: 'r' }, { t: '누적 기대 베리', c: 'r' }, { t: '누적 기대 강화서', c: 'r' }], rows);
}
function bindGrowth() {
  document.getElementById('enh-tier').addEventListener('input', (e) => { growthState.rank = Number(e.target.value); document.getElementById('enh-table').innerHTML = enhanceTable(); });
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

const GROUPS = ['문서', '직업', '대장장이', '숙련도', '제련 옵션', '전직', '스킬', '소환수', '노래', '아이템', '몬스터', '지역', '레이드', '퀘스트', 'NPC', '콘텐츠'];
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
  for (const c of D.classes) {
    const hidden = c.id === D.blacksmith.id;
    add(hidden ? '대장장이' : '직업', c.name, `#/classes/${c.id}`, hidden ? `히든 직업 · ${c.role}` : `직업 · ${c.role}`, c.icon ? `<img class="ico sm" src="${esc(c.icon)}" alt="">` : ph('shield'), '', hidden ? '대장장이히든직업제련증강' : '직업');
  }
  for (const r of D.blacksmith.ranks) add('숙련도', `${r.name} 대장장이`, `#/classes/${D.blacksmith.id}#mastery`, `숙련도 ${fmt(r.score)} · 전문 ${r.spec} · 제련 ${r.lines}줄 · 비용 ${r.cost}%`, ph('hammer'), `옵션 값 ${r.band} · 1인 증강 ${r.augs}개`, '숙련도랭크대장장이전문구간');
  for (const o of D.blacksmith.options) add('제련 옵션', o.name, `#/classes/${D.blacksmith.id}#refine`, `제련 옵션 · ${o.bands.map((b) => `${b.min}~${b.max}${o.unit}`).join(' / ')}`, ph('sparkles'), o.slots.map((s) => KIND[s]).join(' · '), '제련옵션대장장이');
  for (const b of D.branches) add('전직', b.name, `#/classes/${b.classId}#br-${b.id}`, `${classOf(b.classId).name} 전직`, ph('git-branch'), b.concept, `${classOf(b.classId).name}전직`);
  for (const b of D.branches) add('전직', b.second.name, `#/classes/${b.classId}#br2-${b.id}`, `${b.name} 2차 전직`, ph('git-branch'), b.second.concept, `${classOf(b.classId).name}${b.name}2차전직`);
  for (const b of D.branches) if (b.third) add('전직', b.third.name, `#/classes/${b.classId}#br3-${b.id}`, `${b.second.name} 3차 전직`, ph('git-branch'), b.third.concept, `${classOf(b.classId).name}${b.name}3차전직`);
  const skillOwner = (s) => (s.branchId ? `·${s.third ? M.branches.get(s.branchId).third.name : s.second ? M.branches.get(s.branchId).second.name : M.branches.get(s.branchId).name}` : '');
  for (const s of D.skills) add('스킬', s.name, `#/skills/${s.id}`, `${classOf(s.classId).name}${skillOwner(s)} 스킬`, skillIcon(s, 'sm'), [s.desc, ...s.lines].join(' · '), `${classOf(s.classId).name}${skillOwner(s).slice(1)}스킬`);
  for (const s of D.summons.list) add('소환수', s.name, '#/classes/necromancer#summons', `네크로맨서 소환수 · 최대 HP ${s.hpPct}% · ${s.lifeSec}초`, ph('skull'), s.callers.map((c) => c.name).join(' · '), '소환수해골네크로맨서');
  for (const so of D.songs.list) add('노래', so.name, '#/classes/bard#songs', `바드 노래 · ${so.effect}`, so.icon ? `<img class="ico sm" src="${esc(so.icon)}" alt="">` : ph('sparkles'), so.casts.map((c) => c.skillName).join(' · '), '바드노래버프');
  for (const it of D.items) add('아이템', it.name, `#/items/${it.id}`, `${rarName(it.rarity)} ${KIND[it.kind]}${it.reqLevel ? ` · Lv${it.reqLevel}` : ''}`, itemIcon(it, 'sm'), it.desc, `${rarName(it.rarity)}${KIND[it.kind]}${it.classId ? classOf(it.classId).name : '공용'}`, `rar-${it.rarity}`);
  for (const m of D.mobs) add('몬스터', m.name, `#/mobs/${m.id}`, `${MOB_KIND[m.kind]} · Lv${m.level}`, ph(m.kind === 'field' ? 'skull' : 'crown'), m.islands.map(islandName).join(', '), `${MOB_KIND[m.kind]}몬스터`);
  for (const i of D.islands) {
    add('지역', i.name, `#/world#isl-${i.id}`, i.hub ? "모항 · 시작 마을" : `섬 · Lv${i.levelRange[0]}~${i.levelRange[1]}`, ph('map'), '', '섬지역');
    for (const n of i.npcs) add('NPC', n.name, `#/world#isl-${i.id}`, `${i.name} · ${ROLE[n.role] ?? n.role}`, ph('info'), '', `npc${ROLE[n.role] ?? ''}`);
    for (const qid of i.quests) {
      const q = M.quests.get(qid);
      if (q) add('퀘스트', q.name, `#/world#isl-${i.id}`, `${i.name} 퀘스트 · Lv${q.minLevel}`, ph('scroll-text'), '', '퀘스트');
    }
  }
  for (const r of D.raids) add('레이드', r.name, `#/world#raid-${r.id}`, `레이드 · 입장 Lv${r.minLevel}`, ph('crown'), r.phases.map((p) => p.label).join(' · '), '레이드');
  add('레이드', D.infinite.name, `#/world#raid-${D.infinite.id}`, `웨이브 던전 · 입장 Lv${D.infinite.minLevel} · 혼자~${D.infinite.size}인`, ph('crown'), '무한 웨이브 랭킹 서버 최초 유니크', '레이드');
  for (const d of D.dungeons.list) add('레이드', d.name, '#/world#dungeons', `일일 던전 · 하루 ${d.dailyLimit}번 · 혼자~${d.size}인`, ph('crown'), d.kind === 'levelup' ? '레벨업 던전 경험치 수련' : '장비 던전 장비 보물고', '일일던전');
  add('레이드', D.augment.name, `#/world#raid-${D.augment.id}`, `웨이브 던전 베타 · ${D.augment.every}웨이브마다 증강 카드`, ph('crown'), D.augment.list.map((a) => `${a.name} ${a.desc}`).join(' · '), '레이드 증강 베타 카드');
  for (const w of D.worldBosses) add('레이드', w.name, `#/world#wb-${w.id}`, `필드 보스 원정 · ${M.mobs.get(w.bossId)?.name ?? ''}`, ph('crown'), w.phases.map((p) => p.label).join(' · '), '필드보스 월드보스 원정');
  add('콘텐츠', D.duel.name, '#/world#duel', `PvP · ${D.duel.modes.map((m) => m.name).join(' · ')} · 입장 Lv${D.duel.minLevel}`, ph('swords'), `점수 매칭 ±${D.duel.matchRange} 결투 신청 친선`, '결투장 PvP 대전 결투 점수 레이팅');
  add('콘텐츠', '선술집 의뢰', '#/world#tavern', `노을마을 선술집 · ${D.tavern.rotateHours}시간마다 교체 · 개인 ${D.tavern.personalCount} · 공용 ${D.tavern.publicCount}`, ph('scroll-text'), D.tavern.publicKinds.map((k) => k.name).join(' · '), '선술집 의뢰 일퀘 일일 퀘스트 게시판 공용 개인 마고');
  const cq = D.catQuests;
  add('콘텐츠', '고양이 의뢰', '#/world#cat-quests', `${cq.hall} 곁가지 퀘스트 · ${cq.ids.length}개`, ph('scroll-text'), cq.npc, '고양이 의뢰 곁가지 퀘스트 선술집 김꼴꼴');
  add('NPC', cq.npc, '#/world#cat-quests', `${cq.hall} · 퀘스트`, ph('info'), '', 'npc퀘스트고양이');
  for (const id of cq.ids) {
    const q = M.quests.get(id);
    if (q) add('퀘스트', q.name, '#/world#cat-quests', `${cq.hall} 곁가지 · Lv${q.minLevel}`, ph('scroll-text'), '', '퀘스트고양이');
  }
  const so = D.social;
  add('콘텐츠', '거래소', '#/world#exchange', `수수료 ${so.exchange.feePct}% · 동시 등록 ${so.exchange.maxListings}개`, ph('coins'), '물건 올리기 판매 구매 대금', '거래소 경매장 판매 수수료');
  add('콘텐츠', '1:1 거래', '#/world#trade', `개인 거래 · 거리 ${so.trade.range} 안 · 베리 수수료 ${so.trade.feePct}%`, ph('coins'), '거래 신청 준비 확인', '거래 개인거래 교환');
  add('콘텐츠', '편지·우편함', '#/world#letter', `계정당 하루 ${so.letter.perDay}통 · 첨부 ${so.letter.attachMax}칸 + 베리`, ph('send'), '우표값 첨부 우편 받기', '편지 우편 우편함 우표 첨부');
  add('콘텐츠', '친구', '#/world#friends', `계정끼리 · 최대 ${so.friends.max}명`, ph('heart'), '친구 추가 요청 선물', '친구 요청 선물');
  add('콘텐츠', '게시판', '#/world#board', `메뉴(ESC) › 게시판 · 말머리 ${so.board.tags.join('·')}`, ph('scroll-text'), `개념글(추천 ${so.board.bestUp}개 이상) 검색 댓글 추천 비추천`, '게시판 갤러리 디시 글 댓글 개념글 커뮤니티');
  add('콘텐츠', `${D.constants.grades.absolute.name} 장비`, '#/drops#absolute', `최상위 장비 · 착용 Lv${D.constants.grades.absolute.reqLevel} · ${D.constants.grades.absolute.raidName}`, ph('crown'), `유니크의 ${D.constants.grades.absolute.overUnique}배 모든 능력치 +${D.constants.grades.absolute.allStat}`, '앱솔루트 absolute 최초의 용자 황혼');
  add('콘텐츠', '파티 붐박스', '#/world#boombox', `파티 음악 · ${D.gems.name} ${D.boombox.gemPrice}개 = ${D.boombox.passMinutes}분`, ph('sparkles'), '유튜브 곡 대기열 이용권', '붐박스 음악 유튜브 노래 파티');
  add('콘텐츠', '명예의 전당', '#/world#hall-of-fame', `${D.hallOfFame.season} 레벨 랭킹 상위 ${D.hallOfFame.legends.length}명 동상`, ph('crown'), D.hallOfFame.legends.map((l) => l.name).join(' · '), '명예의전당 동상 랭커 시즌');
  for (const t of D.titles) add('콘텐츠', t.name, '#/growth#titles', `칭호 · ${t.how}`, ph('crown'), t.desc, '칭호');
  for (const c of D.cosmetics.list) add('콘텐츠', c.name, '#/drops#cosmetics', `꾸미기 · ${D.cosmetics.slots.find((s) => s.id === c.slot)?.name ?? c.slot}`, ph('sparkles'), `${c.desc} ${c.sources.join(' · ')}`, '꾸미기 오라 궤적 레벨업');
  for (const p of D.cashShop.products) if (p.kind !== 'cosmetic') add('콘텐츠', p.name, '#/drops#cash-shop', `루비 상점 · ${fmt(p.priceRuby)}루비`, ph('gem'), p.contents.join(' · '), '상점 루비 현금');
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
    ? '<div class="empty-state">찾을 낱말을 입력하세요. 예: 크라켄, 합성, 강화서, ㅎㄱㅅ</div>'
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
/** 목차에서 지금 읽는 절(목차 바로 아래 선을 지난 마지막 h2)을 표시하고, 목차가 가로로 넘치면 그 칩이 보이게 민다 */
function spyToc() {
  const toc = main.querySelector('.toc');
  if (!toc) return;
  const line = toc.getBoundingClientRect().bottom + 24;
  let cur = null;
  for (const a of toc.querySelectorAll('a[data-sec]')) if ((document.getElementById(a.dataset.sec)?.getBoundingClientRect().top ?? Infinity) <= line) cur = a;
  for (const a of toc.querySelectorAll('a')) {
    if (a === cur) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
  if (cur && (cur.offsetLeft < toc.scrollLeft || cur.offsetLeft + cur.offsetWidth > toc.scrollLeft + toc.clientWidth - 40)) toc.scrollLeft = cur.offsetLeft - 16;
}
/** 칸이 5개 이상인 표에 .wide와 칸 이름(data-label)을 단다 — 좁은 화면에서 줄마다 카드로 풀 때 쓴다(style.css) */
function labelTables(root) {
  for (const t of root.querySelectorAll('table:not([data-cols])')) {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.dataset.cols = String(heads.length);
    if (heads.length >= 5) t.classList.add('wide');
    for (const row of t.querySelectorAll('tbody tr')) [...row.children].forEach((td, i) => { if (heads[i] && td.colSpan === 1) td.dataset.label = heads[i]; });
  }
}
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
    if (secs.length >= 3) main.querySelector('.page-head')?.insertAdjacentHTML('afterend', `<nav class="toc" aria-label="이 페이지 목차">${secs.map((s) => `<a href="#/${page}#${s.id}" data-sec="${s.id}">${esc(s.title)}</a>`).join('')}</nav>`);
    spyToc();
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
  M.dungeons = new Map(D.dungeons.list.map((d) => [d.id, d]));
  document.getElementById('play').href = D.meta.gameUrl;
  const built = new Date(D.meta.builtAt);
  document.getElementById('build-info').textContent = `실서버 게임 데이터(${D.meta.commit}) 기준 · ${built.toLocaleDateString('ko-KR')} 갱신`;
  resetCalcFor('knight');
  buildSearch();
  initSearch();
  initNav();
  window.addEventListener('hashchange', render);
  // 표가 그려질 때마다(목록 거르기 포함) 칸 이름을 단다. data-* 속성만 바꾸므로 다시 불리지 않는다
  new MutationObserver(() => labelTables(main)).observe(main, { childList: true, subtree: true });
  let spyQueued = false;
  window.addEventListener('scroll', () => {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(() => { spyQueued = false; spyToc(); });
  }, { passive: true });
  // 목차 칩은 페이지를 다시 그리지 않고 그 절로 부드럽게 옮긴다(주소만 바꾼다)
  main.addEventListener('click', (e) => {
    const a = e.target.closest('.toc a[data-sec]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    document.getElementById(a.dataset.sec)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  render();
}
start();
