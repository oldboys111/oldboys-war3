// ========================================
// 大鸟群 WC3战绩系统 - JavaScript
// 静态版本（GitHub Pages 专用）
// ========================================

// API 配置
const API_BASE = 'http://localhost:5000/api';
let authToken = localStorage.getItem('wc3_api_token') || null;
let currentUsername = localStorage.getItem('wc3_username') || null;

// 静态模式管理员账号（可以在此修改）
const STATIC_ADMIN = {
    username: 'admin',
    password: 'wc32024'
};

// 缓存数据
let cachedPlayers = [];
let cachedMatches = [];
let cachedEvents = {};
let cachedChampions = {};
let cachedShowEvents = [];  // 赛事管理页面的赛事列表（从 event_infos.json 加载）

// API 请求辅助函数
async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        return await res.json();
    } catch (e) {
        console.error('API GET error:', e);
        return null;
    }
}

async function apiPost(endpoint, data) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error('API POST error:', e);
        return { error: e.message };
    }
}

async function apiPut(endpoint, data) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error('API PUT error:', e);
        return { error: e.message };
    }
}

async function apiDelete(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        return await res.json();
    } catch (e) {
        console.error('API DELETE error:', e);
        return { error: e.message };
    }
}

// 检查是否已登录（静态模式版本）
async function checkAuth() {
    // 优先使用本地存储的 token
    if (authToken) {
        currentUsername = localStorage.getItem('wc3_username') || 'admin';
        return true;
    }
    
    // 尝试连接 API 服务器
    try {
        const res = await apiGet('/auth/check');
        if (res && res.loggedIn) {
            currentUsername = res.username;
            return true;
        }
    } catch (e) {
        // API 不可用，使用本地验证
        console.log('使用本地登录验证（静态模式）');
    }
    return false;
}

// 种族配置
const RACES = {
    HUM: { name: '人族', color: '#4a90d9', icon: 'images/人族.jpg', size: { small: 18, medium: 16, large: 40 } },
    ORC: { name: '兽族', color: '#e67e22', icon: 'images/兽族.jpg', size: { small: 18, medium: 16, large: 40 } },
    UD: { name: '亡灵', color: '#4a148c', icon: 'images/不死.jpg' },
    NE: { name: '暗夜', color: '#27ae60', icon: 'images/暗夜3.jpg', size: { small: 18, medium: 16, large: 40 } }
};

