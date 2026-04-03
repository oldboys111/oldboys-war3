// ========================================
// 大鸟群 WC3战绩系统 - JavaScript
// 静态版本（直接从 JSON 文件加载）
// ========================================

// 缓存数据
let cachedPlayers = [];
let cachedMatches = [];
let cachedEvents = {};
let cachedChampions = {};
let cachedTokens = {};

// 加载 JSON 文件
async function loadJSON(filename) {
    try {
        const res = await fetch(filename);
        return await res.json();
    } catch (e) {
        console.error(`加载 ${filename} 失败:`, e);
        return null;
    }
}

// 初始化数据
async function initData() {
    const players = await loadJSON('data/players.json');
    const matches = await loadJSON('data/matches.json');
    const events = await loadJSON('data/events.json');
    const champions = await loadJSON('data/champions.json');
    const tokens = await loadJSON('data/tokens.json');

    if (players) cachedPlayers = players;
    if (matches) cachedMatches = matches;
    if (events) cachedEvents = events;
    if (champions) cachedChampions = champions;
    if (tokens) cachedTokens = tokens;

    console.log('数据加载完成:', {
        players: cachedPlayers.length,
        matches: cachedMatches.length
    });
}

// 获取选手列表
function getPlayers() {
    return cachedPlayers;
}

// 获取对战记录
function getMatches() {
    return cachedMatches;
}

// 获取等级颜色
function getLevelColor(level) {
    const colors = {
        'SR': '#b8860b', 'S': '#e74c3c', 'A': '#e67e22',
        'B': '#f1c40f', 'C': '#6495ed', 'D': '#3498db',
        'E': '#27ae60', 'F': '#9b59b6', 'G': '#7f8c8d'
    };
    return colors[level] || '#888';
}

// 获取等级名称
function getLevelName(level) {
    const names = {
        'SR': '传说', 'S': '宗师', 'A': '大师',
        'B': '钻石', 'C': '黄金', 'D': '白银',
        'E': '青铜', 'F': '新星', 'G': '新秀'
    };
    return names[level] || level;
}

// 根据积分获取等级
function getLevelByPoints(points) {
    if (points >= 2000) return 'SR';
    if (points >= 1800) return 'S';
    if (points >= 1600) return 'A';
    if (points >= 1400) return 'B';
    if (points >= 1200) return 'C';
    if (points >= 1000) return 'D';
    if (points >= 800) return 'E';
    if (points >= 600) return 'F';
    return 'G';
}

// 根据排名获取等级（按比例分配）
function getPlayerLevel(playerId) {
    const players = getPlayers();
    if (!players.length) return 'G';

    const sorted = [...players].sort((a, b) => b.points - a.points);

    // 等级人数限制
    const limits = { 'SR': 5, 'S': 10, 'A': 10, 'B': 10, 'C': 10, 'D': 10, 'E': 10, 'F': 10 };
    let remaining = { 'SR': 0, 'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'F': 0 };

    // 计算每个等级的当前人数
    const counts = { 'SR': 0, 'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'F': 0, 'G': 0 };
    sorted.forEach(p => {
        const lvl = getLevelByPoints(p.points);
        counts[lvl]++;
    });

    // 分配等级
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].id === playerId) {
            // 优先按积分分配
            const pointLevel = getLevelByPoints(sorted[i].points);
            // 检查该等级是否还有名额
            if (counts[pointLevel] <= (limits[pointLevel] || 999)) {
                return pointLevel;
            }
            // 否则分配下一个有名额的等级
            const levels = ['SR', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
            for (const lvl of levels) {
                if (counts[lvl] <= (limits[lvl] || 999)) {
                    counts[lvl]--;
                    return lvl;
                }
            }
            return 'G';
        }
    }
    return 'G';
}

// 种族名称映射
function getRaceName(race) {
    const names = { 'HUM': '人族', 'ORC': '兽族', 'UD': '亡灵', 'NE': '暗夜', '随机': '随机' };
    return names[race] || race;
}

// 种族图标
function getRaceIcon(race) {
    const icons = {
        'HUM': '⚔️', 'ORC': '🪓', 'UD': '💀', 'NE': '🌙', '随机': '🎲'
    };
    return icons[race] || '❓';
}

// 页面导航
let currentPage = 'overview';

function showPage(page) {
    currentPage = page;

    // 更新导航按钮
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === page) btn.classList.add('active');
    });

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 显示当前页面
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    // 渲染页面内容
    if (page === 'overview') renderOverview();
    else if (page === 'members') renderMembers();
    else if (page === 'battles') renderBattles();
    else if (page === 'honor') renderHonor();
}

