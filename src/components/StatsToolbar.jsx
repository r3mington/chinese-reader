import React, { useState, useEffect } from 'react';
import { getReadingStats, getStoryStats } from '../lib/stats';
import { useIsMobile } from '../lib/useIsMobile';
import '../styles/oled.css';

const StatsToolbar = ({ currentStoryId }) => {
    const [stats, setStats] = useState({ daily: 0, weekly: 0, total: 0 });
    const [progress, setProgress] = useState({ percentage: 0, charsRead: 0 });
    const [cpm, setCpm] = useState({ cpm: '--' });
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [viewMode, setViewMode] = useState('BOOK'); // Default to BOOK stats when reading
    const isMobile = useIsMobile();

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

        // Poll every minute just in case
        const interval = setInterval(fetchStats, 60000);

        return () => {
            window.removeEventListener('statsUpdated', handleStatsUpdate);
            window.removeEventListener('readingProgressUpdated', handleProgressUpdate);
            window.removeEventListener('cpmUpdated', handleCpmUpdate);
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
        <div className={`stats-toolbar ${isMobile ? 'mobile' : ''}`} onClick={toggleCollapse}>
            {/* Toggle Button / Label */}
            <div className="stats-mode-toggle" onClick={toggleViewMode} title="Switch between Global and Book stats">
                {viewMode === 'GLOBAL' ? 'GLOBAL' : 'BOOK'}
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
                /* BOOK STATS VIEW */
                <div className="stats-row">
                    <div className="stat-item" title="Total time spent on this book (approx)">
                        <span className="stat-label">TIME</span>
                        <span className="stat-value">{storyStats.totalTime ? Math.round(storyStats.totalTime) : 0}m</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Characters read in this book">
                        <span className="stat-label">CHARS</span>
                        <span className="stat-value">{storyStats.totalChars || 0}</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Average CPM for this book">
                        <span className="stat-label">AVG CPM</span>
                        <span className="stat-value">{storyStats.avgCpm || '--'}</span>
                    </div>
                </div>
            )}

            {/* Line 2: Progress & CPM stats (Both Desktop & Mobile now) */}
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
                </div>
            )}

            {/* Line 3 Removed for mobile - merged into Line 2 */}
        </div>
    );
};

export default StatsToolbar;