// 等级人数配置：SR=5人, A到F=10人, G不限
const LEVEL_LIMITS = {
    'SR': 5,
    'S': 10,
    'A': 10,
    'B': 10,
    'C': 10,
    'D': 10,
    'E': 10,
    'F': 10,
    'G': 9999
};
const LEVEL_ORDER = ['SR', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// 根据排名动态计算等级（用于玩家等级显示）
function getPlayerLevel(playerId) {
    const players = getPlayers();
    if (!players || players.length === 0) return 'G';
    
    // 按积分降序排列
    const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
    
    // 找到玩家的排名位置（使用严格相等）
    let rank = -1;
    for (let i = 0; i < sortedPlayers.length; i++) {
        if (sortedPlayers[i].id === playerId) {
            rank = i;
            break;
        }
    }
    if (rank === -1) return 'G';
    
    // 根据排名确定等级
    let count = 0;
    for (const level of LEVEL_ORDER) {
        if (rank < count + LEVEL_LIMITS[level]) {
            return level;
        }
        count += LEVEL_LIMITS[level];
    }
    return 'G';
}

// 根据积分判断等级（用于团队赛等场景）
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

// 获取等级数值（用于计算平均段位）
function getLevelValue(level) {
    const values = { 'SR': 8, 'S': 7, 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1, 'G': 0 };
    return values[level] || 0;
}

// 清理已删除的分类数据
function cleanUpOldData() {
    // 清理荣誉赛事数据 - 删除大鸟杯和2v2赛分类
    const events = getEvents();
    if (events.bird) {
        delete events.bird;
        saveEvents(events);
    }
    if (events['2v2']) {
        delete events['2v2'];
        saveEvents(events);
    }
    
    // 清理对应的冠军数据
    const champions = getChampions();
    let changed = false;
    ['bird-cup-1', '2v2-match'].forEach(id => {
        if (champions[id]) {
            delete champions[id];
            changed = true;
        }
    });
    if (changed) {
        saveChampions(champions);
    }
}

// 检测运行模式
let RUNTIME_MODE = 'api';

async function detectRuntimeMode() {
    try {
        const res = await fetch(`${API_BASE}/players`, { method: 'GET' });
        if (res.ok) {
            RUNTIME_MODE = 'api';
            console.log('✅ 运行模式: API (本地服务器)');
            return;
        }
    } catch (e) {
        // API 不可用
    }
    RUNTIME_MODE = 'static';
    console.log('📁 运行模式: 静态文件 (GitHub Pages)');
}

// 从 JSON 文件加载数据（静态模式）
async function loadJSON(filename) {
    try {
        const res = await fetch(`data/${filename}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error(`加载 data/${filename} 失败:`, e);
    }
    return null;
}

// 异步加载所有数据
async function loadAllData() {
    await detectRuntimeMode();

    if (RUNTIME_MODE === 'api') {
        // API 模式 - 从服务器加载
        cachedPlayers = await apiGet('/players') || [];
        cachedMatches = await apiGet('/matches') || [];
        cachedEvents = await apiGet('/events') || {};
        cachedChampions = await apiGet('/champions') || {};
    } else {
        // 静态模式 - 从 JSON 文件加载
        const players = await loadJSON('players.json');
        const matches = await loadJSON('matches.json');
        const events = await loadJSON('events.json');
        const champions = await loadJSON('champions.json');
        const eventInfos = await loadJSON('event_infos.json');  // 加载赛事管理数据

        console.log('原始数据:', { players, matches, events, champions, eventInfos });

        if (players) cachedPlayers = players;
        
        // 处理 matches 数据格式兼容性
        if (matches && Array.isArray(matches)) {
            cachedMatches = matches.map((m, idx) => {
                console.log(`处理第 ${idx + 1} 条对战记录:`, m);
                // 新格式已经有 redPlayers/bluePlayers
                if (m.redPlayers && m.bluePlayers) {
                    return m;
                }
                // 旧格式 (player1, player2, score) 转换为新格式
                // result 字段存的是玩家名字（非ID），格式如 "LNR.Lyn胜"
                if (m.player1 && m.player2) {
                    // 从 result 中提取胜者名字（去掉末尾的"胜"字）
                    const winnerName = m.result ? m.result.replace(/胜$/, '') : '';
                    // 通过 players 数据查找 player1 和 player2 对应的名字
                    const p1Data = cachedPlayers.find(p => p.id === m.player1);
                    const p2Data = cachedPlayers.find(p => p.id === m.player2);
                    const p1Name = p1Data?.name || p1Data?.kkName || '';
                    const p2Name = p2Data?.name || p2Data?.kkName || '';
                    // 判断 player1 是否是胜者（比较名字是否包含在 result 中）
                    const isP1Winner = winnerName && (
                        (p1Name && p1Name.includes(winnerName)) ||
                        (p1Data?.kkName && p1Data.kkName.includes(winnerName))
                    );
                    const redId = isP1Winner ? m.player1 : m.player2;
                    const blueId = isP1Winner ? m.player2 : m.player1;
                    return {
                        id: m.id || 'm' + Date.now(),
                        type: m.type === '天梯' || m.type === 'ladder' ? 'ladder' : 'custom',
                        date: m.date || new Date().toISOString(),
                        redPlayers: [redId],
                        bluePlayers: [blueId],
                        redScore: isP1Winner ? parseInt(m.score?.split('-')[0]) || 1 : parseInt(m.score?.split('-')[1]) || 0,
                        blueScore: isP1Winner ? parseInt(m.score?.split('-')[1]) || 0 : parseInt(m.score?.split('-')[0]) || 1
                    };
                }
                // 未知格式，返回原始数据
                console.warn('未知对战记录格式:', m);
                return m;
            });
        } else {
            cachedMatches = [];
        }
        
        if (events) cachedEvents = events;
        if (champions) cachedChampions = champions;
        
        // 处理 event_infos 数据 - 转换为网站赛事页面需要的格式
        if (eventInfos && eventInfos.events) {
            cachedShowEvents = eventInfos.events.map(e => ({
                id: e.id,
                name: e.name,
                emoji: '🏆',  // 默认图标
                subtitle: e.subtitle || '',  // 保留subtitle，但工具端会用它作为地图池
                maps: e.maps || [],  // 地图池
                mapsText: e.mapsText || '',  // 地图池文本
                sponsor: e.sponsor || '',  // 赞助商
                status: 'ongoing',  // 默认状态
                description: e.description || ''
            }));
        }
        
        console.log('冠军数据加载结果:', champions);
        console.log('cachedChampions 状态:', cachedChampions);
        console.log('cachedShowEvents 状态:', cachedShowEvents);
    }

    console.log('数据加载完成:', {
        mode: RUNTIME_MODE,
        players: cachedPlayers.length,
        matches: cachedMatches.length,
        champions: Object.keys(cachedChampions).length,
        showEvents: cachedShowEvents.length
    });
    console.log('cachedMatches 示例:', cachedMatches.slice(0, 2));
}

// 初始化数据
async function initData() {
    await loadAllData();
}

// 获取数据（使用缓存）
function getPlayers() {
    return cachedPlayers;
}

function getMatches() {
    return cachedMatches;
}

// 获取赛事数据（优先使用缓存，兼容 localStorage）
function getEvents() {
    // 优先使用 API/JSON 缓存
    if (cachedEvents && Object.keys(cachedEvents).length > 0) {
        return cachedEvents;
    }
    // 降级到 localStorage
    const data = localStorage.getItem('wc3_events');
    return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DEFAULT_EVENTS));
}

// 获取冠军数据（优先使用缓存，兼容 localStorage）
function getChampions() {
    // 优先使用 API/JSON 缓存
    if (cachedChampions && Object.keys(cachedChampions).length > 0) {
        return cachedChampions;
    }
    // 降级到 localStorage
    const data = localStorage.getItem('wc3_champions');
    return data ? JSON.parse(data) : {};
}

// 从 JSON 文件直接加载冠军数据（静态模式专用后备）
async function loadChampionsFromJSON() {
    try {
        const res = await fetch('data/champions.json');
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error('加载 champions.json 失败:', e);
    }
    return null;
}

// 保存数据（通过 API）
async function savePlayers(players) {
    cachedPlayers = players;
    // 批量更新积分
    const updates = players.map(p => ({ id: p.id, points: p.points }));
    await apiPost('/players/updatePoints', updates);
}

async function saveMatches(matches) {
    cachedMatches = matches;
    // 同步到服务器（单条）
}

async function saveEvents(events) {
    cachedEvents = events;
}

async function saveChampions(champions) {
    cachedChampions = champions;
}

// 刷新数据
async function refreshData() {
    await loadAllData();
}

// 页面导航
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    renderCurrentPage(page);
}

// 渲染当前页面
function renderCurrentPage(page) {
    switch(page) {
        case 'overview': renderOverview(); break;
        case 'members': 
            const searchText = document.getElementById('member-search')?.value || '';
            const filterLevel = document.querySelector('.level-tab.active')?.dataset.level || 'all';
            renderMembers('all', filterLevel, searchText); 
            break;
        case 'matches': renderMatches(); break;
        case 'honors': renderHonors(); break;
        case 'events': renderEvents(); break;
    }
}

// 渲染总览页面
function renderOverview() {
    const matches = getMatches().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const players = getPlayers().sort((a, b) => b.points - a.points).slice(0, 10);

    // 最近对战 - 添加安全检查处理旧格式数据
    const recentHtml = matches.map(m => {
        const players = getPlayers();
        // 安全检查：确保是数组
        const redIds = Array.isArray(m.redPlayers) ? m.redPlayers : (m.player1 ? [m.player1] : []);
        const blueIds = Array.isArray(m.bluePlayers) ? m.bluePlayers : (m.player2 ? [m.player2] : []);
        const redNames = redIds.map(id => players.find(p => p.id === id)?.name || '未知').join(' / ');
        const blueNames = blueIds.map(id => players.find(p => p.id === id)?.name || '未知').join(' / ');
        const time = formatTimeAgo(m.date);
        // 安全检查：处理新旧格式的分数
        const redScore = typeof m.redScore === 'number' ? m.redScore : (m.score ? parseInt(m.score.split('-')[0]) : 0);
        const blueScore = typeof m.blueScore === 'number' ? m.blueScore : (m.score ? parseInt(m.score.split('-')[1]) : 0);
        const result = redScore > blueScore ? 'red' : 'blue';
        
        return `
            <div class="recent-match-item">
                <div class="recent-match-teams">
                    <span class="recent-match-team team-red-bg">${redNames}</span>
                    <span class="recent-match-vs">VS</span>
                    <span class="recent-match-team team-blue-bg">${blueNames}</span>
                </div>
                <span class="recent-match-result ${result === 'red' ? 'team-red-bg' : 'team-blue-bg'}">${redScore}:${blueScore}</span>
                <span class="recent-match-time">${time}</span>
            </div>
        `;
    }).join('');
    document.getElementById('recent-matches-list').innerHTML = recentHtml || '<p style="color:var(--text-muted)">暂无对战记录</p>';

    // TOP10玩家
    const medals = ['🏆', '🥈', '🥉'];
    const topHtml = players.map((p, i) => `
        <div class="top-player-item">
            <span class="top-player-rank ${i < 3 ? 'rank-' + (i+1) : ''}">${i < 3 ? medals[i] : i + 1}</span>
            <span class="top-player-name">${p.name}</span>
            <span class="race-tag race-${p.race || 'unknown'}">${p.race && RACES[p.race] ? RACES[p.race].name : '未知'}</span>
            <span class="top-player-points">${p.points}</span>
        </div>
    `).join('');
    document.getElementById('top-players-list').innerHTML = topHtml || '<p style="color:var(--text-muted)">暂无成员</p>';

    // 渲染精彩回放列表
    renderReplayList();
}

// ========================================
// 精彩比赛回放 - 从 JSON 文件加载并展示
// ========================================

let cachedReplays = null;

async function loadReplaysFromJSON() {
    try {
        const resp = await fetch('data/replays.json?t=' + Date.now());
        if (resp.ok) {
            const data = await resp.json();
            cachedReplays = Array.isArray(data) ? data : [];
        } else {
            cachedReplays = [];
        }
    } catch(e) {
        cachedReplays = [];
    }
}

async function renderReplayList() {
    const container = document.getElementById('replay-list');
    if (!container) return;

    // 如果缓存为空，尝试加载
    if (!cachedReplays) {
        await loadReplaysFromJSON();
    }
    const links = cachedReplays || [];

    if (links.length === 0) {
        container.innerHTML = '<p class="replay-empty">暂无回放</p>';
        return;
    }

    container.innerHTML = links.map((link) => `
        <a class="replay-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
            <div class="replay-item-icon">▶</div>
            <div class="replay-item-info">
                <div class="replay-item-title">${escapeHtml(link.title)}</div>
                ${link.desc ? `<div class="replay-item-desc">${escapeHtml(link.desc)}</div>` : ''}
            </div>
        </a>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 等级段位值配置（用于积分计算）
const LEVEL_VALUE = { 'SR': 8, 'S': 7, 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1, 'G': 0 };

// 计算两个玩家之间的积分变化
// 返回 { winnerPoints, loserPoints } - 正数表示获得，负数表示扣除
function calculatePointsChange(winnerId, loserId, scoreDiff, players) {
    const winner = players.find(p => p.id === winnerId);
    const loser = players.find(p => p.id === loserId);
    
    if (!winner || !loser) return { winnerPoints: 0, loserPoints: 0 };
    
    const winnerLevel = getLevelByPoints(winner.points);
    const loserLevel = getLevelByPoints(loser.points);
    
    const winnerLevelValue = LEVEL_VALUE[winnerLevel] || 0;
    const loserLevelValue = LEVEL_VALUE[loserLevel] || 0;
    
    // 基础分 = 比分差 × 10
    const basePoints = scoreDiff * 10;
    
    // 根据段位关系计算倍数
    let multiplier = 1; // 默认同段位
    
    if (winnerLevelValue < loserLevelValue) {
        // 击败比自己高段位的选手（以低打高）- 双倍
        multiplier = 2;
    } else if (winnerLevelValue > loserLevelValue) {
        // 击败比自己低段位的选手（以高打低）- 半倍
        multiplier = 0.5;
    }
    
    const pointsChange = Math.round(basePoints * multiplier);
    
    return { winnerPoints: pointsChange, loserPoints: -pointsChange };
}

// 渲染成员页面 - 按等级分组布局
function renderMembers(filterRace = 'all', filterLevel = 'all', searchText = '') {
    let players = getPlayers();
    
    // 种族筛选
    if (filterRace !== 'all') {
        players = players.filter(p => p.race === filterRace);
    }
    
    // 段位筛选
    if (filterLevel !== 'all') {
        players = players.filter(p => getPlayerLevel(p.id) === filterLevel);
    }
    
    // 名称搜索筛选
    if (searchText) {
        const searchLower = searchText.toLowerCase();
        players = players.filter(p =>
            p.name.toLowerCase().includes(searchLower) ||
            (p.kkname && p.kkname.toLowerCase().includes(searchLower))
        );
    }
    
    players.sort((a, b) => b.points - a.points);

    // 按等级分组
    const grouped = {};
    LEVEL_ORDER.forEach(level => grouped[level] = []);
    
    players.forEach(p => {
        const level = getPlayerLevel(p.id);
        grouped[level].push(p);
    });

    let globalRank = 1;
    let html = '';
    
    LEVEL_ORDER.forEach(level => {
        // 如果有段位筛选，只显示该段位
        if (filterLevel !== 'all' && level !== filterLevel) return;
        
        const levelPlayers = grouped[level];
        if (levelPlayers.length === 0) return;
        
        html += `
            <div class="level-group">
                <div class="level-group-header">
                    <span class="level-cell level-${level}">${level}</span>
                    <span class="level-group-count">${levelPlayers.length} 人</span>
                    <span class="level-group-label label-level">等级</span>
                    <span class="level-group-label label-id">ID</span>
                    <span class="level-group-label label-race">种族</span>
                    <span class="level-group-label label-points">天梯分</span>
                </div>
                <table class="members-table">
                    <tbody>
                        ${levelPlayers.map(p => {
                            const rank = globalRank++;
                            return `
                                <tr onclick="showPlayerDetail('${p.id}')">
                                    <td class="rank-cell">${rank}</td>
                                    <td><span class="level-cell level-${level}">${level}</span></td>
                                    <td>
                                        <div class="name-cell">
                                            <div class="member-avatar-small">${p.race && RACES[p.race] ? `<img src="${RACES[p.race].icon}" style="width:${RACES[p.race].size?.small||36}px;height:${RACES[p.race].size?.small||36}px;object-fit:contain;border-radius:4px;">` : ''}</div>
                                            <span>${p.name}</span>
                                        </div>
                                    </td>
                                    <td><span class="race-tag race-${p.race || 'unknown'}">${p.race && RACES[p.race] ? RACES[p.race].name : '未知'}</span></td>
                                    <td class="kkname-cell">${p.kkname || '-'}</td>
                                    <td class="points-cell">${p.points}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });

    const container = document.querySelector('.members-list-wrapper');
    if (html) {
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;background:var(--bg-card);border-radius:8px">暂无成员</p>';
    }
}

// ========================================
// 成员详情页面
// ========================================

let currentPlayerId = null;
let previousPage = 'members';

function showPlayerDetail(playerId) {
    currentPlayerId = playerId;
    previousPage = getCurrentPage();
    
    // 隐藏其他页面，显示详情页
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-player-detail').classList.add('active');
    
    renderPlayerDetail(playerId);
}

function goBack() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    if (previousPage === 'player-detail') {
        navigateTo('members');
    } else {
        document.getElementById(`page-${previousPage}`)?.classList.add('active');
        document.querySelector(`.nav-item[data-page="${previousPage}"]`)?.classList.add('active');
    }
}

function renderPlayerDetail(playerId) {
    const players = getPlayers();
    const player = players.find(p => p.id === playerId);
    
    if (!player) return;
    
    // 基本信息
    document.getElementById('detail-player-name').textContent = player.name;
    document.getElementById('detail-avatar').innerHTML = player.race && RACES[player.race]
        ? `<img src="${RACES[player.race].icon}" alt="${RACES[player.race].name}" style="width:${RACES[player.race].size?.large||80}px;height:${RACES[player.race].size?.large||80}px;object-fit:contain;border-radius:8px;">`
        : '';
    document.getElementById('detail-name').textContent = player.name;
    document.getElementById('detail-race-tag').className = `race-tag race-${player.race}`;
    document.getElementById('detail-race-tag').textContent = RACES[player.race].name;
    document.getElementById('detail-kkname').textContent = player.kkname ? `KK: ${player.kkname}` : '';
    
    // 计算等级 (新等级系统)
    const level = getPlayerLevel(player.id);
    document.getElementById('detail-level').textContent = level;
    document.getElementById('detail-level').className = `level-cell level-${level}`;
    
    // 基础分和加分
    const basePoints = 1000;
    const pointsChange = player.points - basePoints;
    document.getElementById('detail-base-points').textContent = basePoints;
    document.getElementById('detail-points-change').textContent = pointsChange >= 0 ? `+${pointsChange}` : pointsChange;
    document.getElementById('detail-points-change').style.color = pointsChange >= 0 ? '#27ae60' : '#e74c3c';
    
    // APM (随机模拟一个值，后期可扩展)
    const apm = player.apm || Math.floor(Math.random() * 150 + 80);
    document.getElementById('detail-apm').textContent = apm;
    
    // 总战绩
    document.getElementById('detail-total-wins').textContent = player.wins;
    document.getElementById('detail-total-losses').textContent = player.losses;
    const total = player.wins + player.losses;
    const winrate = total > 0 ? ((player.wins / total) * 100).toFixed(1) : '0.0';
    document.getElementById('detail-winrate').textContent = `${winrate}%`;
    document.getElementById('detail-total-points').textContent = player.points;
    
    // 个人辉煌战绩
    const glory = player.glory || '';
    const gloryContent = document.getElementById('detail-glory');
    if (glory) {
        gloryContent.innerHTML = `<span class="glory-text">${glory.replace(/\n/g, '<br>')}</span>`;
    } else {
        gloryContent.innerHTML = '<span class="glory-text">暂无辉煌战绩</span>';
    }
    
    // 比赛荣誉
    const honors = player.honors || '';
    const honorsContent = document.getElementById('detail-honors');
    if (honors) {
        honorsContent.innerHTML = `<span class="honors-text">${honors.replace(/\n/g, '<br>')}</span>`;
    } else {
        honorsContent.innerHTML = '<span class="honors-text">暂无比赛荣誉</span>';
    }
    
    // KK平台历史最高段位
    const kkRank = player.kkRank || '';
    const kkRankContent = document.getElementById('detail-kk-rank');
    if (kkRank) {
        kkRankContent.innerHTML = `<span class="kk-rank-text">${kkRank}</span>`;
    } else {
        kkRankContent.innerHTML = '<span class="kk-rank-text">暂无记录</span>';
    }
    
    // 性格特点
    const trait = player.trait || '';
    const traitContent = document.getElementById('detail-trait');
    if (trait) {
        traitContent.innerHTML = `<span class="trait-text">${trait.replace(/\n/g, '<br>')}</span>`;
    } else {
        traitContent.innerHTML = '<span class="trait-text">暂无性格特点</span>';
    }
    
    // 显示/隐藏编辑按钮
    const admin = isAdmin();
    document.getElementById('btn-edit-glory').style.display = admin ? 'block' : 'none';
    document.getElementById('btn-edit-honors').style.display = admin ? 'block' : 'none';
    document.getElementById('btn-edit-kk-rank').style.display = admin ? 'block' : 'none';
    document.getElementById('btn-edit-trait').style.display = admin ? 'block' : 'none';
    document.getElementById('honors-edit-btn').style.display = admin ? 'block' : 'none';
    
    // 计算群内互殴数据
    renderPlayerBattles(playerId);
}

function renderPlayerBattles(playerId) {
    const players = getPlayers();
    const matches = getMatches();
    const currentPlayer = players.find(p => p.id === playerId);
    
    if (!currentPlayer) return;
    
    // 计算与每个对手的胜负
    const battleStats = {};
    
    matches.forEach(match => {
        // 兼容两种数据格式: player1/player2 或 redPlayers/bluePlayers
        let isRed = false, isBlue = false;
        let opponents = [];
        let won = false;
        
        if (match.player1 && match.player2) {
            // 旧格式: player1/player2
            const p1 = match.player1;
            const p2 = match.player2;
            isRed = p1 === playerId;
            isBlue = p2 === playerId;
            
            if (!isRed && !isBlue) return;
            
            opponents = isRed ? [p2] : [p1];
            
            // 从 result 字段判断胜负
            const playerName = currentPlayer.name;
            won = match.result && match.result.includes(playerName) && match.result.includes('胜');
        } else if (match.redPlayers && match.bluePlayers) {
            // 新格式: redPlayers/bluePlayers 数组
            isRed = match.redPlayers.includes(playerId);
            isBlue = match.bluePlayers.includes(playerId);
            
            if (!isRed && !isBlue) return;
            
            opponents = isRed ? match.bluePlayers : match.redPlayers;
            won = (isRed && match.redScore > match.blueScore) || (isBlue && match.blueScore > match.redScore);
        } else {
            return; // 格式不对，跳过
        }
        
        opponents.forEach(opponentId => {
            if (!battleStats[opponentId]) {
                battleStats[opponentId] = { wins: 0, losses: 0 };
            }
            if (won) {
                battleStats[opponentId].wins++;
            } else {
                battleStats[opponentId].losses++;
            }
        });
    });
    
    // 生成对战列表
    const battlesList = document.getElementById('detail-battles-list');
    const battlesCount = Object.values(battleStats).reduce((sum, s) => sum + s.wins + s.losses, 0);
    document.getElementById('detail-battles-count').textContent = battlesCount;
    
    const battlesHtml = Object.entries(battleStats)
        .map(([opponentId, stats]) => {
            const opponent = players.find(p => p.id === opponentId);
            if (!opponent) return '';
            
            const total = stats.wins + stats.losses;
            const winRate = total > 0 ? (stats.wins / total) * 100 : 50;
            const isWin = stats.wins > stats.losses || (stats.wins === stats.losses && Math.random() > 0.5);
            
            return `
                <div class="battle-item">
                    <div class="battle-opponent">
                        <span class="race-tag race-${opponent.race || 'unknown'}">${opponent.race && RACES[opponent.race] ? `<img src="${RACES[opponent.race].icon}" style="width:${RACES[opponent.race].size?.medium||32}px;height:${RACES[opponent.race].size?.medium||32}px;vertical-align:middle;border-radius:4px;">` : '🏰'}</span>
                        <span class="battle-opponent-name">${opponent.name}</span>
                    </div>
                    <div class="battle-progress">
                        <div class="battle-progress-bar ${isWin ? 'win' : 'loss'}" style="width: ${winRate}%">
                            ${winRate.toFixed(0)}%
                        </div>
                    </div>
                    <div class="battle-stats">
                        <span class="wins">${stats.wins}胜</span> / <span class="losses">${stats.losses}败</span>
                    </div>
                </div>
            `;
        })
        .join('');
    
    battlesList.innerHTML = battlesHtml || '<p style="color:var(--text-muted);text-align:center;padding:20px">暂无对战记录</p>';
}

// 性格特点编辑
function editTrait() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    document.getElementById('detail-trait').style.display = 'none';
    document.getElementById('trait-edit-form').style.display = 'flex';
    document.getElementById('trait-input').value = player.trait || '';
    document.getElementById('trait-input').focus();
}

function cancelEditTrait() {
    document.getElementById('detail-trait').style.display = 'block';
    document.getElementById('trait-edit-form').style.display = 'none';
}

function saveTrait() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    player.trait = document.getElementById('trait-input').value;
    savePlayers(players);
    
    document.getElementById('detail-trait').innerHTML = player.trait 
        ? `<span class="trait-text">${player.trait.replace(/\n/g, '<br>')}</span>` 
        : '<span class="trait-text">暂无性格特点</span>';
    
    cancelEditTrait();
}

// 个人辉煌战绩编辑
function editGlory() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    document.getElementById('detail-glory').style.display = 'none';
    document.getElementById('glory-edit-form').style.display = 'flex';
    document.getElementById('glory-input').value = player.glory || '';
    document.getElementById('glory-input').focus();
}