// 渲染总览页面
function renderOverview() {
    const players = getPlayers();
    const matches = getMatches();
    const champions = cachedChampions || [];

    // 更新统计
    document.getElementById('stat-total-players').textContent = players.length;
    document.getElementById('stat-total-matches').textContent = matches.length;
    document.getElementById('stat-total-champions').textContent = champions.length;

    // 计算平均胜率
    if (players.length > 0) {
        let totalWinRate = 0;
        players.forEach(p => {
            const wins = p.wins || 0;
            const losses = p.losses || 0;
            const total = wins + losses;
            if (total > 0) {
                totalWinRate += (wins / total) * 100;
            }
        });
        const avgWinRate = (totalWinRate / players.length).toFixed(1);
        document.getElementById('stat-avg-winrate').textContent = avgWinRate + '%';
    }

    // TOP 10 选手
    const topPlayers = [...players].sort((a, b) => b.points - a.points).slice(0, 10);
    const topList = document.getElementById('top-players-list');
    topList.innerHTML = topPlayers.map((p, i) => {
        const level = getPlayerLevel(p.id);
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
        return `
            <div class="top-player-item">
                <span class="top-rank ${rankClass}">${i + 1}</span>
                <span style="flex:1">${p.name}</span>
                <span style="color:${getLevelColor(level)}">${p.points}分</span>
            </div>
        `;
    }).join('');

    // 近期冠军
    const recentChampions = champions.slice(-5).reverse();
    const championList = document.getElementById('recent-champions-list');
    if (recentChampions.length === 0) {
        championList.innerHTML = '<p style="color:#888;text-align:center;padding:20px">暂无冠军记录</p>';
    } else {
        championList.innerHTML = recentChampions.map(c => {
            const player = players.find(p => p.id === c.playerId);
            return `
                <div class="top-player-item">
                    <span>🏆</span>
                    <span style="flex:1">${c.event || '未知赛事'}</span>
                    <span style="color:#ffd700">${player ? player.name : '未知'}</span>
                </div>
            `;
        }).join('');
    }
}

// ========================================
// 成员页面
// ========================================

