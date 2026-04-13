import React, { useState, useEffect } from 'react';
import { getGlobalStats } from '../lib/stats';
import { getStories } from '../lib/storage';

const GlobalStatsPage = ({ onClose }) => {
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState('14D');
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
        if (!mins) return '0m';
        if (mins < 60) return `${Math.round(mins)}m`;
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '--';
        const d = new Date(isoString);
        if (isNaN(d)) return '--';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (isoString) => {
        if (!isoString) return '--';
        const d = new Date(isoString);
        if (isNaN(d)) return '--';
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

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

    const buildActivityData = (dailyLog, valueKey = 'mins') => {
        const days = [];
        const numDays = getDaysCount();
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${mo}-${day}`;
            const val = Math.round(dailyLog[key] || 0);
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

    const buildCumulativeData = () => {
        if (!stats.allSessions || stats.allSessions.length === 0) return { days: [], bookIds: [] };
        
        const sorted = [...stats.allSessions].sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const oldestSessionDateStr = sorted[0].date.split('T')[0];
        const oldestSessionDate = new Date(oldestSessionDateStr + "T00:00:00");
        const endDay = new Date();
        
        const numDays = getDaysCount();
        const firstVisibleDate = new Date();
        firstVisibleDate.setDate(firstVisibleDate.getDate() - numDays + 1);

        const dailyCharsByBook = {}; 
        sorted.forEach(s => {
            const dateKey = s.date.split('T')[0];
            if (!dailyCharsByBook[dateKey]) dailyCharsByBook[dateKey] = {};
            dailyCharsByBook[dateKey][s.storyId] = (dailyCharsByBook[dateKey][s.storyId] || 0) + s.chars;
        });

        const startComputeDate = new Date(Math.min(oldestSessionDate, firstVisibleDate));
        
        const visibleDays = [];
        let runningTotals = {};
        
        for (let d = new Date(startComputeDate); d <= endDay; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            
            if (dailyCharsByBook[dateStr]) {
                Object.keys(dailyCharsByBook[dateStr]).forEach(bookId => {
                    runningTotals[bookId] = (runningTotals[bookId] || 0) + dailyCharsByBook[dateStr][bookId];
                });
            }
            
            if (d >= firstVisibleDate || dateStr === firstVisibleDate.toISOString().split('T')[0]) {
                let totalRow = 0;
                Object.values(runningTotals).forEach(v => totalRow += v);
                
                visibleDays.push({
                    key: dateStr,
                    label: d.toLocaleDateString('en-US', { weekday: 'short' }), 
                    dateLabel: d.toLocaleDateString('en-US', { month: 'short' }),
                    fullDate: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                    isFirstOfMonth: d.getDate() === 1,
                    books: { ...runningTotals },
                    total: totalRow
                });
            }
        }
        
        const bookIds = Array.from(new Set(sorted.map(s => s.storyId)));
        return { days: visibleDays, bookIds };
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

    const BOOK_COLORS = ['#2962FF', '#7c3aed', '#f59e0b', '#4ade80', '#ec4899', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316'];

    // W/W calculation: rolling 7-day vs prior 7-day
    const calcWoW = (dailyLog) => {
        const today = new Date();
        let thisWeek = 0, lastWeek = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            thisWeek += dailyLog[k] || 0;
        }
        for (let i = 7; i < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            lastWeek += dailyLog[k] || 0;
        }
        if (lastWeek === 0) return thisWeek > 0 ? null : null;
        return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    };
    const wowMins = calcWoW(stats.dailyLog || {});
    const wowChars = calcWoW(stats.dailyCharsLog || {});
    const fmtWoW = (v) => {
        if (v === null) return { label: '--', color: 'rgba(255,255,255,0.4)', arrow: '' };
        if (v > 0) return { label: `+${v}%`, color: '#4ade80', arrow: '▲' };
        if (v < 0) return { label: `${v}%`, color: '#f87171', arrow: '▼' };
        return { label: '0%', color: 'rgba(255,255,255,0.4)', arrow: '–' };
    };
    const wowMinsFormatted = fmtWoW(wowMins);
    const wowCharsFormatted = fmtWoW(wowChars);


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

                    {/* Time Range Tabs — sticky, right below header */}
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

                    {/* Hero 3-card row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '0 20px 20px 20px' }}>
                        {/* Card 1: Lifetime chars */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 14px' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
                                {(stats.totalChars || 0) >= 1000 ? `${((stats.totalChars || 0) / 1000).toFixed(1)}k` : (stats.totalChars || 0)}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginTop: 6 }}>LIFETIME CHARS</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{formatDuration(stats.totalTime)} total</div>
                        </div>
                        {/* Card 2: W/W minutes */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 14px' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: wowMinsFormatted.color, lineHeight: 1, letterSpacing: '-1px' }}>
                                {wowMinsFormatted.arrow} {wowMinsFormatted.label}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginTop: 6 }}>W/W MINUTES</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>vs prior 7 days</div>
                        </div>
                        {/* Card 3: W/W chars */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 14px' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: wowCharsFormatted.color, lineHeight: 1, letterSpacing: '-1px' }}>
                                {wowCharsFormatted.arrow} {wowCharsFormatted.label}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginTop: 6 }}>W/W CHARS</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>vs prior 7 days</div>
                        </div>
                    </div>


                    {/* 14-day Activity Bar Chart */}
                    <div className="ssp-section">
                        <h2 className="ssp-section-title">Minutes Per Day
                            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>{timeRange === 'ALL' ? 'ALL TIME' : `LAST ${timeRange}`}</span>
                        </h2>
                        {(() => {
                            const numDays = getDaysCount();
                            const BAR_W = Math.max(600, numDays * 16);
                            const LABEL_TOP = 14;
                            const BAR_AREA = 100;
                            const LABEL_BOT = 20;
                            const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                            const colW = BAR_W / activityDays.length;
                            const gap = numDays > 30 ? 2 : 4;
                            const showLabel = numDays <= 30;
                            const activeDaysCount = activityDays.filter(d => d.mins > 0).length;
                            const totalMins = activityDays.reduce((a, d) => a + d.mins, 0);
                            return (
                                <>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                        {activeDaysCount} active day{activeDaysCount !== 1 ? 's' : ''} · {totalMins}mn total
                                    </div>
                                    <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
                                        <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>
                                        {activityDays.map((day, i) => {
                                            const barH = day.mins > 0 ? Math.max(4, Math.round((day.mins / maxMins) * BAR_AREA)) : 3;
                                            const x = i * colW + gap / 2;
                                            const w = colW - gap;
                                            const barY = LABEL_TOP + BAR_AREA - barH;
                                            const isToday = i === activityDays.length - 1;
                                            const barColor = isToday ? '#4ade80' : '#2962FF';
                                            return (
                                                <g key={i}>
                                                    <title>{`${day.fullDate}\n${day.mins} minutes`}</title>
                                                    <rect
                                                        x={x} y={barY} width={w} height={barH}
                                                        rx="3"
                                                        fill={barColor}
                                                        opacity={day.mins > 0 ? 0.85 : 0.1}
                                                    />
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

                    {/* Chars Per Day Chart */}
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

                    {/* Avg CPM Per Day Chart */}
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
                                    <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
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
                                                    {day.cpm > 0 && numDays <= 90 && (
                                                        <text
                                                            x={x + w / 2}
                                                            y={barY - 3}
                                                            textAnchor="middle"
                                                            fill={isToday ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                                                            fontSize={numDays > 30 ? "6" : "8"}
                                                            fontWeight="600"
                                                        >
                                                            {day.cpm}
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
                                );
                            })()}
                        </div>
                    )}

                    {/* --- NEW CUMULATIVE CHARTS --- */}
                    {(() => {
                        const cumulData = buildCumulativeData();
                        if (cumulData.days.length <= 1) return null;
                        
                        const colors = ['#2962FF', '#7c3aed', '#f59e0b', '#4ade80', '#ec4899', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316'];
                        const numDays = getDaysCount();
                        const BAR_W = Math.max(600, numDays * 16);
                        const LABEL_TOP = 14;
                        const BAR_AREA = 100;
                        const LABEL_BOT = 20;
                        const BAR_H = LABEL_TOP + BAR_AREA + LABEL_BOT;
                        const maxI = Math.max(1, cumulData.days.length - 1);
                        const getX = (i) => (i / maxI) * BAR_W;
                        const showLabel = numDays <= 30;
                        const maxTotal = cumulData.days[cumulData.days.length - 1].total || 1;

                        const stackedAtDay = cumulData.days.map(day => {
                            let currentY = 0;
                            return cumulData.bookIds.map(bId => {
                                const val = day.books[bId] || 0;
                                const top = currentY + val;
                                const res = { bookId: bId, bottom: currentY, top };
                                currentY = top;
                                return res;
                            });
                        });
                        
                        const singleLinePts = cumulData.days.map((d, i) => `${getX(i)},${LABEL_TOP + BAR_AREA - (d.total / maxTotal) * BAR_AREA}`).join(' ');
                        const singleAreaPts = `${getX(0)},${LABEL_TOP + BAR_AREA} ${singleLinePts} ${getX(maxI)},${LABEL_TOP + BAR_AREA}`;

                        return (
                            <>
                                {/* Option 1: Mountain of Characters */}
                                <div className="ssp-section">
                                    <h2 className="ssp-section-title">Mountain of Characters
                                        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>CUMULATIVE BY BOOK</span>
                                    </h2>
                                    <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
                                        <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>
                                            {cumulData.bookIds.map((bId, bookIdx) => {
                                                const topPts = [];
                                                const botPts = [];
                                                cumulData.days.forEach((day, i) => {
                                                    const x = getX(i);
                                                    const stack = stackedAtDay[i][bookIdx];
                                                    topPts.push(`${x},${LABEL_TOP + BAR_AREA - (stack.top / maxTotal) * BAR_AREA}`);
                                                    botPts.unshift(`${x},${LABEL_TOP + BAR_AREA - (stack.bottom / maxTotal) * BAR_AREA}`);
                                                });
                                                return <polygon key={bId} points={`${topPts.join(' ')} ${botPts.join(' ')}`} fill={colors[bookIdx % colors.length]} opacity="0.85" />;
                                            })}
                                            
                                            {/* Labels and tooltips */}
                                            {cumulData.days.map((day, i) => {
                                                const x = getX(i);
                                                const isToday = i === maxI;
                                                const topBooksStr = cumulData.bookIds.map(id => ({ id, val: day.books[id] || 0 })).filter(b => b.val > 0).sort((a,b) => b.val - a.val).map(b => `${storyMap[b.id] || 'Unknown'}: ${b.val.toLocaleString()}`).join('\n');
                                                const snapW = BAR_W / cumulData.days.length;
                                                return (
                                                    <g key={`hover-${i}`}>
                                                        <rect x={Math.max(0, x - snapW/2)} y={0} width={snapW} height={BAR_H - LABEL_BOT} fill="transparent" style={{ cursor: 'crosshair' }}>
                                                            <title>{`${day.fullDate}\nTotal: ${day.total.toLocaleString()} chars\n\n${topBooksStr}`}</title>
                                                        </rect>
                                                        {showLabel ? (
                                                            <text x={x} y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2} textAnchor="middle" fill={isToday ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)'} fontSize="8">
                                                                {isToday ? 'T' : day.label.slice(0, 1)}
                                                            </text>
                                                        ) : (
                                                            day.isFirstOfMonth && <text x={x} y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="bold">{day.dateLabel}</text>
                                                        )}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                </div>

                                {/* Option 3: Milestone Curve */}
                                <div className="ssp-section">
                                    <h2 className="ssp-section-title">Milestone Curve
                                        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>CUMULATIVE OVERALL</span>
                                    </h2>
                                    <div className="ssp-chart-scroll-wrapper" ref={(el) => { if(el) el.scrollLeft = el.scrollWidth; }}>
                                        <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} className="ssp-chart-svg" preserveAspectRatio="none" style={{ height: BAR_H, width: `${BAR_W}px` }}>
                                            <defs>
                                                <linearGradient id="mileGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                                                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                                                </linearGradient>
                                            </defs>
                                            <polygon points={singleAreaPts} fill="url(#mileGrad)" />
                                            <polyline points={singleLinePts} fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            
                                            {/* Labels and tooltips */}
                                            {cumulData.days.map((day, i) => {
                                                const x = getX(i);
                                                const isToday = i === maxI;
                                                const snapW = BAR_W / cumulData.days.length;
                                                return (
                                                    <g key={`hover3-${i}`}>
                                                        <rect x={Math.max(0, x - snapW/2)} y={0} width={snapW} height={BAR_H - LABEL_BOT} fill="transparent" style={{ cursor: 'crosshair' }}>
                                                            <title>{`${day.fullDate}\nTotal: ${day.total.toLocaleString()} chars`}</title>
                                                        </rect>
                                                        {showLabel ? (
                                                            <text x={x} y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2} textAnchor="middle" fill={isToday ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.25)'} fontSize="8">
                                                                {isToday ? 'T' : day.label.slice(0, 1)}
                                                            </text>
                                                        ) : (
                                                            day.isFirstOfMonth && <text x={x} y={LABEL_TOP + BAR_AREA + LABEL_BOT - 2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="bold">{day.dateLabel}</text>
                                                        )}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* Reading Heatmap (full year) */}
                    {(() => {
                        const dailyLog = stats.dailyLog || {};
                        const COLS = 53;
                        const ROWS = 7;
                        const CELL = 11;
                        const GAP = 2;
                        const W = COLS * (CELL + GAP);
                        const H = ROWS * (CELL + GAP) + 20;
                        const today = new Date();
                        // Align so today is the last cell
                        const cells = [];
                        const monthLabels = [];
                        const totalCells = COLS * ROWS;
                        for (let i = totalCells - 1; i >= 0; i--) {
                            const d = new Date(today);
                            d.setDate(today.getDate() - i);
                            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            const mins = dailyLog[key] || 0;
                            const idx = totalCells - 1 - i;
                            const col = Math.floor(idx / ROWS);
                            const row = idx % ROWS;
                            const x = col * (CELL + GAP);
                            const y = row * (CELL + GAP) + 18;
                            let opacity = 0.06;
                            if (mins > 0 && mins <= 20) opacity = 0.35;
                            else if (mins > 20 && mins <= 40) opacity = 0.65;
                            else if (mins > 40) opacity = 1;
                            if (d.getDate() === 1 && col < COLS - 1) {
                                monthLabels.push({ x, label: d.toLocaleDateString('en-US', { month: 'short' }) });
                            }
                            cells.push({ x, y, key, mins, fullDate: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), opacity });
                        }
                        return (
                            <div className="ssp-section">
                                <h2 className="ssp-section-title">Reading Heatmap <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>FULL YEAR</span></h2>
                                <div className="ssp-chart-scroll-wrapper" style={{ overflowX: 'auto' }}>
                                    <svg width={W} height={H} style={{ display: 'block' }}>
                                        {monthLabels.map((m, i) => (
                                            <text key={i} x={m.x} y={13} fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="bold">{m.label}</text>
                                        ))}
                                        {cells.map((c, i) => (
                                            <rect key={i} x={c.x} y={c.y} width={CELL} height={CELL} rx="2" fill="#2962FF" opacity={c.opacity}>
                                                <title>{`${c.fullDate}\n${c.mins > 0 ? `${Math.round(c.mins)}mn read` : 'No reading'}`}</title>
                                            </rect>
                                        ))}
                                    </svg>
                                </div>
                            </div>
                        );
                    })()}

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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Per-book visual breakdown */}
                    {stats.books.length > 0 && (() => {
                        const totalChars = stats.books.reduce((a, b) => a + (b.totalChars || 0), 0) || 1;
                        const sorted = [...stats.books].sort((a, b) => (b.totalChars || 0) - (a.totalChars || 0));
                        return (
                            <div className="ssp-section">
                                <h2 className="ssp-section-title">By Book</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {sorted.map((book, i) => {
                                        const pct = Math.round(((book.totalChars || 0) / totalChars) * 100);
                                        const color = BOOK_COLORS[i % BOOK_COLORS.length];
                                        return (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {storyMap[book.storyId] || book.storyId}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                                                        <div style={{ height: 4, borderRadius: 2, background: color, opacity: 0.7, width: `${pct}%`, maxWidth: '100%', transition: 'width 0.4s' }} />
                                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{pct}%</span>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                                                        {(book.totalChars || 0) >= 1000 ? `${((book.totalChars || 0)/1000).toFixed(1)}k` : (book.totalChars || 0)} ch
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{formatDuration(book.totalTime)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* All Sessions History */}
                    <div className="ssp-section">
                        <h2 className="ssp-section-title">Session History <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.45, marginLeft: 8 }}>ALL BOOKS</span></h2>
                        {!stats.allSessions || stats.allSessions.length === 0 ? (
                            <div className="ssp-empty">No sessions recorded yet. Start reading to track your progress!</div>
                        ) : (
                            <div className="ssp-table-wrapper">
                                <table className="ssp-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Book</th>
                                            <th>Position</th>
                                            <th>Duration</th>
                                            <th>Chars</th>
                                            <th>CPM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...stats.allSessions]
                                            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                                            .map((session, i) => {
                                                const sessionCpm = session.duration > 0 ? Math.round((session.chars || 0) / session.duration) : 0;
                                                const cpmPct = stats.bestCpm > 0 ? Math.round((sessionCpm / stats.bestCpm) * 100) : 0;
                                                return (
                                                    <tr key={i}>
                                                        <td className="ssp-td-num">{stats.allSessions.length - i}</td>
                                                        <td>{formatDate(session.date)}</td>
                                                        <td className="ssp-td-muted">{formatTime(session.startTime || session.date)}</td>
                                                        <td style={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={storyMap[session.storyId] || session.storyId}>
                                                            {storyMap[session.storyId] || session.storyId}
                                                        </td>
                                                        <td 
                                                            className="ssp-td-muted" 
                                                            style={{ cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline' }} 
                                                            onClick={() => {
                                                                if (session.endPosition !== undefined && session.endPosition !== null) {
                                                                    window.dispatchEvent(new CustomEvent('loadStoryAndSeek', { detail: { storyId: session.storyId, position: session.endPosition } }));
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

export default GlobalStatsPage;
