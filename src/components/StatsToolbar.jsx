import React, { useState, useEffect } from 'react';
import { getReadingStats, getStoryStats, pauseStats, resumeStats, getIsPaused, getCurrentSessionDuration } from '../lib/stats';
import { useIsMobile } from '../lib/useIsMobile';
import '../styles/oled.css';

const StatsToolbar = ({ currentStoryId }) => {
    const [stats, setStats] = useState({ daily: 0, weekly: 0, total: 0 });
    const [progress, setProgress] = useState({ percentage: 0, charsRead: 0 });
    const [cpm, setCpm] = useState({ cpm: '--' });
    const [isCollapsed, setIsCollapsed] = useState(true);
    // Track when this session started
    const [viewMode, setViewMode] = useState('BOOK'); // Default to BOOK stats when reading
    const [sessionElapsed, setSessionElapsed] = useState(0); // minutes elapsed this session
    const [isPaused, setIsPaused] = useState(getIsPaused());
    const isMobile = useIsMobile();

    // Format minutes as Xh Ymn
    const formatTime = (totalMinutes) => {
        const mins = Math.round(totalMinutes);
        if (mins < 60) return `${mins}mn`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h ${m}mn` : `${h}h`;
    };

    const fetchStats = async () => {
        const data = await getReadingStats();
        setStats(data);

        if (currentStoryId) {
            const sData = await getStoryStats(currentStoryId);
            setStoryStats(sData);
        }
    };

    useEffect(() => {
        fetchStats();

        // Listen for updates from stats.js
        const handleStatsUpdate = (e) => {
            if (e.detail) {
                // If it's a full stats update, refresh everything
                fetchStats();
            }
        };

        // ... existing listeners ...

        // Listen for reading progress from Reader.jsx
        const handleProgressUpdate = (e) => {
            if (e.detail) {
                setProgress(e.detail);
            }
        };

        // Listen for CPM updates
        const handleCpmUpdate = (e) => {
            if (e.detail) {
                setCpm(e.detail);
            }
        };

        window.addEventListener('statsUpdated', handleStatsUpdate);
        window.addEventListener('readingProgressUpdated', handleProgressUpdate);
        window.addEventListener('cpmUpdated', handleCpmUpdate);

        // Listen for pause/resume events
        const handlePauseChange = (e) => setIsPaused(e.detail.paused);
        window.addEventListener('statsPauseChanged', handlePauseChange);

        // Poll every minute + update session elapsed timer
        // We poll more frequently (1s) to show accurate seconds/minutes if we wanted,
        // but sticking to 30s or so is fine. However, to show accurate time while reading,
        // 1 minute resolution might feel "laggy" if it doesn't match wall clock exactly.
        // Let's toggle slightly faster to ensure 'sessionElapsed' updates reasonably well.
        const interval = setInterval(() => {
            // Always update session elapsed, even if paused (it will just stay constant)
            setSessionElapsed(Math.round(getCurrentSessionDuration()));

            if (!getIsPaused()) {
                fetchStats();
            }
        }, 5000); // Updated to 5s for smoother updates (though UI only shows minutes)

        return () => {
            window.removeEventListener('statsUpdated', handleStatsUpdate);
            window.removeEventListener('readingProgressUpdated', handleProgressUpdate);
            window.removeEventListener('cpmUpdated', handleCpmUpdate);
            window.removeEventListener('statsPauseChanged', handlePauseChange);
            clearInterval(interval);
        };
    }, []);

    const [storyStats, setStoryStats] = useState({ totalTime: 0, totalChars: 0 });

    const toggleViewMode = (e) => {
        e.stopPropagation();
        if (viewMode === 'GLOBAL') {
            setViewMode('BOOK');
        } else {
            setViewMode('GLOBAL');
        }
    };

    const toggleCollapse = () => {
        if (isMobile) {
            setIsCollapsed(!isCollapsed);
        }
    };

    if (isMobile && isCollapsed) {
        return (
            <div className="stats-toolbar collapsed" onClick={toggleCollapse}>
                {/* ... icon ... */}
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <rect x="2" y="12" width="3" height="6" />
                    <rect x="7" y="8" width="3" height="10" />
                    <rect x="12" y="4" width="3" height="14" />
                </svg>
            </div>
        );
    }

    return (
        <div className={`stats-toolbar ${isMobile ? 'mobile' : ''} ${isPaused ? 'paused' : ''}`} onClick={toggleCollapse}>

            {/* Top row: pause button + mode toggle inline */}
            <div className="stats-top-row">
                <button
                    className="stats-pause-btn"
                    onClick={(e) => { e.stopPropagation(); isPaused ? resumeStats() : pauseStats(); }}
                    title={isPaused ? 'Resume tracking' : 'Pause tracking'}
                    aria-label={isPaused ? 'Resume' : 'Pause'}
                >
                    {isPaused ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <polygon points="2,1 9,5 2,9" />
                        </svg>
                    ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <rect x="1.5" y="1" width="3" height="8" />
                            <rect x="5.5" y="1" width="3" height="8" />
                        </svg>
                    )}
                </button>

                <div className="stats-mode-toggle" onClick={(e) => { e.stopPropagation(); toggleViewMode(); }} title="Switch between Global and Book stats">
                    {isPaused ? 'PAUSED' : (viewMode === 'GLOBAL' ? 'GLOBAL' : 'BOOK')}
                </div>
            </div>

            {viewMode === 'GLOBAL' ? (
                /* GLOBAL STATS VIEW */
                <div className="stats-row">
                    <div className="stat-item" title="Minutes read today">
                        <span className="stat-label">DAILY</span>
                        <span className="stat-value">{stats.daily}m</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Minutes read in last 7 days">
                        <span className="stat-label">WEEKLY</span>
                        <span className="stat-value">{stats.weekly}m</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Total minutes read">
                        <span className="stat-label">TOTAL</span>
                        <span className="stat-value">{stats.total}m</span>
                    </div>
                </div>
            ) : (
                /* BOOK STATS VIEW — saved totals + live session */
                <div className="stats-row">
                    <div className="stat-item" title="Total time on this book including current session">
                        <span className="stat-label">TIME</span>
                        <span className="stat-value">
                            {formatTime((storyStats.totalTime || 0) + sessionElapsed)}
                        </span>
                    </div>
                    <div className="stat-item" title="Number of characters read up until the current position">
                        <span className="stat-label">CHARS</span>
                        <span className="stat-value">{progress.charsRead || 0}</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Average CPM based on current position and total time">
                        <span className="stat-label">AVG CPM</span>
                        <span className="stat-value">
                            {((storyStats.totalTime || 0) + sessionElapsed) > 0
                                ? Math.round((progress.charsRead || 0) / ((storyStats.totalTime || 0) + sessionElapsed))
                                : '--'}
                        </span>
                    </div>
                </div>
            )}

            {/* Line 2: Progress & CPM stats */}
            {progress.percentage > 0 && (
                <div className="stats-row">
                    <div className="stat-item" title="Reading progress">
                        <span className="stat-label">PROG</span>
                        <span className="stat-value">{progress.percentage}%</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Estimated characters read">
                        <span className="stat-label">CHARS</span>
                        <span className="stat-value">{progress.charsRead}</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Characters read in last 5m (Rolling)">
                        <span className="stat-label">CPM</span>
                        <span className="stat-value">{cpm.cpm}</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Time spent in this reading session">
                        <span className="stat-label">SESSION</span>
                        <span className="stat-value">{sessionElapsed}mn</span>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StatsToolbar;