function renderMembers() {
    const container = document.getElementById('members-list');
    if (!container) return;

    const players = getPlayers();
    if (!players.length) {
        container.innerHTML = '<div class="empty-state">暂无成员数据</div>';
        return;
    }

    // 按积分排序
    const sorted = [...players].sort((a, b) => b.points - a.points);

    // 按等级分组
    const groups = { 'SR': [], 'S': [], 'A': [], 'B': [], 'C': [], 'D': [], 'E': [], 'F': [], 'G': [] };

    sorted.forEach((p, i) => {
        const level = getPlayerLevel(p.id);
        groups[level].push({ ...p, rank: i + 1 });
    });

    let html = '';

    // 渲染每个等级组
    ['SR', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(level => {
        const members = groups[level];
        if (!members.length) return;

        const color = getLevelColor(level);
        html += `
            <div class="level-group">
                <div class="level-header" style="background: ${color}">
                    <span class="level-badge">${level}</span>
                    <span class="level-name">${getLevelName(level)}</span>
                    <span class="level-count">${members.length}人</span>
                </div>
                <div class="members-table">
                    <div class="table-header">
                        <span class="col-rank">排名</span>
                        <span class="col-name">ID</span>
                        <span class="col-race">种族</span>
                        <span class="col-kkname">KK昵称</span>
                        <span class="col-points">积分</span>
                        <span class="col-stats">胜/负</span>
                        <span class="col-apm">APM</span>
                    </div>
        `;

        members.forEach(p => {
            html += `
                <div class="member-row" onclick="showPlayerDetail('${p.id}')">
                    <span class="col-rank">#${p.rank}</span>
                    <span class="col-name">${p.name}</span>
                    <span class="col-race">${getRaceIcon(p.race)} ${getRaceName(p.race)}</span>
                    <span class="col-kkname">${p.kkname || '-'}</span>
                    <span class="col-points">${p.points}</span>
                    <span class="col-stats ${p.wins > p.losses ? 'win' : 'loss'}">${p.wins}/${p.losses}</span>
                    <span class="col-apm">${p.apm || 0}</span>
                </div>
            `;
        });

        html += '</div></div>';
    });

    container.innerHTML = html;
}

// 显示成员详情
function showPlayerDetail(playerId) {
    const players = getPlayers();
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-detail-content');

    const level = getPlayerLevel(player.id);
    const wins = player.wins || 0;
    const losses = player.losses || 0;
    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;

    // 获取对战历史
    const matches = getMatches().filter(m => m.player1 === playerId || m.player2 === playerId);
    const recentMatches = matches.slice(-10).reverse();

    content.innerHTML = `
        <div class="detail-header" style="border-left: 4px solid ${getLevelColor(level)}">
            <div class="detail-title">
                <h2>${player.name}</h2>
                <span class="level-badge" style="background: ${getLevelColor(level)}">${level}</span>
            </div>
            <div class="detail-race">${getRaceIcon(player.race)} ${getRaceName(player.race)}</div>
        </div>

        <div class="detail-stats">
            <div class="stat-card">
                <div class="stat-value">${player.points}</div>
                <div class="stat-label">积分</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${wins}</div>
                <div class="stat-label">胜场</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${losses}</div>
                <div class="stat-label">负场</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${winRate}%</div>
                <div class="stat-label">胜率</div>
            </div>
        </div>

        ${player.kkname ? `<div class="detail-info"><strong>KK昵称:</strong> ${player.kkname}</div>` : ''}
        ${player.kkRank ? `<div class="detail-info"><strong>KK段位:</strong> ${player.kkRank}</div>` : ''}
        ${player.apm ? `<div class="detail-info"><strong>APM:</strong> ${player.apm}</div>` : ''}
        ${player.trait ? `<div class="detail-info"><strong>特点:</strong> ${player.trait}</div>` : ''}
        ${player.glory ? `<div class="detail-info"><strong>荣誉:</strong> ${player.glory}</div>` : ''}
        ${player.honors ? `<div class="detail-info"><strong>其他荣誉:</strong> ${player.honors}</div>` : ''}

        <div class="recent-matches">
            <h3>近期对战</h3>
            ${recentMatches.length ? recentMatches.map(m => {
                const opponentId = m.player1 === playerId ? m.player2 : m.player1;
                const opponent = players.find(p => p.id === opponentId);
                const isWinner = m.result === 'player1_win' && m.player1 === playerId ||
                                 m.result === 'player2_win' && m.player2 === playerId;
                return `
                    <div class="match-item ${isWinner ? 'win' : 'loss'}">
                        <span class="match-date">${m.date || '-'}</span>
                        <span class="match-vs">vs ${opponent ? opponent.name : '未知'}</span>
                        <span class="match-score">${m.score || '-'}</span>
                        <span class="match-result">${isWinner ? '胜' : '负'}</span>
                    </div>
                `;
            }).join('') : '<p>暂无对战记录</p>'}
        </div>
    `;

    modal.style.display = 'flex';
}

// ========================================
// 对战页面
// ========================================

let currentMatchFilter = 'all';
let currentMatchPlayer = '';

function filterMatches() {
    currentMatchFilter = document.getElementById('match-type-filter')?.value || 'all';
    currentMatchPlayer = document.getElementById('match-player-search')?.value?.toLowerCase() || '';
    renderBattles();
}

function renderBattles() {
    const container = document.getElementById('battles-list');
    if (!container) return;

    let matches = getMatches();

    // 过滤
    if (currentMatchFilter !== 'all') {
        matches = matches.filter(m => m.type === currentMatchFilter);
    }

    if (currentMatchPlayer) {
        const players = getPlayers();
        const playerIds = players
            .filter(p => p.name.toLowerCase().includes(currentMatchPlayer) ||
                        (p.kkname && p.kkname.toLowerCase().includes(currentMatchPlayer)))
            .map(p => p.id);
        matches = matches.filter(m => playerIds.includes(m.player1) || playerIds.includes(m.player2));
    }

    // 排序
    matches = [...matches].sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });

    if (!matches.length) {
        container.innerHTML = '<div class="empty-state">暂无对战记录</div>';
        return;
    }

    const players = getPlayers();

    container.innerHTML = matches.slice(0, 50).map(m => {
        const p1 = players.find(p => p.id === m.player1);
        const p2 = players.find(p => p.id === m.player2);
        const p1Level = p1 ? getPlayerLevel(p1.id) : '';
        const p2Level = p2 ? getPlayerLevel(p2.id) : '';

        const typeClass = { '天梯': 'ladder', '自定义': 'custom', '杯赛': 'cup' }[m.type] || '';

        return `
            <div class="battle-item">
                <div class="battle-date">${m.date || '-'}</div>
                <div class="battle-player">
                    <span class="player-name" style="color: ${getLevelColor(p1Level)}">${p1 ? p1.name : m.player1}</span>
                    <span class="player-level">${p1Level}</span>
                </div>
                <div class="battle-score">${m.score || '?'}</div>
                <div class="battle-player">
                    <span class="player-name" style="color: ${getLevelColor(p2Level)}">${p2 ? p2.name : m.player2}</span>
                    <span class="player-level">${p2Level}</span>
                </div>
                <div class="battle-type ${typeClass}">${m.type || '天梯'}</div>
            </div>
        `;
    }).join('');
}

// ========================================
// 荣誉页面
// ========================================