function cancelEditGlory() {
    document.getElementById('detail-glory').style.display = 'block';
    document.getElementById('glory-edit-form').style.display = 'none';
}

function saveGlory() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    player.glory = document.getElementById('glory-input').value;
    savePlayers(players);
    
    document.getElementById('detail-glory').innerHTML = player.glory 
        ? `<span class="glory-text">${player.glory.replace(/\n/g, '<br>')}</span>` 
        : '<span class="glory-text">暂无辉煌战绩</span>';
    
    cancelEditGlory();
}

// 比赛荣誉编辑
function editHonors() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    document.getElementById('detail-honors').style.display = 'none';
    document.getElementById('honors-edit-form').style.display = 'flex';
    document.getElementById('honors-input').value = player.honors || '';
    document.getElementById('honors-input').focus();
}

function cancelEditHonors() {
    document.getElementById('detail-honors').style.display = 'block';
    document.getElementById('honors-edit-form').style.display = 'none';
}

function saveHonors() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    player.honors = document.getElementById('honors-input').value;
    savePlayers(players);
    
    document.getElementById('detail-honors').innerHTML = player.honors 
        ? `<span class="honors-text">${player.honors.replace(/\n/g, '<br>')}</span>` 
        : '<span class="honors-text">暂无比赛荣誉</span>';
    
    cancelEditHonors();
}

// KK平台历史最高段位编辑
function editKkRank() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    document.getElementById('detail-kk-rank').style.display = 'none';
    document.getElementById('kk-rank-edit-form').style.display = 'flex';
    document.getElementById('kk-rank-input').value = player.kkRank || '';
    document.getElementById('kk-rank-input').focus();
}

function cancelEditKkRank() {
    document.getElementById('detail-kk-rank').style.display = 'block';
    document.getElementById('kk-rank-edit-form').style.display = 'none';
}

function saveKkRank() {
    const players = getPlayers();
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;
    
    player.kkRank = document.getElementById('kk-rank-input').value;
    savePlayers(players);
    
    document.getElementById('detail-kk-rank').innerHTML = player.kkRank 
        ? `<span class="kk-rank-text">${player.kkRank}</span>` 
        : '<span class="kk-rank-text">暂无记录</span>';
    
    cancelEditKkRank();
}

// 渲染对战记录
function renderMatches(filterType = 'all', playerSearch = '') {
    let matches = getMatches().sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        // 日期相同时按 ID 倒序（假设新记录 ID 数字部分更大，如 m11 > m10 > m9）
        const numA = parseInt(String(a.id).replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.id).replace(/\D/g, '')) || 0;
        return numB - numA;
    });
    
    if (filterType !== 'all') {
        matches = matches.filter(m => m.type === filterType);
    }

    // 按成员搜索过滤 - 添加安全检查
    if (playerSearch) {
        const searchLower = playerSearch.toLowerCase();
        matches = matches.filter(m => {
            const players = getPlayers();
            const redIds = Array.isArray(m.redPlayers) ? m.redPlayers : (m.player1 ? [m.player1] : []);
            const blueIds = Array.isArray(m.bluePlayers) ? m.bluePlayers : (m.player2 ? [m.player2] : []);
            const allPlayerIds = [...redIds, ...blueIds];
            return allPlayerIds.some(id => {
                const p = players.find(pl => pl.id === id);
                return p && (p.name.toLowerCase().includes(searchLower) || 
                              (p.kkname && p.kkname.toLowerCase().includes(searchLower)));
            });
        });
    }

    const players = getPlayers();
    const admin = isAdmin();

    const html = matches.map(m => {
        // 计算全局排名
        const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
        const getRank = (playerId) => {
            const idx = sortedPlayers.findIndex(p => p.id === playerId);
            return idx >= 0 ? idx + 1 : '-';
        };
        
        // 安全检查：获取选手ID数组
        const redIds = Array.isArray(m.redPlayers) ? m.redPlayers : (m.player1 ? [m.player1] : []);
        const blueIds = Array.isArray(m.bluePlayers) ? m.bluePlayers : (m.player2 ? [m.player2] : []);
        
        // 安全检查：获取分数
        const redScore = typeof m.redScore === 'number' ? m.redScore : (m.score ? parseInt(m.score.split('-')[0]) : 0);
        const blueScore = typeof m.blueScore === 'number' ? m.blueScore : (m.score ? parseInt(m.score.split('-')[1]) : 0);
        
        // 计算队伍总积分和平均段位
        const calcTeamStats = (playerIds) => {
            if (!Array.isArray(playerIds)) return { totalPoints: 0, avgPoints: 0, avgLevel: '-' };
            let totalPoints = 0;
            let avgLevel = 0;
            let count = 0;
            playerIds.forEach(id => {
                const p = players.find(pl => pl.id === id);
                if (p) {
                    totalPoints += p.points;
                    avgLevel += getLevelValue(getPlayerLevel(p.id));
                    count++;
                }
            });
            return { 
                totalPoints, 
                avgPoints: count > 0 ? Math.round(totalPoints / count) : 0,
                avgLevel: count > 0 ? (avgLevel / count).toFixed(1) : '-'
            };
        };
        
        const redStats = calcTeamStats(redIds);
        const blueStats = calcTeamStats(blueIds);
        const redWinner = redScore > blueScore;
        const blueWinner = blueScore > redScore;
        
        const redNames = redIds.map(id => {
            const p = players.find(pl => pl.id === id);
            if (!p) return '';
            const rank = getRank(p.id);
            const level = getPlayerLevel(p.id);
            const raceImg = p.race && RACES[p.race] ? `<img src="${RACES[p.race].icon}" style="width:${RACES[p.race].size?.medium||32}px;height:${RACES[p.race].size?.medium||32}px;vertical-align:middle;border-radius:3px;">` : '';
            return `<div class="match-player-badge ${redWinner ? 'winner' : ''}">
                <span class="player-race-icon ${p.race ? 'race-' + p.race.toLowerCase() : ''}">${raceImg}</span>
                <span class="player-level-mini level-${level}">${level}</span>
                <span class="player-rank-mini">#${rank}</span>
                <span class="player-points-mini">${p.points}</span>
                <span class="player-name-large">${p.name}</span>
            </div>`;
        }).join('');
        
        const blueNames = blueIds.map(id => {
            const p = players.find(pl => pl.id === id);
            if (!p) return '';
            const rank = getRank(p.id);
            const level = getPlayerLevel(p.id);
            const raceImg = p.race && RACES[p.race] ? `<img src="${RACES[p.race].icon}" style="width:${RACES[p.race].size?.medium||32}px;height:${RACES[p.race].size?.medium||32}px;vertical-align:middle;border-radius:3px;">` : '';
            return `<div class="match-player-badge ${blueWinner ? 'winner' : ''}">
                <span class="player-race-icon ${p.race ? 'race-' + p.race.toLowerCase() : ''}">${raceImg}</span>
                <span class="player-level-mini level-${level}">${level}</span>
                <span class="player-rank-mini">#${rank}</span>
                <span class="player-points-mini">${p.points}</span>
                <span class="player-name-large">${p.name}</span>
            </div>`;
        }).join('');

        const date = new Date(m.date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        return `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-type">${m.type === 'ladder' ? '🏆 天梯' : '⚙️ 自定义'}</span>
                </div>
                <div class="match-body match-body-compact">
                    <div class="match-team">
                        <div class="match-team-stats">
                            <span class="team-points">均分 ${redStats.avgPoints}</span>
                        </div>
                        <div class="match-players">${redNames}</div>
                    </div>
                    <div class="match-score">
                        <span class="score-side ${redWinner ? 'winner-text' : ''}">${redScore}</span>
                        <span class="score-divider">—</span>
                        <span class="score-side ${blueWinner ? 'winner-text' : ''}">${blueScore}</span>
                    </div>
                    <div class="match-team">
                        <div class="match-team-stats">
                            <span class="team-points">均分 ${blueStats.avgPoints}</span>
                        </div>
                        <div class="match-players">${blueNames}</div>
                    </div>
                </div>
                ${admin ? `
                    <div class="match-actions">
                        <button class="btn-delete" onclick="deleteMatch('${m.id}')">删除</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    document.getElementById('matches-list').innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:40px">暂无对战记录</p>';
}

// ========================================
// 赛事页面
// ========================================

// 赛事状态筛选
let currentEventStatus = 'all';

// 默认赛事展示数据
const DEFAULT_SHOW_EVENTS = [];

// 获取赛事展示数据 - 合并 localStorage 和 event_infos.json 的数据
function getShowEvents() {
    // 优先使用从 event_infos.json 加载的数据
    if (cachedShowEvents && cachedShowEvents.length > 0) {
        // 也合并 localStorage 的数据（去重）
        const storageData = localStorage.getItem('wc3_show_events');
        const storageEvents = storageData ? JSON.parse(storageData) : [];
        
        // 合并两个数据源，event_infos 的数据优先
        const storageIds = new Set(storageEvents.map(e => e.id));
        const mergedEvents = [...cachedShowEvents];
        
        storageEvents.forEach(e => {
            if (!storageIds.has(e.id)) {
                mergedEvents.push(e);
            }
        });
        
        return mergedEvents;
    }
    
    // 降级到 localStorage
    const data = localStorage.getItem('wc3_show_events');
    return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DEFAULT_SHOW_EVENTS));
}

