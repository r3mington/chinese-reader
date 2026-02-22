import React, { useState, useEffect } from 'react';
import { getStoryStats, resetStoryStats, deleteSession } from '../lib/stats';

const StoryStatsPage = ({ story, onClose }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

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

    // SVG Line Chart
    const renderChart = (history) => {
        const sessions = history.filter(h => h.cpm > 0);
        if (sessions.length < 2) {
            return <div className="ssp-chart-empty">Not enough sessions for a chart yet.</div>;
        }

        const W = 600, H = 180, PAD = { top: 16, right: 16, bottom: 32, left: 40 };
        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top - PAD.bottom;

        const cpms = sessions.map(s => s.cpm);
        const minCpm = Math.max(0, Math.min(...cpms) - 10);
        const maxCpm = Math.max(...cpms) + 10;

        const xStep = chartW / (sessions.length - 1);
        const yScale = (cpm) => chartH - ((cpm - minCpm) / (maxCpm - minCpm)) * chartH;

        const points = sessions.map((s, i) => ({
            x: PAD.left + i * xStep,
            y: PAD.top + yScale(s.cpm),
            cpm: s.cpm,
            date: formatDate(s.date),
        }));

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const fillD = `${pathD} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

        // Y-axis labels
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
                        {/* X-axis date label every other point if many */}
                        {(sessions.length <= 6 || i % 2 === 0) && (
                            <text x={p.x} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">{p.date}</text>
                        )}
                    </g>
                ))}
            </svg>
        );
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

    // Build 14-day daily minutes chart from per-book daily log
    const buildDailyData = (dailyLog) => {
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            // Use LOCAL date string to match how sessions are stored
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${mo}-${day}`;
            days.push({
                key,
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                mins: Math.round((dailyLog[key] || 0))
            });
        }
        return days;
    };
    const dailyData = buildDailyData(stats?.dailyLog || {});
    const maxDailyMins = Math.max(...dailyData.map(d => d.mins), 1);
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

                    {/* Section 1: Hero Summary */}
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
                            <span className="ssp-card-value">{(stats?.totalLookups || 0).toLocaleString()}</span>
                            <span className="ssp-card-label">Lookups</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{uniqueChars.toLocaleString()}</span>
                            <span className="ssp-card-label">Unique Chars</span>
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
                            <span className="ssp-card-value">{estPages}</span>
                            <span className="ssp-card-label">Est. Pages</span>
                        </div>
                    </div>

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

                    {/* Section 3: Daily Minutes Chart */}
                    {hasAnyActivity && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Minutes Per Day (Last 14 Days)</h2>
                            {(() => {
                                const BAR_W = 600;
                                const BAR_H = 80;
                                const PAD_BOTTOM = 18; // for labels
                                const chartH = BAR_H - PAD_BOTTOM;
                                const colW = BAR_W / dailyData.length;
                                const gap = 3;
                                return (
                                    <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="xMidYMid meet" style={{ height: 80 }}>
                                        {dailyData.map((day, i) => {
                                            const barH = day.mins > 0 ? Math.max(2, Math.round((day.mins / maxDailyMins) * chartH)) : 2;
                                            const x = i * colW + gap / 2;
                                            const w = colW - gap;
                                            const y = chartH - barH;
                                            const showLabel = i === 0 || i === 6 || i === 13;
                                            return (
                                                <g key={i}>
                                                    <title>{day.key}: {day.mins}mn</title>
                                                    <rect
                                                        x={x} y={y} width={w} height={barH}
                                                        rx="2"
                                                        fill="#2962FF"
                                                        opacity={day.mins > 0 ? 0.9 : 0.12}
                                                    />
                                                    {showLabel && (
                                                        <text
                                                            x={x + w / 2}
                                                            y={BAR_H - 2}
                                                            textAnchor="middle"
                                                            fill="rgba(255,255,255,0.35)"
                                                            fontSize="9"
                                                        >
                                                            {day.label}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
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
                                            <th>#</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Duration</th>
                                            <th>Chars</th>
                                            <th>Lookups</th>
                                            <th>CPM</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((session, i) => {
                                            const originalIndex = sessionCount - 1 - i; // history is reversed
                                            const sessionCpm = session.duration > 0 ? Math.round((session.chars || 0) / session.duration) : 0;
                                            const cpmPct = bestCpm > 0 ? Math.round((sessionCpm / bestCpm) * 100) : 0;
                                            return (
                                                <tr key={i}>
                                                    <td className="ssp-td-num">{sessionCount - i}</td>
                                                    <td>{formatDate(session.date)}</td>
                                                    <td className="ssp-td-muted">{formatTime(session.startTime || session.date)}</td>
                                                    <td>{formatDuration(session.duration)}</td>
                                                    <td>{(session.chars || 0).toLocaleString()}</td>
                                                    <td>{(session.lookups || 0).toLocaleString()}</td>
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
                                                    <td>
                                                        <button
                                                            className="ssp-session-del-btn"
                                                            onClick={() => handleDeleteSession(originalIndex)}
                                                            title="Delete this session"
                                                        >×</button>
                                                    </td>
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