function renderHonor() {
    const container = document.getElementById('honor-list');
    if (!container) return;

    const champions = cachedChampions || [];
    const players = getPlayers();

    if (!champions.length) {
        container.innerHTML = '<div class="empty-state">暂无冠军记录</div>';
        return;
    }

    // 按类型分组
    const groups = { '个人赛': [], '杯赛': [], '团队赛': [], '2v2赛': [] };

    champions.forEach(c => {
        const type = c.type || '个人赛';
        if (groups[type]) groups[type].push(c);
    });

    let html = '';

    Object.entries(groups).forEach(([type, items]) => {
        if (!items.length) return;

        html += `
            <div class="honor-group">
                <h3 class="honor-type-title">${type}</h3>
        `;

        items.forEach(c => {
            const player = players.find(p => p.id === c.playerId);
            const level = player ? getPlayerLevel(player.id) : '';

            html += `
                <div class="honor-item">
                    <div class="honor-event">${c.event || '未知赛事'}</div>
                    <div class="honor-player" style="color: ${getLevelColor(level)}">
                        👑 ${player ? player.name : '未知'}
                    </div>
                    <div class="honor-date">${c.date || '-'}</div>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;
}

// ========================================
// 赛事页面
// ========================================

function renderEvents() {
    const container = document.getElementById('event-list');
    if (!container) return;

    const events = cachedEvents || {};

    if (Object.keys(events).length === 0) {
        container.innerHTML = '<div class="empty-state">暂无赛事数据</div>';
        return;
    }

    let html = '';

    Object.entries(events).forEach(([id, event]) => {
        html += `
            <div class="event-item">
                <div class="event-icon">${event.icon || '🏆'}</div>
                <div class="event-info">
                    <div class="event-name">${event.name || '未知赛事'}</div>
                    <div class="event-type">${event.type || '淘汰赛'} · ${event.date || '-'}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========================================
// 工具函数
// ========================================

// 关闭弹窗
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// 搜索成员
function searchMembers() {
    renderMembers();
}

// 过滤成员
function filterMembers() {
    const searchText = document.getElementById('member-search')?.value?.toLowerCase() || '';
    const raceFilter = document.getElementById('race-filter')?.value || '';

    const container = document.getElementById('members-list');
    if (!container) return;

    let players = getPlayers();

    // 搜索过滤
    if (searchText) {
        players = players.filter(p =>
            p.name.toLowerCase().includes(searchText) ||
            (p.kkname && p.kkname.toLowerCase().includes(searchText))
        );
    }

    // 种族过滤
    if (raceFilter) {
        players = players.filter(p => p.race === raceFilter);
    }

    if (!players.length) {
        container.innerHTML = '<div class="empty-state">没有找到匹配的成员</div>';
        return;
    }

    // 按积分排序
    const sorted = [...players].sort((a, b) => b.points - a.points);

    // 按等级分组
    const groups = { 'SR': [], 'S': [], 'A': [], 'B': [], 'C': [], 'D': [], 'E': [], 'F': [], 'G': [] };

    sorted.forEach((p, i) => {
        const level = getPlayerLevel(p.id);
        groups[level].push({ ...p, rank: i + 1 });
    });

    let html = '';

    ['SR', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(level => {
        const members = groups[level];
        if (!members.length) return;

        const color = getLevelColor(level);
        html += `
            <div class="level-group">
                <div class="level-header" style="background: ${color}">
                    <span class="level-badge">${level}</span>
                    <span class="level-name">${getLevelName(level)}</span>
                    <span class="level-count">${members.length}人</span>
                </div>
                <div class="members-table">
                    <div class="table-header">
                        <span class="col-rank">排名</span>
                        <span class="col-name">ID</span>
                        <span class="col-race">种族</span>
                        <span class="col-kkname">KK昵称</span>
                        <span class="col-points">积分</span>
                        <span class="col-stats">胜/负</span>
                        <span class="col-apm">APM</span>
                    </div>
        `;

        members.forEach(p => {
            html += `
                <div class="member-row" onclick="showPlayerDetail('${p.id}')">
                    <span class="col-rank">#${p.rank}</span>
                    <span class="col-name">${p.name}</span>
                    <span class="col-race">${getRaceIcon(p.race)} ${getRaceName(p.race)}</span>
                    <span class="col-kkname">${p.kkname || '-'}</span>
                    <span class="col-points">${p.points}</span>
                    <span class="col-stats ${p.wins > p.losses ? 'win' : 'loss'}">${p.wins || 0}/${p.losses || 0}</span>
                    <span class="col-apm">${p.apm || 0}</span>
                </div>
            `;
        });

        html += '</div></div>';
    });

    container.innerHTML = html;
}

// 过滤对战
function filterBattles() {
    currentMatchFilter = document.getElementById('match-type-filter')?.value || 'all';
    currentMatchPlayer = document.getElementById('match-player-search')?.value?.toLowerCase() || '';
    renderBattles();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initData();
    showPage('overview');
});