// 保存赛事展示数据
function saveShowEvents(events) {
    localStorage.setItem('wc3_show_events', JSON.stringify(events));
}

// 渲染赛事页面
function renderEvents() {
    const events = getShowEvents();
    const content = document.getElementById('events-content');
    const admin = isAdmin();
    
    // 根据状态筛选
    let filteredEvents = events;
    if (currentEventStatus !== 'all') {
        filteredEvents = events.filter(e => e.status === currentEventStatus);
    }
    
    if (filteredEvents.length === 0) {
        content.innerHTML = '<div class="no-data">暂无赛事信息</div>';
        return;
    }
    
    let html = '<div class="events-grid">';
    filteredEvents.forEach(event => {
        const statusLabel = event.status === 'ongoing' ? '进行中' : '已结束';
        const statusClass = event.status === 'ongoing' ? 'ongoing' : 'finished';
        
        html += `
            <div class="event-card clickable" data-id="${event.id}" onclick="showEventDetail('${event.id}')">
                <span class="event-card-status ${statusClass}">${statusLabel}</span>
                <div class="event-card-header">
                    <span class="event-emoji-large">${event.emoji}</span>
                    <div class="event-card-info">
                        <h3 class="event-name">${event.name}</h3>
                    </div>
                </div>
                ${admin ? `
                    <div class="event-card-actions">
                        <button class="btn-edit-small" onclick="event.stopPropagation(); editEvent('${event.id}')">编辑</button>
                        <button class="btn-delete-small" onclick="event.stopPropagation(); deleteEvent('${event.id}')">删除</button>
                    </div>
                ` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    content.innerHTML = html;
}

// 打开赛事编辑弹窗
function openEventsEditor() {
    document.getElementById('events-editor-modal').classList.add('active');
    loadEventList();
    initEventEmojiPicker();
}

// 关闭赛事编辑弹窗
function closeEventsEditor() {
    document.getElementById('events-editor-modal').classList.remove('active');
    // 清空表单
    document.getElementById('event-edit-name').value = '';
    document.getElementById('event-edit-subtitle').value = '';
    document.getElementById('event-edit-status').value = 'ongoing';
    document.getElementById('event-edit-date').value = '';
    document.getElementById('event-edit-format').value = '淘汰赛';
    document.getElementById('event-edit-players').value = '8';
    document.getElementById('event-edit-maps').value = '';
    document.getElementById('event-edit-prize').value = '';
    document.getElementById('event-edit-champions').value = '';
    document.getElementById('event-edit-progress').value = '';
    document.getElementById('event-edit-description').value = '';
    document.getElementById('event-edit-emoji').value = '🏆';
    document.getElementById('event-edit-name').dataset.editId = '';
}

// 初始化赛事图标选择器
function initEventEmojiPicker() {
    const picker = document.getElementById('event-emoji-picker');
    if (!picker) return;
    
    picker.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.onclick = function() {
            picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('event-edit-emoji').value = this.dataset.emoji;
        };
    });
    
    // 默认选中第一个
    if (picker.querySelector('.emoji-btn')) {
        picker.querySelector('.emoji-btn').classList.add('selected');
    }
}

// 保存赛事
function saveEvent() {
    const name = document.getElementById('event-edit-name').value.trim();
    const emoji = document.getElementById('event-edit-emoji').value || '🏆';
    const subtitle = document.getElementById('event-edit-subtitle').value.trim();
    const status = document.getElementById('event-edit-status').value;
    const date = document.getElementById('event-edit-date').value;
    const format = document.getElementById('event-edit-format').value;
    const players = parseInt(document.getElementById('event-edit-players').value) || 8;
    const playersListStr = document.getElementById('event-edit-players-list').value.trim();
    const playersList = playersListStr ? playersListStr.split(/[,，]/).map(p => parseInt(p.trim())).filter(p => !isNaN(p)) : [];
    
    const mapsStr = document.getElementById('event-edit-maps').value.trim();
    const maps = mapsStr ? mapsStr.split(/[,，]/).map(m => m.trim()).filter(m => m) : [];
    const prize = document.getElementById('event-edit-prize').value.trim();
    const champions = document.getElementById('event-edit-champions').value.trim();
    const progress = document.getElementById('event-edit-progress').value.trim();
    const description = document.getElementById('event-edit-description').value.trim();
    const editId = document.getElementById('event-edit-name').dataset.editId;
    
    if (!name) {
        alert('请输入赛事名称');
        return;
    }
    
    const events = getShowEvents();
    
    if (editId) {
        // 编辑模式
        const index = events.findIndex(e => e.id === editId);
        if (index >= 0) {
            events[index] = { 
                id: editId, 
                emoji, 
                name, 
                subtitle, 
                status,
                date,
                format,
                players,
                playersList,
                maps,
                prize,
                champions,
                progress,
                description
            };
        }
    } else {
        // 新增模式
        const id = 'event-' + Date.now();
        events.push({ 
            id, 
            emoji, 
            name, 
            subtitle, 
            status,
            date,
            format,
            players,
            playersList,
            maps,
            prize,
            champions,
            progress,
            description
        });
    }
    
    saveShowEvents(events);
    renderEvents();
    loadEventList();
    closeEventsEditor();
}

// 编辑赛事
function editEvent(id) {
    const events = getShowEvents();
    const event = events.find(e => e.id === id);
    if (!event) return;
    
    document.getElementById('event-edit-name').value = event.name;
    document.getElementById('event-edit-name').dataset.editId = id;
    document.getElementById('event-edit-emoji').value = event.emoji;
    document.getElementById('event-edit-subtitle').value = event.subtitle || '';
    document.getElementById('event-edit-status').value = event.status || 'ongoing';
    document.getElementById('event-edit-date').value = event.date || '';
    document.getElementById('event-edit-format').value = event.format || '淘汰赛';
    document.getElementById('event-edit-players').value = event.players || 8;
    document.getElementById('event-edit-players-list').value = (event.playersList || []).join(',');
    document.getElementById('event-edit-maps').value = (event.maps || []).join(',');
    document.getElementById('event-edit-prize').value = event.prize || '';
    document.getElementById('event-edit-champions').value = event.champions || '';
    document.getElementById('event-edit-progress').value = event.progress || '';
    document.getElementById('event-edit-description').value = event.description || '';
    
    // 更新图标选择器选中状态
    const picker = document.getElementById('event-emoji-picker');
    if (picker) {
        picker.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.emoji === event.emoji);
        });
    }
    
    openEventsEditor();
}

// 删除赛事
function deleteEvent(id) {
    if (!confirm('确定要删除这个赛事吗？')) return;
    
    const events = getShowEvents();
    const filtered = events.filter(e => e.id !== id);
    saveShowEvents(filtered);
    renderEvents();
    loadEventList();
}

// 加载赛事列表到编辑弹窗
function loadEventList() {
    const events = getShowEvents();
    const listEl = document.getElementById('event-list');
    
    if (events.length === 0) {
        listEl.innerHTML = '<div class="no-data">暂无赛事，点击上方表单添加</div>';
        return;
    }
    
    let html = '';
    events.forEach(event => {
        html += `
            <div class="event-list-item">
                <span class="event-list-emoji">${event.emoji}</span>
                <span class="event-list-name">${event.name}</span>
                <button class="btn-edit-small" onclick="editEvent('${event.id}')">编辑</button>
                <button class="btn-delete-small" onclick="deleteEvent('${event.id}')">删除</button>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

// ========================================
// 赛事详情页面
// ========================================

// 获取选手名称（通过ID）
function getPlayerNameById(playerId) {
    if (!playerId) return 'TBD';
    const players = getPlayers();
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'ID:' + playerId;
}

// 获取选手等级标签
function getPlayerLevelTag(playerId) {
    if (!playerId) return '';
    const players = getPlayers();
    const player = players.find(p => p.id === playerId);
    if (!player) return '';
    const level = getPlayerLevel(player.id);
    return `<span class="level-cell level-${level}">${level}</span>`;
}

// 渲染双败淘汰赛程图
function renderBracketChart(event) {
    const playersList = event.playersList || [];
    const totalPlayers = playersList.length;
    
    // 检查是否为有效的参赛人数
    if (totalPlayers < 2) {
        return '<div class="no-data">选手数量不足，请至少输入2名选手</div>';
    }
    
    // 确定赛制（双败或单败）
    const format = event.format || '淘汰赛';
    const isDoubleElimination = format === '双败淘汰';
    
    // 计算轮次
    const rounds = Math.ceil(Math.log2(totalPlayers));
    const bracketData = generateBracketStructure(totalPlayers, isDoubleElimination);
    
    let html = '<div class="event-bracket-container">';
    html += '<div class="event-bracket">';
    
    // 胜者组
    html += '<div class="bracket-section winner-bracket">';
    html += '<div class="bracket-section-title">🏆 胜者组</div>';
    html += renderWinnerBracket(bracketData, playersList);
    html += '</div>';
    
    // 败者组（如果是双败赛制）
    if (isDoubleElimination && totalPlayers >= 4) {
        html += '<div class="bracket-section loser-bracket">';
        html += '<div class="bracket-section-title">💀 败者组</div>';
        html += renderLoserBracket(bracketData, playersList);
        html += '</div>';
    }
    
    // 决赛
    html += '<div class="bracket-section grand-final">';
    html += '<div class="bracket-section-title">👑 决赛</div>';
    html += renderGrandFinal(bracketData, playersList);
    html += '</div>';
    
    html += '</div>'; // end bracket
    
    // 冠军展示
    if (event.prize) {
        html += `
            <div class="champion-display">
                <div class="champion-label">冠军</div>
                <div class="champion-name">
                    <span class="trophy">🏆</span>
                    ${event.prize}
                </div>
            </div>
        `;
    }
    
    html += '</div>'; // end bracket-container
    
    return html;
}

// 生成赛程结构
function generateBracketStructure(totalPlayers, isDoubleElimination) {
    const rounds = Math.ceil(Math.log2(totalPlayers));
    return {
        totalPlayers,
        rounds,
        isDoubleElimination,
        // 胜者组每轮比赛数量
        winnerMatches: Array.from({length: rounds}, (_, i) => Math.pow(2, rounds - i - 1)),
        // 败者组轮次
        loserRounds: isDoubleElimination ? (rounds - 1) * 2 : 0
    };
}

// 渲染胜者组
function renderWinnerBracket(bracketData, playersList) {
    const { rounds, winnerMatches } = bracketData;
    let html = '';
    
    // 第一轮对阵
    const round1Matches = winnerMatches[0];
    const players = [...playersList];
    
    // 填充到2的幂
    const size = Math.pow(2, rounds);
    while (players.length < size) {
        players.push(null); // Bye
    }
    
    // 渲染每轮
    for (let round = 0; round < rounds; round++) {
        const matchCount = winnerMatches[round];
        const roundName = getRoundName(round, rounds, '胜者');
        
        html += '<div class="bracket-round">';
        html += '<div class="round-header">' + roundName + '</div>';
        
        for (let m = 0; m < matchCount; m++) {
            const player1Index = round === 0 ? m * 2 : null;
            const player2Index = round === 0 ? m * 2 + 1 : null;
            
            let player1 = null, player2 = null;
            if (round === 0) {
                player1 = players[player1Index];
                player2 = players[player2Index];
            }
            
            const matchClass = round === rounds - 1 ? 'winner' : '';
            html += renderMatchCard(player1, player2, matchClass, round);
        }
        
        html += '</div>';
    }
    
    return html;
}

// 渲染败者组
function renderLoserBracket(bracketData, playersList) {
    if (!bracketData.isDoubleElimination) return '';
    
    const { rounds } = bracketData;
    let html = '';
    
    // 败者组轮次（交替进行）
    for (let i = 0; i < (rounds - 1) * 2; i++) {
        const roundName = i % 2 === 0 ? `败者组第${Math.floor(i/2) + 1}轮` : '败者组淘汰';
        const matchCount = Math.pow(2, rounds - 2 - Math.floor(i / 2));
        
        html += '<div class="bracket-round">';
        html += `<div class="round-header">${roundName}</div>`;
        
        for (let m = 0; m < Math.max(1, matchCount); m++) {
            html += renderMatchCard(null, null, '', 'loser-' + i);
        }
        
        html += '</div>';
    }
    
    return html;
}

// 渲染决赛
function renderGrandFinal(bracketData, playersList) {
    const html = '<div class="bracket-round">';
    html += '<div class="round-header">总决赛</div>';
    html += renderMatchCard(null, null, 'current', 'final');
    html += '</div>';
    return html;
}

// 渲染单场比赛卡片
function renderMatchCard(player1, player2, matchClass = '', roundId) {
    const p1Name = player1 ? getPlayerNameById(player1) : 'TBD';
    const p1Level = player1 ? getPlayerLevelTag(player1) : '';
    const p1Class = !player1 ? 'tbd' : '';
    
    const p2Name = player2 ? getPlayerNameById(player2) : 'TBD';
    const p2Level = player2 ? getPlayerLevelTag(player2) : '';
    const p2Class = !player2 ? 'tbd' : '';
    
    const roundAttr = 'data-round="' + roundId + '"';
    
    return '<div class="bracket-match ' + matchClass + '" ' + roundAttr + '>' +
        '<div class="bracket-player ' + p1Class + '">' +
            '<span class="player-seed">1</span>' +
            '<span class="player-name">' + p1Level + p1Name + '</span>' +
        '</div>' +
        '<div class="bracket-player ' + p2Class + '">' +
            '<span class="player-seed">2</span>' +
            '<span class="player-name">' + p2Level + p2Name + '</span>' +
        '</div>' +
    '</div>';
}

// 获取轮次名称
function getRoundName(round, totalRounds, prefix = '') {
    const remaining = totalRounds - round;
    if (remaining === 1) return `${prefix}决赛`;
    if (remaining === 2) return `${prefix}半决赛`;
    if (remaining === 3) return `${prefix}八强`;
    if (remaining === 4) return `${prefix}16强`;
    if (remaining === 5) return `${prefix}32强`;
    if (remaining === 6) return `${prefix}64强`;
    return `${prefix}第${round + 1}轮`;
}

// 解析赛程进度数据
// 支持格式1: "决赛:Infi 2:1 TH000\n半决赛:Sky 2:0 Moon\n八强:A组 16人"
function parseProgressData(progressStr) {
    if (!progressStr) return [];
    
    // 尝试识别轮次关键词
    const roundPatterns = [
        { regex: /决赛|总决赛|Final/i, name: '决赛' },
        { regex: /半决赛|四强|Semi/i, name: '半决赛' },
        { regex: /八强|四分之一决赛|Quarter/i, name: '八强' },
        { regex: /十六强|1\/16/i, name: '16强' },
        { regex: /三十二强|1\/32/i, name: '32强' },
        { regex: /小组赛|Group/i, name: '小组赛' },
        { regex: /八分之一决赛|1\/8/i, name: '8强' }
    ];
    
    const rounds = [];
    const lines = progressStr.split('\n');
    
    let currentRound = null;
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        // 检查是否是轮次标题行
        let foundRound = false;
        for (const pattern of roundPatterns) {
            if (pattern.regex.test(line)) {
                // 如果有比分信息，解析比赛
                const matchInfo = parseMatchLine(line, pattern.name);
                if (matchInfo) {
                    rounds.push(matchInfo);
                } else {
                    // 纯标题行，创建新轮次
                    currentRound = { name: pattern.name, matches: [] };
                    rounds.push(currentRound);
                }
                foundRound = true;
                break;
            }
        }
        
        // 如果没有匹配到轮次标题，尝试作为比赛行解析
        if (!foundRound && currentRound) {
            const matchInfo = parseMatchLine(line, currentRound.name);
            if (matchInfo) {
                if (!currentRound.matches) currentRound.matches = [];
                currentRound.matches.push(matchInfo);
            }
        }
    });
    
    // 如果没有解析出结构，尝试简单分行处理
    if (rounds.length === 0) {
        lines.forEach(line => {
            if (line.trim()) {
                rounds.push({ name: '', matches: [{ text: line.trim(), status: 'current' }] });
            }
        });
    }
    
    return rounds;
}

// 解析单行比赛信息
function parseMatchLine(line, roundName) {
    // 匹配格式: "选手A 2:1 选手B" 或 "Sky 2:1 TH000"
    const scoreMatch = line.match(/([^:\s]+)\s*(\d+)\s*[:\-–]\s*(\d+)\s*([^:\s]*)/);
    if (scoreMatch) {
        const [, p1, score1, score2, p2] = scoreMatch;
        return {
            name: roundName,
            player1: p1.trim(),
            player2: p2.trim() || 'TBD',
            score1: parseInt(score1),
            score2: parseInt(score2),
            status: 'completed'
        };
    }
    
    // 匹配格式: "比赛名: 选手A vs 选手B"
    const vsMatch = line.match(/([^:：]+)[:：]?\s*(.+?)\s+(vs|VS|对)\s+(.+)/i);
    if (vsMatch) {
        return {
            name: roundName,
            player1: vsMatch[2].trim(),
            player2: vsMatch[4].trim(),
            status: 'current'
        };
    }
    
    // 匹配格式: "A组: Sky vs Moon"
    const groupMatch = line.match(/(.+?):\s*(.+)/);
    if (groupMatch && !line.includes('：') && !line.includes(':')) {
        return {
            name: groupMatch[1].trim(),
            player1: groupMatch[2].trim(),
            player2: 'TBD',
            status: 'current'
        };
    }
    
    // 无法解析，返回通用信息
    return null;
}

// 渲染赛程进度树形结构
function renderProgressTree(progressData) {
    let html = '<div class="event-progress-tree">';
    
    progressData.forEach(round => {
        if (typeof round === 'string') {
            // 纯文本行
            html += `
                <div class="progress-round">
                    <span class="round-label"></span>
                    <div class="round-matches">
                        <div class="progress-match current">
                            <span>${round}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (round.name && !round.matches && round.player1) {
            // 单场比赛
            const isCompleted = round.status === 'completed';
            const isCurrent = round.status === 'current';
            
            html += `
                <div class="progress-round">
                    <span class="round-label">${round.name || ''}</span>
                    <div class="round-matches">
                        <div class="progress-match ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                            <span class="match-player ${round.player1 && round.player2 ? '' : ''}">${round.player1 || 'TBD'}</span>
                            ${round.score1 !== undefined ? `
                                <span class="match-vs">vs</span>
                                <span class="match-player">${round.player2 || 'TBD'}</span>
                                <span class="match-score-mini">${round.score1}:${round.score2}</span>
                            ` : `
                                <span class="match-vs">vs</span>
                                <span class="match-player">${round.player2 || 'TBD'}</span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } else if (round.matches) {
            // 多场比赛的轮次
            const roundMatches = Array.isArray(round) ? round : [round];
            html += `
                <div class="progress-round">
                    <span class="round-label">${round.name || ''}</span>
                    <div class="round-matches">
                        ${round.matches.map(match => {
                            const isCompleted = match.status === 'completed';
                            const isCurrent = match.status === 'current';
                            
                            return `
                                <div class="progress-match ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                                    <span class="match-player">${match.player1 || 'TBD'}</span>
                                    ${match.score1 !== undefined ? `
                                        <span class="match-vs">vs</span>
                                        <span class="match-player">${match.player2 || 'TBD'}</span>
                                        <span class="match-score-mini">${match.score1}:${match.score2}</span>
                                    ` : `
                                        <span class="match-vs">vs</span>
                                        <span class="match-player">${match.player2 || 'TBD'}</span>
                                    `}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            // 纯文本或无法解析
            html += `
                <div class="progress-round">
                    <span class="round-label">${round.name || ''}</span>
                    <div class="round-matches">
                        <div class="progress-match current">
                            <span>${round.text || round}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}

function showEventDetail(eventId) {
    const events = getShowEvents();
    const event = events.find(e => e.id === eventId);
    
    if (!event) return;
    
    // 保存当前页面状态
    previousPage = getCurrentPage();
    
    // 隐藏其他页面，显示赛事详情页
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-event-detail').classList.add('active');
    
    // 填充赛事信息
    document.getElementById('detail-event-name').textContent = event.name;
    document.getElementById('detail-event-avatar').textContent = event.emoji;
    document.getElementById('detail-event-display-name').textContent = event.name;
    document.getElementById('detail-event-subtitle').textContent = event.subtitle || '';
    
    // 设置赛事状态
    const statusEl = document.getElementById('detail-event-status');
    if (event.status === 'ongoing') {
        statusEl.textContent = '进行中';
        statusEl.className = 'event-status-badge ongoing';
    } else {
        statusEl.textContent = '已结束';
        statusEl.className = 'event-status-badge finished';
    }
    
    // 设置基本信息
    document.getElementById('detail-event-date').textContent = event.date || '未知';
    document.getElementById('detail-event-format').textContent = event.format || '未知';
    document.getElementById('detail-event-players').textContent = event.players || '未知';
    document.getElementById('detail-event-prize').textContent = event.prize || '待定';
    
    // 设置赞助商
    const sponsorEl = document.getElementById('detail-event-sponsor');
    if (sponsorEl) {
        sponsorEl.textContent = event.sponsor || '暂无赞助商';
    }
    
    // 设置地图池（优先使用 mapsText，否则使用 subtitle 作为地图池文本）
    const mapsContent = document.getElementById('detail-event-maps');
    const mapsText = event.mapsText || event.subtitle || '';
    if (mapsText) {
        // 将文本按换行或逗号分割成地图列表
        const mapList = mapsText.split(/[\n,，]/).filter(m => m.trim());
        if (mapList.length > 0) {
            mapsContent.innerHTML = `
                <div class="event-maps-list">
                    ${mapList.map(map => `
                        <span class="event-map-item">
                            <span class="map-icon">🗺️</span>
                            ${map.trim()}
                        </span>
                    `).join('')}
                </div>
            `;
        } else {
            mapsContent.innerHTML = `<span class="glory-text">${mapsText}</span>`;
        }
    } else {
        mapsContent.innerHTML = '<span class="glory-text">暂无地图信息</span>';
    }
    
    // 设置赛程进度 - 优先使用赛程图模式
    const progressContent = document.getElementById('detail-event-progress');
    if (event.playersList && event.playersList.length > 0) {
        // 使用赛程图模式
        progressContent.innerHTML = renderBracketChart(event);
    } else if (event.progress) {
        // 尝试解析结构化进度数据
        const progressData = parseProgressData(event.progress);
        if (progressData && progressData.length > 0) {
            progressContent.innerHTML = renderProgressTree(progressData);
        } else {
            // 回退到纯文本模式
            progressContent.innerHTML = `<span class="progress-text-fallback">${event.progress}</span>`;
        }
    } else {
        progressContent.innerHTML = '<span class="honors-text">暂无赛程信息</span>';
    }
    
    // 设置历届冠军
    const championsContent = document.getElementById('detail-event-champions');
    if (event.champions) {
        const championLines = event.champions.split('\n').filter(c => c.trim());
        if (championLines.length > 0) {
            championsContent.innerHTML = championLines.map(line => {
                const parts = line.split(':');
                const period = parts[0] || '';
                const name = parts[1] || line;
                return `
                    <div class="event-champion-item">
                        <span class="event-champion-period">${period}</span>
                        <span class="event-champion-icon">🏆</span>
                        <span class="event-champion-name">${name}</span>
                    </div>
                `;
            }).join('');
        } else {
            championsContent.innerHTML = '<span class="kk-rank-text">暂无冠军记录</span>';
        }
    } else {
        championsContent.innerHTML = '<span class="kk-rank-text">暂无冠军记录</span>';
    }
    
    // 设置赛事说明
    const descContent = document.getElementById('detail-event-description');
    if (event.description) {
        descContent.innerHTML = `<span class="trait-text">${event.description.replace(/\n/g, '<br>')}</span>`;
    } else {
        descContent.innerHTML = '<span class="trait-text">暂无赛事说明</span>';
    }
    
    // 显示/隐藏编辑按钮
    document.getElementById('btn-edit-event-progress').style.display = isAdmin() ? 'block' : 'none';
}

// 返回赛事列表
function goBackToEvents() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // 返回赛事页面
    document.getElementById('page-events').classList.add('active');
    document.querySelector('.nav-item[data-page="events"]')?.classList.add('active');
    
    renderEvents();
}

// 编辑赛事进度
function editEventProgress() {
    const eventId = document.querySelector('#page-event-detail .player-detail-header h2')?.textContent;
    if (!eventId) return;
    
    const events = getShowEvents();
    const event = events.find(e => e.name === eventId);
    if (event) {
        editEvent(event.id);
    }
}

// ========================================
// 英雄页面 (已移除)
// ========================================

// 渲染荣誉页面
// ========================================
// 荣誉系统 - 赛事荣誉数据管理
// ========================================

// 默认赛事数据
const DEFAULT_EVENTS = {
    personal: [
        // 个人赛为空，用户可自行添加
    ],
    cup: [
        { id: 'spring-cup', emoji: '🌸', name: '春季杯', subtitle: '春季赛冠军' }
    ],
    team: [
        { id: 'team-match', emoji: '🛡️', name: '战队赛', subtitle: '部落对战' }
    ]
};

// 保存赛事数据到 localStorage
function saveEvents(events) {
    localStorage.setItem('wc3_events', JSON.stringify(events));
}

// 保存冠军数据到 localStorage
function saveChampions(champions) {
    localStorage.setItem('wc3_champions', JSON.stringify(champions));
}

// 渲染荣誉页面
let currentHonorCategory = 'personal';

// 同步版本（使用缓存）
function renderHonorsSync() {
    const events = getEvents();
    const champions = getChampions();
    const players = getPlayers();
    const categoryEvents = events[currentHonorCategory] || [];
    
    const content = document.getElementById('honors-content');
    
    if (categoryEvents.length === 0) {
        content.innerHTML = '<div class="no-data">该分类暂无赛事</div>';
        return;
    }
    
    let html = '';
    for (const event of categoryEvents) {
        const eventChampions = champions[event.id] || [];
        const championHtml = renderStoredChampions(eventChampions, event.id);
        
        html += `
            <div class="event-card">
                <div class="event-card-header">
                    <span class="event-emoji">${event.emoji}</span>
                    <div>
                        <div class="event-card-title">${event.name}</div>
                    </div>
                </div>
                <div class="event-champions">
                    ${championHtml}
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

// 异步版本（优先从JSON加载，确保数据最新）
async function renderHonors() {
    const events = getEvents();
    const categoryEvents = events[currentHonorCategory] || [];
    
    console.log('渲染荣誉页面 - 当前分类:', currentHonorCategory);
    console.log('赛事列表:', categoryEvents);
    
    // 先检查缓存是否有数据
    let champions = getChampions();
    console.log('缓存冠军数据:', champions);
    
    // 如果缓存为空，尝试直接加载 JSON
    if (!champions || Object.keys(champions).length === 0) {
        console.log('缓存为空，从JSON文件加载...');
        try {
            const jsonData = await loadChampionsFromJSON();
            if (jsonData && Object.keys(jsonData).length > 0) {
                champions = jsonData;
                cachedChampions = jsonData; // 更新缓存
                console.log('JSON加载成功:', champions);
            } else {
                console.log('JSON文件也为空');
            }
        } catch (e) {
            console.error('JSON加载失败:', e);
        }
    }
    
    const players = getPlayers();
    
    const content = document.getElementById('honors-content');
    
    if (categoryEvents.length === 0) {
        content.innerHTML = '<div class="no-data">该分类暂无赛事</div>';
        return;
    }
    
    let html = '';
    for (const event of categoryEvents) {
        const eventChampions = champions[event.id] || [];
        const championHtml = renderStoredChampions(eventChampions, event.id);
        
        html += `
            <div class="event-card">
                <div class="event-card-header">
                    <span class="event-emoji">${event.emoji}</span>
                    <div>
                        <div class="event-card-title">${event.name}</div>
                    </div>
                </div>
                <div class="event-champions">
                    ${championHtml}
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

// 渲染个人赛冠军（动态计算）
// 渲染已存储的冠军
function renderStoredChampions(storedChampions, eventId) {
    if (storedChampions.length === 0) {
        return '<div class="honor-list-empty">暂无冠军记录</div>';
    }

    return storedChampions.map((c, i) => {
        // 尝试查找同名成员获取等级
        const players = getPlayers();
        let championLevelTag = '';
        let runnerUpLevelTag = '';
        
        const championPlayer = players.find(p => p.name === c.name);
        if (championPlayer) {
            const level = getPlayerLevel(championPlayer.id);
            championLevelTag = `<span class="level-cell level-${level}">${level}</span>`;
        }
        
        // 如果有亚军
        let runnerUpHtml = '';
        if (c.runnerUp) {
            const runnerUpPlayer = players.find(p => p.name === c.runnerUp);
            if (runnerUpPlayer) {
                const level = getPlayerLevel(runnerUpPlayer.id);
                runnerUpLevelTag = `<span class="level-cell level-${level}">${level}</span>`;
            }
            runnerUpHtml = `<span class="honor-runnerup">🥈 ${runnerUpLevelTag}${c.runnerUp}</span>`;
        }

        // 点击入口（如果有 eventId，则支持点击查看详情）
        const clickAttr = eventId ? `onclick="showHonorDetail('${eventId}', ${i})" style="cursor:pointer"` : '';
        const clickableClass = eventId ? ' honor-list-item-clickable' : '';

        return `
            <div class="honor-list-item${clickableClass}" ${clickAttr}>
                <span class="honor-period">第${i + 1}届</span>
                <div class="honor-players">
                    <span class="honor-champion">🏆 ${championLevelTag}${c.name}</span>
                    ${runnerUpHtml}
                </div>
                ${eventId ? '<span class="honor-detail-arrow">›</span>' : ''}
            </div>
        `;
    }).join('');
}

// 分类标签切换
document.addEventListener('DOMContentLoaded', () => {
    // 初始化编辑按钮显示状态（此事件监听器已弃用，由主init处理）
});

// ========================================
// 荣誉编辑功能
// ========================================

function openHonorsEditor() {
    document.getElementById('honors-editor-modal').classList.add('active');
    // 加载分类下的赛事，并默认选择第一个
    onCategoryChange(true);
    // 清空表单
    document.getElementById('edit-champion-name').value = '';
    document.getElementById('edit-champion-period').value = '';
    document.getElementById('edit-runnerup-name').value = '';
    // 重置冠军列表为空提示
    document.getElementById('champion-list').innerHTML = '<div class="empty-hint">请选择赛事后添加记录</div>';
}

function closeHonorsEditor() {
    document.getElementById('honors-editor-modal').classList.remove('active');
}

function onCategoryChange(autoSelectFirst = false) {
    const category = document.getElementById('honors-category-select').value;
    const events = getEvents();
    const categoryEvents = events[category] || [];
    
    const select = document.getElementById('honors-event-select');
    select.innerHTML = '<option value="">请选择赛事</option>';
    
    document.getElementById('delete-event-btn').style.display = 'none';
    
    categoryEvents.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = `${e.emoji} ${e.name}`;
        option.dataset.emoji = e.emoji;
        option.dataset.name = e.name;
        select.appendChild(option);
    });
    
    // 如果有赛事且需要自动选择，则选择第一个
    if (autoSelectFirst && categoryEvents.length > 0) {
        select.value = categoryEvents[0].id;
        // 触发change事件来加载冠军列表
        select.dispatchEvent(new Event('change'));
    }
    
    // 监听赛事选择变化，加载对应赛事的冠军列表
    select.onchange = function() {
        const eventId = this.value;
        document.getElementById('edit-event-id').value = eventId || '';
        
        // 显示/隐藏删除按钮
        document.getElementById('delete-event-btn').style.display = 
            eventId ? 'inline-block' : 'none';
        
        if (eventId) {
            loadChampionsSimple();
        } else {
            document.getElementById('champion-list').innerHTML = '<div class="empty-hint">请选择赛事后添加记录</div>';
        }
    };
}

// 删除当前赛事及其所有冠军数据
function deleteCurrentEvent() {
    const category = document.getElementById('honors-category-select').value;
    const eventId = document.getElementById('edit-event-id').value;
    const eventSelect = document.getElementById('honors-event-select');
    const selectedOption = eventSelect.options[eventSelect.selectedIndex];
    const eventName = selectedOption ? selectedOption.textContent : '';
    
    if (!eventId) {
        alert('请先选择要删除的赛事');
        return;
    }
    
    if (!confirm(`确定要删除赛事"${eventName}"吗？\n这将同时删除该赛事的所有冠军记录！`)) {
        return;
    }
    
    // 从赛事列表中移除
    const events = getEvents();
    events[category] = events[category].filter(e => e.id !== eventId);
    saveEvents(events);
    
    // 从冠军数据中移除
    const champions = getChampions();
    delete champions[eventId];
    saveChampions(champions);
    
    // 刷新UI
    onCategoryChange();
    document.getElementById('edit-event-id').value = '';
    document.getElementById('champion-list').innerHTML = '<div class="empty-hint">请选择赛事后添加记录</div>';
    
    // 刷新荣誉页面
    renderHonors();
    
    alert('赛事已删除');
}

// 切换添加赛事表单的显示/隐藏
function toggleAddEventForm() {
    const form = document.getElementById('add-event-form');
    const btn = document.getElementById('toggle-add-event-btn');
    
    if (form.style.display === 'none') {
        form.style.display = 'block';
        btn.textContent = '➖ 收起';
        document.getElementById('new-event-name').focus();
        
        // 初始化图标选择器
        initEmojiPicker();
    } else {
        form.style.display = 'none';
        btn.textContent = '➕ 添加赛事';
        // 清空输入
        document.getElementById('new-event-name').value = '';
        document.getElementById('new-event-emoji').value = '🏆';
        document.getElementById('new-event-subtitle').value = '';
    }
}

// 初始化图标选择器
function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    const emojiInput = document.getElementById('new-event-emoji');
    const buttons = picker.querySelectorAll('.emoji-btn');
    
    // 默认选中第一个
    if (!emojiInput.value) {
        emojiInput.value = '🏆';
    }
    buttons.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.emoji === emojiInput.value);
    });
    
    // 点击事件
    buttons.forEach(btn => {
        btn.onclick = function() {
            buttons.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            emojiInput.value = this.dataset.emoji;
        };
    });
}

function addNewEvent() {
    const category = document.getElementById('honors-category-select').value;
    const name = document.getElementById('new-event-name').value.trim();
    const emoji = document.getElementById('new-event-emoji').value.trim() || '🏆';
    const subtitle = document.getElementById('new-event-subtitle').value.trim();
    
    if (!name) {
        alert('请输入赛事名称');
        return;
    }
    
    const events = getEvents();
    const eventId = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    
    if (!events[category]) {
        events[category] = [];
    }
    
    events[category].push({ id: eventId, emoji, name, subtitle });
    saveEvents(events);
    
    document.getElementById('new-event-name').value = '';
    document.getElementById('new-event-emoji').value = '';
    document.getElementById('new-event-subtitle').value = '';
    
    // 隐藏表单
    toggleAddEventForm();
    
    // 重新加载赛事列表并选中新添加的
    onCategoryChange();
    const select = document.getElementById('honors-event-select');
    select.value = eventId;
    updateEventDisplay(emoji, name, eventId);
    
    renderHonors();
}

// 渲染冠军列表（提取公共逻辑供多处使用）
function renderChampionList(eventChampions) {
    const listEl = document.getElementById('champion-list');
    if (!listEl) return;

    if (eventChampions.length === 0) {
        listEl.innerHTML = '<div class="empty-hint">暂无记录，请添加</div>';
        return;
    }

    listEl.innerHTML = eventChampions.map((c, i) => {
        const players = getPlayers();
        let championLevelTag = '';
        let runnerUpLevelTag = '';
        
        const championPlayer = players.find(p => p.name === c.name);
        if (championPlayer) {
            const level = getPlayerLevel(championPlayer.id);
            championLevelTag = `<span class="level-cell level-${level}">${level}</span>`;
        }
        
        let runnerUpHtml = '';
        if (c.runnerUp) {
            const runnerUpPlayer = players.find(p => p.name === c.runnerUp);
            if (runnerUpPlayer) {
                const level = getPlayerLevel(runnerUpPlayer.id);
                runnerUpLevelTag = `<span class="level-cell level-${level}">${level}</span>`;
            }
            runnerUpHtml = `<span class="item-player runnerup">🥈 ${runnerUpLevelTag}${c.runnerUp}</span>`;
        }

        return `
            <div class="editor-list-item">
                <span class="item-period">${c.period || '第' + (i + 1) + '届'}</span>
                <div class="item-players">
                    <span class="item-player champion">🏆 ${championLevelTag}${c.name}</span>
                    ${runnerUpHtml}
                </div>
                <button class="btn-delete" onclick="deleteChampionSimple(${i})">删除</button>
            </div>
        `;
    }).join('');
}

function loadChampionsSimple() {
    const eventId = document.getElementById('edit-event-id').value;
    if (!eventId) return;

    const champions = getChampions();
    const eventChampions = champions[eventId] || [];
    renderChampionList(eventChampions);
}

function addChampion() {
    const eventId = document.getElementById('edit-event-id').value;
    const name = document.getElementById('edit-champion-name').value.trim();
    const period = document.getElementById('edit-champion-period').value.trim();
    const runnerUp = document.getElementById('edit-runnerup-name').value.trim();
    
    if (!eventId) {
        alert('请先选择赛事');
        return;
    }
    
    if (!name) {
        alert('请输入冠军名称');
        return;
    }
    
    // 保存数据
    const champions = getChampions();
    if (!champions[eventId]) {
        champions[eventId] = [];
    }
    
    champions[eventId].push({ name, period, runnerUp });
    saveChampions(champions);
    
    // 清空输入框
    document.getElementById('edit-champion-name').value = '';
    document.getElementById('edit-champion-period').value = '';
    document.getElementById('edit-runnerup-name').value = '';
    
    // 重新渲染冠军列表
    loadChampionsSimple();
    
    // 刷新荣誉页面
    renderHonors();
}

function deleteChampionSimple(index) {
    const eventId = document.getElementById('edit-event-id').value;
    if (!eventId) return;
    
    const champions = getChampions();
    if (champions[eventId]) {
        champions[eventId].splice(index, 1);
        saveChampions(champions);
    }
    
    // 重新渲染冠军列表
    loadChampionsSimple();
    
    // 刷新荣誉页面
    renderHonors();
}

// ========================================
// 荣誉榜 - 届次详情弹窗
// ========================================

function showHonorDetail(eventId, index) {
    // 获取赛事信息
    const events = getEvents();
    let eventName = '';
    // 遍历所有分类找到对应赛事
    for (const cat of ['cup', 'personal', 'team', 'cup2']) {
        const found = (events[cat] || []).find(e => e.id === eventId);
        if (found) { eventName = found.name; break; }
    }
    
    // 获取冠军数据
    const champions = getChampions();
    const eventChampions = champions[eventId] || [];
    const c = eventChampions[index];
    if (!c) return;
    
    const period = c.period || `第${index + 1}届`;
    const players = getPlayers();
    
    // 冠军等级
    let championLevelTag = '';
    const cp = players.find(p => p.name === c.name);
    if (cp) {
        const lv = getPlayerLevel(cp.id);
        championLevelTag = `<span class="level-cell level-${lv}">${lv}</span>`;
    }
    
    // 亚军等级
    let runnerUpBlock = '';
    if (c.runnerUp) {
        let runnerUpLevelTag = '';
        const rp = players.find(p => p.name === c.runnerUp);
        if (rp) {
            const lv = getPlayerLevel(rp.id);
            runnerUpLevelTag = `<span class="level-cell level-${lv}">${lv}</span>`;
        }
        runnerUpBlock = `
            <div class="hd-row">
                <span class="hd-label">🥈 亚军</span>
                <span class="hd-value">${runnerUpLevelTag}${c.runnerUp}</span>
            </div>`;
    }
    
    // 备注
    let noteBlock = '';
    if (c.note) {
        noteBlock = `
            <div class="hd-row hd-note">
                <span class="hd-label">📝 备注</span>
                <span class="hd-value">${c.note}</span>
            </div>`;
    }
    
    // 图片
    let imageBlock = '';
    if (c.image) {
        imageBlock = `
            <div class="hd-image-wrapper">
                <img class="hd-image" src="data/images/honors/${c.image}" alt="冠军图片" loading="lazy" />
            </div>`;
    }
    
    const modal = document.getElementById('honor-detail-modal');
    document.getElementById('hd-title').textContent = `${eventName} · ${period}`;
    document.getElementById('hd-body').innerHTML = `
        ${imageBlock}
        <div class="hd-row">
            <span class="hd-label">🏆 冠军</span>
            <span class="hd-value">${championLevelTag}${c.name}</span>
        </div>
        ${runnerUpBlock}
        ${noteBlock}
    `;
    modal.classList.add('active');
}

function closeHonorDetail() {
    document.getElementById('honor-detail-modal').classList.remove('active');
}

// 格式化时间
function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
}

// ========================================
// 登录管理 (API 版本)
// ========================================

function showLoginModal() {
    if (authToken) {
        handleLogout();
        return;
    }
    document.getElementById('login-modal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    // 优先尝试 API 登录
    try {
        const result = await apiPost('/login', { username, password });
        if (result && result.success) {
            authToken = result.token;
            currentUsername = result.username;
            localStorage.setItem('wc3_api_token', authToken);
            localStorage.setItem('wc3_username', currentUsername);
            updateAdminUI();
            closeLoginModal();
            alert('登录成功！');
            await refreshData();
            renderCurrentPage(getCurrentPage());
            return;
        }
    } catch (e) {
        console.log('API 不可用，使用本地登录验证');
    }

    // 本地登录验证（静态模式）
    if (username === STATIC_ADMIN.username && password === STATIC_ADMIN.password) {
        authToken = 'local-token-' + Date.now();
        currentUsername = username;
        localStorage.setItem('wc3_api_token', authToken);
        localStorage.setItem('wc3_username', currentUsername);
        updateAdminUI();
        closeLoginModal();
        alert('登录成功！');
        await refreshData();
        renderCurrentPage(getCurrentPage());
    } else {
        alert('账号或密码错误');
    }
}

async function handleLogout() {
    try {
        await apiPost('/logout', {});
    } catch (e) {
        // 忽略 API 错误
    }
    authToken = null;
    currentUsername = null;
    localStorage.removeItem('wc3_api_token');
    localStorage.removeItem('wc3_username');
    updateAdminUI();
    await refreshData();
    renderCurrentPage(getCurrentPage());
}

function isAdmin() {
    return authToken !== null;
}

function updateAdminUI() {
    const admin = isAdmin();
    const btnAddPlayer = document.getElementById('btn-add-player');
    const btnRemovePlayer = document.getElementById('btn-remove-player');
    const btnAddMatch = document.getElementById('btn-add-match');
    const btnEditEvents = document.getElementById('btn-edit-events');
    const honorsEditBtn = document.getElementById('honors-edit-btn');
    const loginBtn = document.querySelector('.btn-login');
    
    if (btnAddPlayer) btnAddPlayer.style.display = admin ? 'flex' : 'none';
    if (btnRemovePlayer) btnRemovePlayer.style.display = admin ? 'flex' : 'none';
    if (btnAddMatch) btnAddMatch.style.display = admin ? 'block' : 'none';
    if (btnEditEvents) btnEditEvents.style.display = admin ? 'block' : 'none';
    if (honorsEditBtn) honorsEditBtn.style.display = admin ? 'block' : 'none';
    if (loginBtn) loginBtn.textContent = admin ? '退出' : '登录';
    
    renderMatches(document.getElementById('match-filter')?.value || 'all');
    renderEvents();
}

function getCurrentPage() {
    return document.querySelector('.nav-item.active')?.dataset.page || 'overview';
}

// ========================================
// 添加成员 (API 版本)
// ========================================

function showAddPlayerModal() {
    if (!isAdmin()) {
        alert('请先登录');
        showLoginModal();
        return;
    }
    document.getElementById('add-player-modal').classList.add('active');
}

function closeAddPlayerModal() {
    document.getElementById('add-player-modal').classList.remove('active');
    document.getElementById('player-name').value = '';
    document.getElementById('player-kkname').value = '';
    document.getElementById('player-points').value = '1000';
    document.getElementById('player-apm').value = '120';
    document.getElementById('player-trait').value = '';
    document.getElementById('player-glory').value = '';
    document.getElementById('player-honors').value = '';
    document.getElementById('player-kk-rank').value = '';
}

async function handleAddPlayer(e) {
    e.preventDefault();
    const players = getPlayers();
    const newId = Math.max(0, ...players.map(p => p.id || 0)) + 1;

    const player = {
        id: 'p' + Date.now(),
        name: document.getElementById('player-name').value,
        race: document.getElementById('player-race').value,
        kkname: document.getElementById('player-kkname').value || '',
        points: parseInt(document.getElementById('player-points').value) || 1000,
        wins: 0,
        losses: 0,
        apm: parseInt(document.getElementById('player-apm').value) || 120,
        trait: document.getElementById('player-trait').value || '',
        glory: document.getElementById('player-glory').value || '',
        honors: document.getElementById('player-honors').value || '',
        kkRank: document.getElementById('player-kk-rank').value || ''
    };

    // 通过 API 添加
    const result = await apiPost('/players', player);
    if (result && !result.error) {
        players.push(result);
        cachedPlayers = players;
    }
    
    closeAddPlayerModal();
    const searchText = document.getElementById('member-search')?.value || '';
    renderMembers('all', 'all', searchText);
    alert('成员添加成功！');
}

// ========================================
// 删减成员 (API 版本)
// ========================================

function showDeletePlayerModal() {
    if (!isAdmin()) {
        alert('请先登录');
        showLoginModal();
        return;
    }
    const players = getPlayers();
    const listContainer = document.getElementById('delete-player-list');
    
    if (players.length === 0) {
        listContainer.innerHTML = '<div class="no-data">暂无成员可删除</div>';
    } else {
        // 按积分降序排列
        const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
        
        listContainer.innerHTML = sortedPlayers.map(player => {
            const level = getPlayerLevel(player.id);
            const levelColors = {
                'SR': '#b8860b', 'S': '#e74c3c', 'A': '#e67e22', 'B': '#f1c40f',
                'C': '#6495ed', 'D': '#3498db', 'E': '#27ae60', 'F': '#9b59b6', 'G': '#7f8c8d'
            };
            const levelColor = levelColors[level] || '#7f8c8d';
            
            return `
                <label class="delete-player-item" data-id="${player.id}">
                    <input type="checkbox" value="${player.id}">
                    <div class="delete-player-info">
                        <span class="delete-player-name">${player.name}</span>
                        <span class="delete-player-level" style="background: ${levelColor}20; color: ${levelColor}; border: 1px solid ${levelColor}40;">${level}</span>
                        <span class="delete-player-points">${player.points}分</span>
                    </div>
                </label>
            `;
        }).join('');
        
        // 添加点击事件
        listContainer.querySelectorAll('.delete-player-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                item.classList.toggle('selected', item.querySelector('input').checked);
            });
        });
    }
    
    document.getElementById('delete-player-modal').classList.add('active');
}

