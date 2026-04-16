import React, { useState, useEffect } from 'react';
import { getStoryStats, resetStoryStats, deleteSession, updateSession } from '../lib/stats';

const StoryStatsPage = ({ story, onClose }) => {
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState('14D');
    const [loading, setLoading] = useState(true);
    const [editingSession, setEditingSession] = useState(null);
    const [editForm, setEditForm] = useState({ duration: 0, chars: 0, lookups: 0 });

    useEffect(() => {
        const load = async () => {
            const data = await getStoryStats(story.id);
            setStats(data);
            setLoading(false);
        };
        load();
    }, [story.id]);

    const handleReset = async () => {
        if (!confirm(`Reset all stats for "${story.title}"? This cannot be undone.`)) return;
        await resetStoryStats(story.id);
        const fresh = await getStoryStats(story.id);
        setStats(fresh);
    };

    const handleDeleteSession = async (originalIndex) => {
        if (!confirm('Delete this session?')) return;
        await deleteSession(story.id, originalIndex);
        const fresh = await getStoryStats(story.id);
        setStats(fresh);
    };

    const handleEditClick = (session, originalIndex) => {
        setEditingSession(originalIndex);
        setEditForm({
            duration: Math.round(session.duration || 0),
            chars: session.chars || 0,
            lookups: session.lookups || 0
        });
    };

    const handleSaveEdit = async (originalIndex) => {
        await updateSession(story.id, originalIndex, editForm);
        const fresh = await getStoryStats(story.id);
        setStats(fresh);
        setEditingSession(null);
    };

    // Format minutes as Xh Ymn
    const formatDuration = (mins) => {
        const m = Math.round(mins || 0);
        if (m < 60) return `${m}mn`;
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return rem > 0 ? `${h}h ${rem}mn` : `${h}h`;
    };

    // Format date as "Feb 17" or "Today"
    const formatDate = (isoStr) => {
        if (!isoStr) return '--';
        const d = new Date(isoStr);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Format time of day as "9:30 AM"
    const formatTime = (isoStr) => {
        if (!isoStr) return '--';
        return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // Relative time e.g. "2 days ago"
    const relativeTime = (isoStr) => {
        if (!isoStr) return '--';
        const diff = Date.now() - new Date(isoStr).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
    };

    // Compute insights
    const computeInsights = (s) => {
        if (!s || !s.history || s.history.length === 0) return null;

        const history = [...s.history].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Best session
        const best = history.reduce((max, h) => h.cpm > (max?.cpm || 0) ? h : max, null);

        // Streak: count consecutive days with sessions (from today backwards)
        const sessionDays = new Set(history.map(h => new Date(h.date).toDateString()));
        let streak = 0;
        const d = new Date();
        while (sessionDays.has(d.toDateString())) {
            streak++;
            d.setDate(d.getDate() - 1);
        }

        // CPM trend: compare avg of first 3 vs last 3 sessions
        let trend = null;
        if (history.length >= 4) {
            const firstThree = history.slice(0, 3).filter(h => h.cpm > 0);
            const lastThree = history.slice(-3).filter(h => h.cpm > 0);
            if (firstThree.length > 0 && lastThree.length > 0) {
                const avgFirst = firstThree.reduce((s, h) => s + h.cpm, 0) / firstThree.length;
                const avgLast = lastThree.reduce((s, h) => s + h.cpm, 0) / lastThree.length;
                trend = Math.round(avgLast - avgFirst);
            }
        }

        return { best, streak, trend, lastSession: history[history.length - 1] };
    };

    // SVG Line Chart — one point per day, CPM = totalChars / totalMins
    const renderChart = (history) => {
        // Aggregate sessions by local date
        const dayMap = {};
        history.forEach(s => {
            if (!s.date || !s.duration || s.duration <= 0) return;
            const chars = s.chars || 0;
            const key = localDateKeyFromISO(s.date);
            if (!dayMap[key]) dayMap[key] = { chars: 0, mins: 0, date: s.date };
            dayMap[key].chars += chars;
            dayMap[key].mins += s.duration;
        });

        const daySessions = Object.entries(dayMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, v]) => ({
                key,
                cpm: v.mins > 0 ? Math.round(v.chars / v.mins) : 0,
                date: formatDate(v.date),
            }))
            .filter(d => d.cpm > 0);

        if (daySessions.length < 2) {
            return <div className="ssp-chart-empty">Not enough sessions for a chart yet.</div>;
        }

        const W = 600, H = 180, PAD = { top: 16, right: 16, bottom: 32, left: 40 };
        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top - PAD.bottom;

        const cpms = daySessions.map(s => s.cpm);
        const minCpm = Math.max(0, Math.min(...cpms) - 10);
        const maxCpm = Math.max(...cpms) + 10;

        const xStep = chartW / (daySessions.length - 1);
        const yScale = (cpm) => chartH - ((cpm - minCpm) / (maxCpm - minCpm)) * chartH;

        const points = daySessions.map((s, i) => ({
            x: PAD.left + i * xStep,
            y: PAD.top + yScale(s.cpm),
            cpm: s.cpm,
            date: s.date,
        }));

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const fillD = `${pathD} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

        const yLabels = [minCpm, Math.round((minCpm + maxCpm) / 2), maxCpm];

        return (
            <svg viewBox={`0 0 ${W} ${H}`} className="ssp-chart-svg" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {yLabels.map((val, i) => {
                    const y = PAD.top + yScale(val);
                    return (
                        <g key={i}>
                            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">{Math.round(val)}</text>
                        </g>
                    );
                })}

                {/* Fill area */}
                <path d={fillD} fill="rgba(59,130,246,0.08)" />

                {/* Line */}
                <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />

                {/* Dots + labels */}
                {points.map((p, i) => (
                    <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#0a0a0a" strokeWidth="2" />
                        <title>{p.date}: {p.cpm} CPM</title>
                        {(daySessions.length <= 6 || i % 2 === 0) && (
                            <text x={p.x} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">{p.date}</text>
                        )}
                    </g>
                ))}
            </svg>
        );
    };

    // Helper: extract YYYY-MM-DD from ISO string in local time
    const localDateKeyFromISO = (isoStr) => {
        const d = new Date(isoStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    if (loading) {
        return (
            <div className="ssp-overlay">
                <div className="ssp-loading">Loading stats…</div>
            </div>
        );
    }

    const history = (stats?.history || []).slice().reverse(); // newest first
    const insights = computeInsights(stats);
    const sessionCount = stats?.history?.length || 0;
    const bestCpm = stats?.history?.length > 0 ? Math.max(...stats.history.map(h => h.cpm || 0)) : '--';
    const estPages = stats?.totalChars ? Math.round(stats.totalChars / 500) : 0;

    // Count unique CJK characters in the story text
    const uniqueChars = story?.content
        ? new Set([...story.content].filter(c => c.codePointAt(0) >= 0x4E00 && c.codePointAt(0) <= 0x9FFF)).size
        : 0;

    // Build rolling bar data from any daily log depending on timeRange
    const getDaysCount = () => {
        if (timeRange === '7D') return 7;
        if (timeRange === '14D') return 14;
        if (timeRange === '30D') return 30;
        if (timeRange === '6M') return 180;
        if (timeRange === 'ALL') {
            const dates = Object.keys(stats?.dailyLog || {});
            if (dates.length === 0) return 14;
            const oldest = new Date(dates.sort()[0]);
            const diff = Math.abs(new Date() - oldest);
            return Math.max(14, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
        }
        return 14;
    };

    const buildDailyData = (dailyLog, valueKey = 'mins', round = true) => {
        const days = [];
        const numDays = getDaysCount();
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${mo}-${day}`;
            const rawVal = dailyLog[key] || 0;
            const val = round ? Math.round(rawVal) : Number(rawVal);
            days.push({
                key,
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dateLabel: d.toLocaleDateString('en-US', { month: 'short' }),
                fullDate: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                isFirstOfMonth: d.getDate() === 1,
                [valueKey]: val
            });
        }
        return days;
    };
    const dailyData = buildDailyData(stats?.dailyLog || {}, 'mins');
    const maxDailyMins = Math.max(...dailyData.map(d => d.mins), 1);
    const charsDays = buildDailyData(stats?.dailyCharsLog || {}, 'chars');
    const maxChars = Math.max(...charsDays.map(d => d.chars), 1);
    const cpmDays = buildDailyData(stats?.dailyCpmLog || {}, 'cpm');
    const maxCpmDay = Math.max(...cpmDays.map(d => d.cpm), 1);
    const lookupRateDays = buildDailyData(stats?.dailyLookupRateLog || {}, 'lookupRate', false);
    const maxLookupRate = Math.max(...lookupRateDays.map(d => d.lookupRate), 1);
    const hasAnyActivity = dailyData.some(d => d.mins > 0);

    return (
        <div className="ssp-overlay" onClick={onClose}>
            <div className="ssp-page" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="ssp-header">
                    <button className="ssp-back" onClick={onClose} aria-label="Back">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                    </button>
                    <div className="ssp-title">
                        <span className="ssp-label">STATS</span>
                        <h1>{story.title}</h1>
                    </div>
                    <button className="ssp-reset-btn" onClick={handleReset} title="Reset stats for this book">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                        Reset
                    </button>
                </div>

                <div className="ssp-body">

                    {/* Book Meta Info */}
                    {(() => {
                        const content = story.content || '';
                        const totalChars = content.length;
                        const cjkChars = [...content].filter(c => { const cp = c.codePointAt(0); return cp >= 0x4E00 && cp <= 0x9FFF; });
                        const totalCjk = cjkChars.length;
                        const uniqueCjkCount = new Set(cjkChars).size;
                        const diversityRatio = totalCjk > 0 ? uniqueCjkCount / totalCjk : 0;
                        const difficulty = diversityRatio > 0.6 ? 'Very High' : diversityRatio > 0.4 ? 'High' : diversityRatio > 0.25 ? 'Medium' : 'Low';
                        const diffColor = diversityRatio > 0.6 ? '#f87171' : diversityRatio > 0.4 ? '#fb923c' : diversityRatio > 0.25 ? '#facc15' : '#4ade80';
                        const avgCpm = stats?.avgCpm && stats.avgCpm !== '--' ? stats.avgCpm : 200;
                        const estMins = totalCjk > 0 ? Math.round(totalCjk / avgCpm) : 0;
                        const progress = Math.round((story.progress || 0) * 100);
                        const dateAdded = story.createdAt ? new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
                        return (
                            <div className="ssp-section ssp-book-meta">
                                <h2 className="ssp-section-title">Book Info</h2>
                                <div className="ssp-meta-grid">
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value">{totalCjk.toLocaleString()}</span>
                                        <span className="ssp-meta-label">CJK Characters</span>
                                    </div>
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value">{uniqueCjkCount.toLocaleString()}</span>
                                        <span className="ssp-meta-label">Unique Chars</span>
                                    </div>
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value" style={{ color: diffColor }}>{difficulty}</span>
                                        <span className="ssp-meta-label">Vocab Diversity</span>
                                    </div>
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value">{formatDuration(estMins)}</span>
                                        <span className="ssp-meta-label">Est. Read Time{avgCpm !== 200 ? ' (your CPM)' : ' (200 CPM)'}</span>
                                    </div>
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value">{progress}%</span>
                                        <span className="ssp-meta-label">Scroll Progress</span>
                                    </div>
                                    <div className="ssp-meta-item">
                                        <span className="ssp-meta-value" style={{ fontSize: '13px' }}>{dateAdded}</span>
                                        <span className="ssp-meta-label">Date Added</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Section 1: Hero Summary — compact 4-up top row */}
                    {(() => {
                        // Compute this-week totals
                        const allSessions = stats?.history || [];
                        const todayKey = localDateKeyFromISO(new Date().toISOString());
                        const todaySessions = allSessions.filter(s => localDateKeyFromISO(s.date) === todayKey);
                        const todayMins = todaySessions.reduce((a, s) => a + (s.duration || 0), 0);
                        const todayChars = todaySessions.reduce((a, s) => a + (s.chars || 0), 0);
                        const lookupRate = stats?.totalChars > 0 ? ((stats.totalLookups || 0) / stats.totalChars * 100).toFixed(1) : 0;
                        const charsPerSession = sessionCount > 0 ? Math.round((stats?.totalChars || 0) / sessionCount) : 0;
                        return (
                            <div className="ssp-hero-grid">
                                <div className="ssp-stat-card">
                                    <span className="ssp-card-value">{formatDuration(stats?.totalTime)}</span>
                                    <span className="ssp-card-label">Total Time</span>
                                </div>
                                <div className="ssp-stat-card">
                                    <span className="ssp-card-value">{(stats?.totalChars || 0).toLocaleString()}</span>
                                    <span className="ssp-card-label">Chars Read</span>
                                </div>
                                <div className="ssp-stat-card">
                                    <span className="ssp-card-value">{sessionCount}</span>
                                    <span className="ssp-card-label">Sessions</span>
                                </div>
                                <div className="ssp-stat-card">
                                    <span className="ssp-card-value">{stats?.avgCpm || '--'}</span>
                                    <span className="ssp-card-label">Avg CPM</span>
                                </div>
                                <div className="ssp-stat-card ssp-card-accent">
                                    <span className="ssp-card-value">{bestCpm}</span>
                                    <span className="ssp-card-label">Best CPM</span>
                                </div>
                                <div className="ssp-stat-card">
                                    <span className="ssp-card-value">{charsPerSession.toLocaleString()}</span>
                                    <span className="ssp-card-label">Chars/Session</span>
                                </div>
                                {todayMins > 0 && (
                                    <div className="ssp-stat-card" style={{ borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }}>
                                        <span className="ssp-card-value" style={{ color: '#4ade80' }}>{formatDuration(todayMins)}</span>
                                        <span className="ssp-card-label">Today</span>
                                    </div>
                                )}
                                {todayChars > 0 && (
                                    <div className="ssp-stat-card">
                                        <span className="ssp-card-value">{todayChars.toLocaleString()}</span>
                                        <span className="ssp-card-label">Chars Today</span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Section 2: Insights */}
                    {insights && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Insights</h2>
                            <div className="ssp-insights-row">
                                <div className="ssp-insight-pill">
                                    <span className="ssp-insight-icon">🔥</span>
                                    <div>
                                        <div className="ssp-insight-value">{insights.streak} day{insights.streak !== 1 ? 's' : ''}</div>
                                        <div className="ssp-insight-desc">Reading streak</div>
                                    </div>
                                </div>
                                <div className="ssp-insight-pill">
                                    <span className="ssp-insight-icon">📅</span>
                                    <div>
                                        <div className="ssp-insight-value">{relativeTime(insights.lastSession?.date)}</div>
                                        <div className="ssp-insight-desc">Last session</div>
                                    </div>
                                </div>
                                {insights.best && (
                                    <div className="ssp-insight-pill">
                                        <span className="ssp-insight-icon">⚡</span>
                                        <div>
                                            <div className="ssp-insight-value">{insights.best.cpm} CPM</div>
                                            <div className="ssp-insight-desc">Best on {formatDate(insights.best.date)}</div>
                                        </div>
                                    </div>
                                )}
                                {insights.trend !== null && (
                                    <div className="ssp-insight-pill">
                                        <span className="ssp-insight-icon">{insights.trend >= 0 ? '📈' : '📉'}</span>
                                        <div>
                                            <div className="ssp-insight-value" style={{ color: insights.trend >= 0 ? '#4ade80' : '#f87171' }}>
                                                {insights.trend >= 0 ? '+' : ''}{insights.trend} CPM
                                            </div>
                                            <div className="ssp-insight-desc">vs. first sessions</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Time Range Tabs */}
                    <div className="ssp-time-range-tabs">
                        {['7D', '14D', '30D', '6M', 'ALL'].map(t => (
                            <button 
                                key={t}
                                className={`ssp-time-tab ${timeRange === t ? 'active' : ''}`}
                                onClick={() => setTimeRange(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Section 3: Daily Minutes Chart — redesigned */}
                    {hasAnyActivity && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Minutes Per Day
                                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>{timeRange === 'ALL' ? 'ALL TIME' : `LAST ${timeRange}`}</span>
                            </h2>
                            {(() => {
                                const numDays = getDaysCount();
                                const BAR_W = Math.max(600, numDays * 16);
                                const LABEL_TOP = 14;   // space above bars for minute values
                                const BAR_AREA = 100;   // height of bars
                                const LABEL_BOT = 20;   // space below bars for date labels
                                const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                                const colW = BAR_W / dailyData.length;
                                const gap = numDays > 30 ? 2 : 4;
                                const showLabel = numDays <= 30;

                                const activeDaysInRange = dailyData.filter(d => d.mins > 0).length;
                                return (
                                    <>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                            {activeDaysInRange} active day{activeDaysInRange !== 1 ? 's' : ''} · {Math.round(dailyData.reduce((a, d) => a + d.mins, 0))}mn total
                                        </div>
                                        <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
                                            <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>

                                            {dailyData.map((day, i) => {
                                                const barH = day.mins > 0 ? Math.max(4, Math.round((day.mins / maxDailyMins) * BAR_AREA)) : 3;
                                                const x = i * colW + gap / 2;
                                                const w = colW - gap;
                                                const barY = LABEL_TOP + BAR_AREA - barH;
                                                const isToday = i === dailyData.length - 1;
                                                const barColor = isToday ? '#4ade80' : '#2962FF';
                                                return (
                                                    <g key={i}>
                                                        <title>{`${day.fullDate}\n${day.mins} minutes`}</title>
                                                        {/* Bar */}
                                                        <rect
                                                            x={x} y={barY} width={w} height={barH}
                                                            rx="3"
                                                            fill={barColor}
                                                            opacity={day.mins > 0 ? 0.85 : 0.1}
                                                        />
                                                        {/* Value above bar */}
                                                        {day.mins > 0 && numDays <= 90 && (
                                                            <text
                                                                x={x + w / 2}
                                                                y={barY - 3}
                                                                textAnchor="middle"
                                                                fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                                fontSize={numDays > 30 ? "6" : "8"}
                                                                fontWeight="600"
                                                            >
                                                                {day.mins}
                                                            </text>
                                                        )}
                                                        {/* Date label below */}
                                                        {showLabel ? (
                                                            <text
                                                                x={x + w / 2}
                                                                y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2}
                                                                textAnchor="middle"
                                                                fill={isToday ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)'}
                                                                fontSize="8"
                                                            >
                                                                {isToday ? 'Today' : day.label.slice(0, 1)}
                                                            </text>
                                                        ) : (
                                                            day.isFirstOfMonth && (
                                                                <text
                                                                    x={x + w / 2}
                                                                    y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2}
                                                                    textAnchor="middle"
                                                                    fill="rgba(255,255,255,0.45)"
                                                                    fontSize="9"
                                                                    fontWeight="bold"
                                                                >
                                                                    {day.dateLabel}
                                                                </text>
                                                            )
                                                        )}
                                                    </g>
                                                );
                                            })}
                                            </svg>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Section 3.1: Chars Per Day Chart */}
                    {charsDays.some(d => d.chars > 0) && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Characters Per Day
                                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>{timeRange === 'ALL' ? 'ALL TIME' : `LAST ${timeRange}`}</span>
                            </h2>
                            {(() => {
                                const numDays = getDaysCount();
                                const BAR_W = Math.max(600, numDays * 16);
                                const LABEL_TOP = 14;
                                const BAR_AREA = 100;
                                const LABEL_BOT = 20;
                                const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                                const colW = BAR_W / charsDays.length;
                                const gap = numDays > 30 ? 2 : 4;
                                const showLabel = numDays <= 30;
                                const totalCharsInRange = charsDays.reduce((a, d) => a + d.chars, 0);
                                const fmtChars = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
                                return (
                                    <>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                            {totalCharsInRange.toLocaleString()} chars total in range
                                        </div>
                                        <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
                                            <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>

                                            {charsDays.map((day, i) => {
                                                const barH = day.chars > 0 ? Math.max(4, Math.round((day.chars / maxChars) * BAR_AREA)) : 3;
                                                const x = i * colW + gap / 2;
                                                const w = colW - gap;
                                                const barY = LABEL_TOP + BAR_AREA - barH;
                                                const isToday = i === charsDays.length - 1;
                                                const barColor = isToday ? '#4ade80' : '#7c3aed';
                                                return (
                                                    <g key={i}>
                                                        <title>{`${day.fullDate}\n${day.chars.toLocaleString()} characters`}</title>
                                                        <rect
                                                            x={x} y={barY} width={w} height={barH}
                                                            rx="3"
                                                            fill={barColor}
                                                            opacity={day.chars > 0 ? 0.85 : 0.1}
                                                        />
                                                        {day.chars > 0 && numDays <= 90 && (
                                                            <text
                                                                x={x + w / 2}
                                                                y={barY - 3}
                                                                textAnchor="middle"
                                                                fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                                fontSize={numDays > 30 ? "6" : "8"}
                                                                fontWeight="600"
                                                            >
                                                                {fmtChars(day.chars)}
                                                            </text>
                                                        )}
                                                        {showLabel ? (
                                                            <text
                                                                x={x + w / 2}
                                                                y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2}
                                                                textAnchor="middle"
                                                                fill={isToday ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)'}
                                                                fontSize="8"
                                                            >
                                                                {isToday ? 'T' : day.label.slice(0, 1)}
                                                            </text>
                                                        ) : (
                                                            day.isFirstOfMonth && (
                                                                <text x={x+w/2} y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="bold">
                                                                    {day.dateLabel}
                                                                </text>
                                                            )
                                                        )}
                                                    </g>
                                                );
                                            })}
                                            </svg>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Section 3.2: Avg CPM Per Day Chart */}
                    {cpmDays.some(d => d.cpm > 0) && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Avg CPM Per Day
                                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>{timeRange === 'ALL' ? 'ALL TIME' : `LAST ${timeRange}`} · CHARS / MINS</span>
                            </h2>
                            {(() => {
                                const numDays = getDaysCount();
                                const BAR_W = Math.max(600, numDays * 16);
                                const LABEL_TOP = 14;
                                const BAR_AREA = 100;
                                const LABEL_BOT = 20;
                                const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                                const colW = BAR_W / cpmDays.length;
                                const gap = numDays > 30 ? 2 : 4;
                                const showLabel = numDays <= 30;
                                return (
                                    <div className="ssp-chart-scroll-wrapper" ref={(el) => { if (el) el.scrollLeft = el.scrollWidth; }}>
                                        <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>
                                        {cpmDays.map((day, i) => {
                                            const barH = day.cpm > 0 ? Math.max(4, Math.round((day.cpm / maxCpmDay) * BAR_AREA)) : 3;
                                            const x = i * colW + gap / 2;
                                            const w = colW - gap;
                                            const barY = LABEL_TOP + BAR_AREA - barH;
                                            const isToday = i === cpmDays.length - 1;
                                            const barColor = isToday ? '#4ade80' : '#f59e0b';
                                            return (
                                                <g key={i}>
                                                    <title>{`${day.fullDate}\n${day.cpm} chars/minute`}</title>
                                                    <rect
                                                        x={x} y={barY} width={w} height={barH}
                                                        rx="3"
                                                        fill={barColor}
                                                        opacity={day.cpm > 0 ? 0.85 : 0.1}
                                                    />
                                                    {day.cpm > 0 && (
                                                        <text
                                                            x={x + w / 2}
                                                            y={barY - 3}
                                                            textAnchor="middle"
                                                            fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                            fontSize="8"
                                                            fontWeight="600"
                                                        >
                                                            {day.cpm}
                                                        </text>
                                                    )}
                                                    <text
                                                        x={x + w / 2}
                                                        y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2}
                                                        textAnchor="middle"
                                                        fill={isToday ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)'}
                                                        fontSize="8"
                                                    >
                                                        {isToday ? 'T' : day.label.slice(0, 1)}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Section 4: CPM Chart */}
                    {sessionCount >= 2 && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Speed Evolution</h2>
                            <div className="ssp-chart-container">
                                {renderChart(stats?.history || [])}
                            </div>
                        </div>
                    )}

                    {/* Section 4: Session History */}
                    <div className="ssp-section">
                        <h2 className="ssp-section-title">Session History</h2>
                        {sessionCount === 0 ? (
                            <div className="ssp-empty">No sessions recorded yet. Start reading to track your progress!</div>
                        ) : (
                            <div className="ssp-table-wrapper">
                                <table className="ssp-table">
                                    <thead>
                                        <tr>
                                            <th>Actions</th>
                                            <th>#</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Position</th>
                                            <th>Duration</th>
                                            <th>Chars</th>
                                            <th>CPM</th>
                                            <th>CPS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((session, i) => {
                                            const originalIndex = sessionCount - 1 - i; // history is reversed
                                            const sessionCpm = session.duration > 0 ? Math.round((session.chars || 0) / session.duration) : 0;
                                            const sessionCps = session.duration > 0 ? ((session.chars || 0) / (session.duration * 60)).toFixed(2) : 0;
                                            const cpmPct = bestCpm > 0 ? Math.round((sessionCpm / bestCpm) * 100) : 0;
                                            const isEditing = editingSession === originalIndex;

                                            if (isEditing) {
                                                return (
                                                    <tr key={i} className="ssp-row-editing">
                                                        <td style={{ display: 'flex', gap: '4px' }}>
                                                            <button className="ssp-edit-save" onClick={() => handleSaveEdit(originalIndex)}>Save</button>
                                                            <button className="ssp-edit-cancel" onClick={() => setEditingSession(null)}>✕</button>
                                                        </td>
                                                        <td className="ssp-td-num">{sessionCount - i}</td>
                                                        <td>{formatDate(session.date)}</td>
                                                        <td className="ssp-td-muted">{formatTime(session.startTime || session.date)}</td>
                                                        <td>--</td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="ssp-edit-input"
                                                                value={editForm.duration}
                                                                onChange={e => setEditForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                                                                min="0"
                                                            /> mn
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="ssp-edit-input"
                                                                value={editForm.chars}
                                                                onChange={e => setEditForm(prev => ({ ...prev, chars: Number(e.target.value) }))}
                                                                min="0"
                                                            />
                                                        </td>
                                                        <td>--</td>
                                                        <td>--</td>
                                                    </tr>
                                                );
                                            }

                                            return (
                                                    <tr key={i}>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <button 
                                                                    className="icon-btn ssp-edit-btn" 
                                                                    onClick={() => handleEditClick(session, originalIndex)}
                                                                    title="Edit session"
                                                                    style={{ fontSize: '14px', opacity: 0.7 }}
                                                                >✎</button>
                                                                <button
                                                                    className="ssp-session-del-btn"
                                                                    onClick={() => handleDeleteSession(originalIndex)}
                                                                    title="Delete this session"
                                                                >×</button>
                                                            </div>
                                                        </td>
                                                        <td className="ssp-td-num">{sessionCount - i}</td>
                                                        <td>{formatDate(session.date)}</td>
                                                        <td className="ssp-td-muted">{formatTime(session.startTime || session.date)}</td>
                                                        <td 
                                                            className="ssp-td-muted" 
                                                            style={{ cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline' }} 
                                                            onClick={() => {
                                                                if (session.endPosition && session.endPosition > 0) {
                                                                    window.dispatchEvent(new CustomEvent('loadStoryAndSeek', { detail: { storyId: story.id, position: session.endPosition } }));
                                                                    onClose();
                                                                }
                                                            }}
                                                        >
                                                            {session.endPosition !== undefined && session.endPosition !== null ? session.endPosition.toLocaleString() : '--'}
                                                        </td>
                                                        <td>{formatDuration(session.duration)}</td>
                                                        <td>{(session.chars || 0).toLocaleString()}</td>
                                                        <td>
                                                            <div className="ssp-cpm-cell">
                                                                <span>{sessionCpm || '--'}</span>
                                                                {sessionCpm > 0 && (
                                                                    <div className="ssp-cpm-bar-track">
                                                                        <div className="ssp-cpm-bar-fill" style={{ width: `${cpmPct}%` }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="ssp-td-muted">{sessionCps > 0 ? sessionCps : '--'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default StoryStatsPage;
