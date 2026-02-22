import React, { useState, useEffect } from 'react';
import { getGlobalStats } from '../lib/stats';
import { getStories } from '../lib/storage';

const GlobalStatsPage = ({ onClose }) => {
    const [stats, setStats] = useState(null);
    const [storyMap, setStoryMap] = useState({});
    const [uniqueChars, setUniqueChars] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const [data, stories] = await Promise.all([getGlobalStats(), getStories()]);
            const map = {};
            stories.forEach(s => { map[s.id] = s.title; });
            setStats(data);
            setStoryMap(map);
            // Count unique CJK chars across all story contents
            const allChars = new Set();
            stories.forEach(s => {
                if (s.content) {
                    [...s.content].forEach(c => {
                        const cp = c.codePointAt(0);
                        if (cp >= 0x4E00 && cp <= 0x9FFF) allChars.add(c);
                    });
                }
            });
            setUniqueChars(allChars.size);
            setLoading(false);
        };
        load();
    }, []);

    const formatDuration = (mins) => {
        const m = Math.round(mins || 0);
        if (m < 60) return `${m}mn`;
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return rem > 0 ? `${h}h ${rem}mn` : `${h}h`;
    };

    const formatDate = (isoStr) => {
        if (!isoStr) return '--';
        const d = new Date(isoStr);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Build 14-day bar data from any daily log
    const buildActivityData = (dailyLog, valueKey = 'mins') => {
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${mo}-${day}`;
            const val = Math.round(dailyLog[key] || 0);
            days.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), [valueKey]: val });
        }
        return days;
    };

    if (loading) {
        return (
            <div className="ssp-overlay">
                <div className="ssp-loading">Loading stats…</div>
            </div>
        );
    }

    const activityDays = buildActivityData(stats.dailyLog || {}, 'mins');
    const maxMins = Math.max(...activityDays.map(d => d.mins), 1);
    const charsDays = buildActivityData(stats.dailyCharsLog || {}, 'chars');
    const maxChars = Math.max(...charsDays.map(d => d.chars), 1);
    const cpmDays = buildActivityData(stats.dailyCpmLog || {}, 'cpm');
    const maxCpmDay = Math.max(...cpmDays.map(d => d.cpm), 1);
    const estPages = stats.totalChars ? Math.round(stats.totalChars / 500) : 0;

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
                        <span className="ssp-label">OVERALL</span>
                        <h1>Reading Stats</h1>
                    </div>
                </div>

                <div className="ssp-body">

                    {/* Hero Summary */}
                    <div className="ssp-hero-grid">
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{formatDuration(stats.totalTime)}</span>
                            <span className="ssp-card-label">Total Time</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{(stats.totalChars || 0).toLocaleString()}</span>
                            <span className="ssp-card-label">Chars Read</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{uniqueChars.toLocaleString()}</span>
                            <span className="ssp-card-label">Unique Chars</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{(stats.totalLookups || 0).toLocaleString()}</span>
                            <span className="ssp-card-label">Total Lookups</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{stats.totalSessions}</span>
                            <span className="ssp-card-label">Sessions</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{stats.avgCpm || '--'}</span>
                            <span className="ssp-card-label">Avg CPM</span>
                        </div>
                        <div className="ssp-stat-card ssp-card-accent">
                            <span className="ssp-card-value">{stats.bestCpm || '--'}</span>
                            <span className="ssp-card-label">Best CPM</span>
                        </div>
                        <div className="ssp-stat-card">
                            <span className="ssp-card-value">{estPages}</span>
                            <span className="ssp-card-label">Est. Pages</span>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="ssp-section">
                        <h2 className="ssp-section-title">Insights</h2>
                        <div className="ssp-insights-row">
                            <div className="ssp-insight-pill">
                                <span className="ssp-insight-icon">🔥</span>
                                <div>
                                    <div className="ssp-insight-value">{stats.streak} day{stats.streak !== 1 ? 's' : ''}</div>
                                    <div className="ssp-insight-desc">Reading streak</div>
                                </div>
                            </div>
                            <div className="ssp-insight-pill">
                                <span className="ssp-insight-icon">📚</span>
                                <div>
                                    <div className="ssp-insight-value">{stats.books.length}</div>
                                    <div className="ssp-insight-desc">Books started</div>
                                </div>
                            </div>
                            <div className="ssp-insight-pill">
                                <span className="ssp-insight-icon">⚡</span>
                                <div>
                                    <div className="ssp-insight-value">{stats.bestCpm || '--'} CPM</div>
                                    <div className="ssp-insight-desc">All-time best</div>
                                </div>
                            </div>
                            {stats.totalSessions > 0 && (
                                <div className="ssp-insight-pill">
                                    <span className="ssp-insight-icon">⏱️</span>
                                    <div>
                                        <div className="ssp-insight-value">{formatDuration(stats.totalTime / Math.max(stats.totalSessions, 1))}</div>
                                        <div className="ssp-insight-desc">Avg session length</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 14-day Activity Bar Chart */}
                    <div className="ssp-section">
                        <h2 className="ssp-section-title">Minutes Per Day
                            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>LAST 14 DAYS</span>
                        </h2>
                        {(() => {
                            const BAR_W = 600;
                            const LABEL_TOP = 14;
                            const BAR_AREA = 100;
                            const LABEL_BOT = 20;
                            const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                            const colW = BAR_W / activityDays.length;
                            const gap = 4;
                            const activeDaysCount = activityDays.filter(d => d.mins > 0).length;
                            const totalMins = activityDays.reduce((a, d) => a + d.mins, 0);
                            return (
                                <>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                        {activeDaysCount} active day{activeDaysCount !== 1 ? 's' : ''} · {totalMins}mn total
                                    </div>
                                    <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="xMidYMid meet" style={{ height: BAR_H }}>
                                        {activityDays.map((day, i) => {
                                            const barH = day.mins > 0 ? Math.max(4, Math.round((day.mins / maxMins) * BAR_AREA)) : 3;
                                            const x = i * colW + gap / 2;
                                            const w = colW - gap;
                                            const barY = LABEL_TOP + BAR_AREA - barH;
                                            const isToday = i === activityDays.length - 1;
                                            const barColor = isToday ? '#4ade80' : '#2962FF';
                                            return (
                                                <g key={i}>
                                                    <rect
                                                        x={x} y={barY} width={w} height={barH}
                                                        rx="3"
                                                        fill={barColor}
                                                        opacity={day.mins > 0 ? 0.85 : 0.1}
                                                    />
                                                    {day.mins > 0 && (
                                                        <text
                                                            x={x + w / 2}
                                                            y={barY - 3}
                                                            textAnchor="middle"
                                                            fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                            fontSize="8"
                                                            fontWeight="600"
                                                        >
                                                            {day.mins}
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
                                </>
                            );
                        })()}
                    </div>

                    {/* Chars Per Day Chart */}
                    {charsDays.some(d => d.chars > 0) && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Characters Per Day
                                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>LAST 14 DAYS</span>
                            </h2>
                            {(() => {
                                const BAR_W = 600;
                                const LABEL_TOP = 14;
                                const BAR_AREA = 100;
                                const LABEL_BOT = 20;
                                const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                                const colW = BAR_W / charsDays.length;
                                const gap = 4;
                                const totalCharsInRange = charsDays.reduce((a, d) => a + d.chars, 0);
                                const fmtChars = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
                                return (
                                    <>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                            {totalCharsInRange.toLocaleString()} chars total in range
                                        </div>
                                        <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="xMidYMid meet" style={{ height: BAR_H }}>
                                            {charsDays.map((day, i) => {
                                                const barH = day.chars > 0 ? Math.max(4, Math.round((day.chars / maxChars) * BAR_AREA)) : 3;
                                                const x = i * colW + gap / 2;
                                                const w = colW - gap;
                                                const barY = LABEL_TOP + BAR_AREA - barH;
                                                const isToday = i === charsDays.length - 1;
                                                const barColor = isToday ? '#4ade80' : '#7c3aed';
                                                return (
                                                    <g key={i}>
                                                        <rect
                                                            x={x} y={barY} width={w} height={barH}
                                                            rx="3"
                                                            fill={barColor}
                                                            opacity={day.chars > 0 ? 0.85 : 0.1}
                                                        />
                                                        {day.chars > 0 && (
                                                            <text
                                                                x={x + w / 2}
                                                                y={barY - 3}
                                                                textAnchor="middle"
                                                                fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                                fontSize="8"
                                                                fontWeight="600"
                                                            >
                                                                {fmtChars(day.chars)}
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
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Avg CPM Per Day Chart */}
                    {cpmDays.some(d => d.cpm > 0) && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">Avg CPM Per Day
                                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>LAST 14 DAYS · CHARS / MINS</span>
                            </h2>
                            {(() => {
                                const BAR_W = 600;
                                const LABEL_TOP = 14;
                                const BAR_AREA = 100;
                                const LABEL_BOT = 20;
                                const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                                const colW = BAR_W / cpmDays.length;
                                const gap = 4;
                                return (
                                    <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="xMidYMid meet" style={{ height: BAR_H }}>
                                        {cpmDays.map((day, i) => {
                                            const barH = day.cpm > 0 ? Math.max(4, Math.round((day.cpm / maxCpmDay) * BAR_AREA)) : 3;
                                            const x = i * colW + gap / 2;
                                            const w = colW - gap;
                                            const barY = LABEL_TOP + BAR_AREA - barH;
                                            const isToday = i === cpmDays.length - 1;
                                            const barColor = isToday ? '#4ade80' : '#f59e0b';
                                            return (
                                                <g key={i}>
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
                                );
                            })()}
                        </div>
                    )}

                    {/* Today's Reading */}
                    {Object.keys(stats.todayByBook || {}).length > 0 && (() => {
                        const todayEntries = Object.entries(stats.todayByBook);
                        const totalTodayMins = todayEntries.reduce((a, [, v]) => a + v.mins, 0);
                        const totalTodayChars = todayEntries.reduce((a, [, v]) => a + v.chars, 0);
                        const totalTodayCpm = totalTodayMins > 0 ? Math.round(totalTodayChars / totalTodayMins) : 0;
                        return (
                            <div className="ssp-section" style={{ borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.02)' }}>
                                <h2 className="ssp-section-title" style={{ color: '#4ade80' }}>
                                    Today
                                    <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(74,222,128,0.5)', marginLeft: 8 }}>
                                        {formatDuration(totalTodayMins)} · {totalTodayChars.toLocaleString()} chars · {totalTodayCpm} CPM
                                    </span>
                                </h2>
                                <div className="ssp-table-wrapper">
                                    <table className="ssp-table">
                                        <thead>
                                            <tr>
                                                <th>Book</th>
                                                <th>Time</th>
                                                <th>Chars</th>
                                                <th>Sessions</th>
                                                <th>CPM</th>
                                                <th>Lookups</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {todayEntries.map(([storyId, v], i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600, color: '#fff' }}>{storyMap[storyId] || storyId}</td>
                                                    <td style={{ color: '#4ade80' }}>{formatDuration(v.mins)}</td>
                                                    <td>{v.chars.toLocaleString()}</td>
                                                    <td className="ssp-td-muted">{v.sessions}</td>
                                                    <td>{v.cpm || '--'}</td>
                                                    <td className="ssp-td-muted">{v.lookups}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Per-book breakdown */}
                    {stats.books.length > 0 && (
                        <div className="ssp-section">
                            <h2 className="ssp-section-title">By Book</h2>
                            <div className="ssp-table-wrapper">
                                <table className="ssp-table">
                                    <thead>
                                        <tr>
                                            <th>Book</th>
                                            <th>Time</th>
                                            <th>Chars</th>
                                            <th>Sessions</th>
                                            <th>Avg CPM</th>
                                            <th>Last Read</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.books.map((book, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600, color: '#fff' }}>
                                                    {storyMap[book.storyId] || book.storyId}
                                                </td>
                                                <td>{formatDuration(book.totalTime)}</td>
                                                <td>{(book.totalChars || 0).toLocaleString()}</td>
                                                <td className="ssp-td-muted">{book.sessions}</td>
                                                <td>{book.avgCpm || '--'}</td>
                                                <td className="ssp-td-muted">{formatDate(book.lastSession)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {stats.books.length === 0 && (
                        <div className="ssp-empty">No reading sessions recorded yet. Start reading to see your stats!</div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default GlobalStatsPage;