function closeDeletePlayerModal() {
    document.getElementById('delete-player-modal').classList.remove('active');
}

async function confirmDeletePlayers() {
    const checkboxes = document.querySelectorAll('#delete-player-list input[type="checkbox"]:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        alert('请选择要删除的成员');
        return;
    }
    
    if (!confirm('确定要删除选中的 ' + selectedIds.length + ' 名成员吗？此操作不可恢复！')) {
        return;
    }
    
    // 通过 API 删除每个选中的成员
    for (const id of selectedIds) {
        await apiDelete(`/players/${id}`);
    }
    
    // 更新本地缓存
    cachedPlayers = cachedPlayers.filter(p => !selectedIds.includes(p.id));
    
    closeDeletePlayerModal();
    
    // 刷新成员列表
    const searchText = document.getElementById('member-search')?.value || '';
    renderMembers('all', 'all', searchText);
    
    alert('已删除 ' + selectedIds.length + ' 名成员');
}

// ========================================
// 录入比赛 (API 版本)
// ========================================

function showAddMatchModal() {
    if (!isAdmin()) {
        alert('请先登录');
        showLoginModal();
        return;
    }
    const players = getPlayers();
    if (players.length < 2) {
        alert('请先添加至少2名成员');
        return;
    }

    // 生成成员选择列表
    const redHtml = players.map(p => `
        <div class="team-player-select">
            <input type="checkbox" id="red-${p.id}" value="${p.id}">
            <label for="red-${p.id}"><span class="race-tag race-${p.race}">${p.name}</span></label>
        </div>
    `).join('');
    
    const blueHtml = players.map(p => `
        <div class="team-player-select">
            <input type="checkbox" id="blue-${p.id}" value="${p.id}">
            <label for="blue-${p.id}"><span class="race-tag race-${p.race}">${p.name}</span></label>
        </div>
    `).join('');

    document.getElementById('team-red-players').innerHTML = redHtml;
    document.getElementById('team-blue-players').innerHTML = blueHtml;

    // 设置默认时间
    document.getElementById('match-time').value = new Date().toISOString().slice(0, 16);

    document.getElementById('add-match-modal').classList.add('active');
}

function closeAddMatchModal() {
    document.getElementById('add-match-modal').classList.remove('active');
}

async function handleAddMatch(e) {
    e.preventDefault();

    const redPlayers = [...document.querySelectorAll('#team-red-players input:checked')].map(i => i.value);
    const bluePlayers = [...document.querySelectorAll('#team-blue-players input:checked')].map(i => i.value);

    if (redPlayers.length === 0 || bluePlayers.length === 0) {
        alert('请选择双方队伍成员');
        return;
    }

    const redScore = parseInt(document.getElementById('score-red').value);
    const blueScore = parseInt(document.getElementById('score-blue').value);

    const match = {
        id: 'm' + Date.now(),
        type: document.getElementById('match-type').value,
        date: document.getElementById('match-time').value,
        redPlayers,
        bluePlayers,
        redScore,
        blueScore
    };

    // 添加到缓存
    const matches = getMatches();
    matches.unshift(match);
    cachedMatches = matches;

    // 计算积分变化并更新
    const pointsInfo = await updatePlayerStats(redPlayers, bluePlayers, redScore, blueScore);

    // 在静态模式下，需要下载更新后的数据文件
    if (RUNTIME_MODE !== 'api') {
        downloadUpdatedData();
    }

    closeAddMatchModal();
    renderMatches(document.getElementById('match-filter').value);
    renderOverview();
    
    alert(`比赛录入成功！\n\n${pointsInfo.message}`);
}

// 下载更新后的数据文件（静态模式）
function downloadUpdatedData() {
    const data = {
        players: cachedPlayers,
        matches: cachedMatches,
        events: cachedEvents,
        champions: cachedChampions
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wc3-data-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('⚠️ 重要提示：\n\n积分数据已更新到内存，但 GitHub Pages 无法直接保存文件。\n\n请使用「WC3战绩管理工具」打开刚下载的 wc3-data-backup.json 文件，然后导出到 GitHub 仓库的 data 文件夹。\n\n或者把以下文件内容手动更新到仓库：\n- data/players.json（成员积分）\n- data/matches.json（对战记录）');
}

// 更新玩家统计 - 使用新积分规则
async function updatePlayerStats(redPlayers, bluePlayers, redScore, blueScore) {
    const players = getPlayers();
    const scoreDiff = Math.abs(redScore - blueScore);
    
    // 计算双方平均积分和平均段位
    const redAvgPoints = redPlayers.reduce((sum, id) => {
        const p = players.find(pl => pl.id === id);
        return sum + (p ? p.points : 1000);
    }, 0) / redPlayers.length;
    
    const blueAvgPoints = bluePlayers.reduce((sum, id) => {
        const p = players.find(pl => pl.id === id);
        return sum + (p ? p.points : 1000);
    }, 0) / bluePlayers.length;
    
    const redLevel = getLevelByPoints(redAvgPoints);
    const blueLevel = getLevelByPoints(blueAvgPoints);
    const redLevelValue = LEVEL_VALUE[redLevel] || 0;
    const blueLevelValue = LEVEL_VALUE[blueLevel] || 0;
    
    // 基础分 = 比分差 × 10
    const basePoints = scoreDiff * 10;
    
    // 计算积分变化
    let redPointChange, bluePointChange, winnerSide, winnerLevel;
    
    if (redScore > blueScore) {
        let multiplier = 1;
        if (redLevelValue < blueLevelValue) {
            multiplier = 2;
        } else if (redLevelValue > blueLevelValue) {
            multiplier = 0.5;
        }
        redPointChange = Math.round(basePoints * multiplier);
        bluePointChange = -Math.round(basePoints * multiplier);
        winnerSide = '部落';
        winnerLevel = redLevel;
    } else {
        let multiplier = 1;
        if (blueLevelValue < redLevelValue) {
            multiplier = 2;
        } else if (blueLevelValue > redLevelValue) {
            multiplier = 0.5;
        }
        bluePointChange = Math.round(basePoints * multiplier);
        redPointChange = -Math.round(basePoints * multiplier);
        winnerSide = '联盟';
        winnerLevel = blueLevel;
    }
    
    // 应用积分和胜败变化
    if (redScore > blueScore) {
        redPlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.wins++;
                p.points = Math.max(0, p.points + redPointChange);
            }
        });
        bluePlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.losses++;
                p.points = Math.max(0, p.points + bluePointChange);
            }
        });
    } else {
        bluePlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.wins++;
                p.points = Math.max(0, p.points + bluePointChange);
            }
        });
        redPlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.losses++;
                p.points = Math.max(0, p.points + redPointChange);
            }
        });
    }

    // 更新缓存
    cachedPlayers = players;
    
    // 尝试更新到服务器
    const updates = players.filter(p => 
        redPlayers.includes(p.id) || bluePlayers.includes(p.id)
    ).map(p => ({ id: p.id, points: p.points }));
    
    try {
        await apiPost('/players/updatePoints', updates);
    } catch (e) {
        // 静态模式下忽略 API 错误
    }
    
    // 返回积分变化信息
    return {
        message: `${winnerSide}（${winnerLevel}）\n每人：+${Math.abs(redPointChange)}分\n败方每人：${redPointChange}分`
    };
}

// 删除比赛 (API 版本)
async function deleteMatch(id) {
    if (!confirm('确定删除这场比赛？')) return;
    
    // 获取要删除的比赛信息
    const matches = getMatches();
    const matchToDelete = matches.find(m => m.id === id);
    
    if (matchToDelete) {
        // 回滚玩家统计
        await rollbackMatchStats(matchToDelete);
    }
    
    // 通过 API 删除
    await apiDelete(`/matches/${id}`);
    
    // 更新本地缓存
    cachedMatches = matches.filter(m => m.id !== id);
    
    renderMatches(document.getElementById('match-filter').value);
}

// 回滚比赛对玩家统计的影响 (API 版本)
async function rollbackMatchStats(match) {
    const players = getPlayers();
    const { redPlayers, bluePlayers, redScore, blueScore } = match;
    
    // 计算当时的积分变化（使用当时的比分和队伍配置）
    const scoreDiff = Math.abs(redScore - blueScore);
    const basePoints = scoreDiff * 10;
    
    // 计算双方平均积分（用于判断段位）
    const redAvgPoints = redPlayers.reduce((sum, id) => {
        const p = players.find(pl => pl.id === id);
        return sum + (p ? p.points : 1000);
    }, 0) / redPlayers.length;
    
    const blueAvgPoints = bluePlayers.reduce((sum, id) => {
        const p = players.find(pl => pl.id === id);
        return sum + (p ? p.points : 1000);
    }, 0) / bluePlayers.length;
    
    const redLevel = getLevelByPoints(redAvgPoints);
    const blueLevel = getLevelByPoints(blueAvgPoints);
    const redLevelValue = LEVEL_VALUE[redLevel] || 0;
    const blueLevelValue = LEVEL_VALUE[blueLevel] || 0;
    
    let redPointChange, bluePointChange;
    
    if (redScore > blueScore) {
        let multiplier = 1;
        if (redLevelValue < blueLevelValue) {
            multiplier = 2;
        } else if (redLevelValue > blueLevelValue) {
            multiplier = 0.5;
        }
        redPointChange = Math.round(basePoints * multiplier);
        bluePointChange = -Math.round(basePoints * multiplier);
    } else {
        let multiplier = 1;
        if (blueLevelValue < redLevelValue) {
            multiplier = 2;
        } else if (blueLevelValue > redLevelValue) {
            multiplier = 0.5;
        }
        bluePointChange = Math.round(basePoints * multiplier);
        redPointChange = -Math.round(basePoints * multiplier);
    }
    
    // 回滚胜场/败场
    if (redScore > blueScore) {
        redPlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.wins = Math.max(0, p.wins - 1);
                p.points = Math.max(0, p.points - redPointChange);
            }
        });
        bluePlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.losses = Math.max(0, p.losses - 1);
                p.points = Math.max(0, p.points - bluePointChange);
            }
        });
    } else {
        bluePlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.wins = Math.max(0, p.wins - 1);
                p.points = Math.max(0, p.points - bluePointChange);
            }
        });
        redPlayers.forEach(id => {
            const p = players.find(pl => pl.id === id);
            if (p) {
                p.losses = Math.max(0, p.losses - 1);
                p.points = Math.max(0, p.points - redPointChange);
            }
        });
    }
    
    // 更新到服务器
    const updates = players.filter(p => 
        redPlayers.includes(p.id) || bluePlayers.includes(p.id)
    ).map(p => ({ id: p.id, points: p.points }));
    
    if (updates.length > 0) {
        await apiPost('/players/updatePoints', updates);
    }
    
    cachedPlayers = players;
}

// ========================================
// 事件监听
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('页面加载完成，开始初始化...');
    
    // 加载数据
    await initData();
    
    // 检查登录状态
    const loggedIn = await checkAuth();
    updateAdminUI();

    // 导航点击
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`找到 ${navItems.length} 个导航项`);
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('点击了导航:', item.dataset.page);
            navigateTo(item.dataset.page);
        });
    });
    
    console.log('初始化完成!');

    // 种族筛选
    document.querySelectorAll('.race-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.race-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const searchText = document.getElementById('member-search').value;
            const filterLevel = document.querySelector('.level-tab.active')?.dataset.level || 'all';
            renderMembers(tab.dataset.race, filterLevel, searchText);
        });
    });

    // 段位筛选
    document.querySelectorAll('.level-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const searchText = document.getElementById('member-search').value;
            const filterRace = document.querySelector('.race-tab.active')?.dataset.race || 'all';
            renderMembers(filterRace, tab.dataset.level, searchText);
        });
    });

    // 成员搜索
    document.getElementById('member-search').addEventListener('input', (e) => {
        const filterRace = document.querySelector('.race-tab.active')?.dataset.race || 'all';
        const filterLevel = document.querySelector('.level-tab.active')?.dataset.level || 'all';
        renderMembers(filterRace, filterLevel, e.target.value);
    });

    // 赛事状态筛选
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentEventStatus = tab.dataset.status;
            renderEvents();
        });
    });

    // 对战筛选
    const matchFilter = document.getElementById('match-filter');
    if (matchFilter) {
        matchFilter.addEventListener('change', (e) => {
            const searchValue = document.getElementById('match-player-search').value;
            renderMatches(e.target.value, searchValue);
        });
    }

    // 成员搜索
    const matchSearch = document.getElementById('match-player-search');
    if (matchSearch) {
        matchSearch.addEventListener('input', (e) => {
            const filterValue = document.getElementById('match-filter').value;
            renderMatches(filterValue, e.target.value);
        });
    }

    // 荣誉页面分类切换
    document.querySelectorAll('.honors-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.honors-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentHonorCategory = tab.dataset.category;
            renderHonors();
        });
    });

    // 点击弹窗背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // 初始渲染
    renderOverview();
});
