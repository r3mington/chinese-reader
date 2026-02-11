import React, { useState, useEffect } from 'react';
import { getReadingStats } from '../lib/stats';
import { useIsMobile } from '../lib/useIsMobile';
import '../styles/oled.css';

const StatsToolbar = () => {
    const [stats, setStats] = useState({ daily: 0, weekly: 0, total: 0 });
    const [progress, setProgress] = useState({ percentage: 0, charsRead: 0 });
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isMobile = useIsMobile();

    const fetchStats = async () => {
        const data = await getReadingStats();
        setStats(data);
    };

    useEffect(() => {
        fetchStats();

        // Listen for updates from stats.js
        const handleStatsUpdate = (e) => {
            if (e.detail) {
                fetchStats();
            }
        };

        // Listen for reading progress from Reader.jsx
        const handleProgressUpdate = (e) => {
            if (e.detail) {
                setProgress(e.detail);
            }
        };

        window.addEventListener('statsUpdated', handleStatsUpdate);
        window.addEventListener('readingProgressUpdated', handleProgressUpdate);

        // Poll every minute just in case
        const interval = setInterval(fetchStats, 60000);

        return () => {
            window.removeEventListener('statsUpdated', handleStatsUpdate);
            window.removeEventListener('readingProgressUpdated', handleProgressUpdate);
            clearInterval(interval);
        };
    }, []);

    const toggleCollapse = () => {
        if (isMobile) {
            setIsCollapsed(!isCollapsed);
        }
    };

    if (isMobile && isCollapsed) {
        return (
            <div className="stats-toolbar collapsed" onClick={toggleCollapse}>
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
            <div className="stat-item" title="Minutes read today">
                <span className="stat-label">Daily</span>
                <span className="stat-value">{stats.daily}m</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item" title="Minutes read in last 7 days">
                <span className="stat-label">Weekly</span>
                <span className="stat-value">{stats.weekly}m</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item" title="Total minutes read">
                <span className="stat-label">Total</span>
                <span className="stat-value">{stats.total}m</span>
            </div>

            {/* Reading Progress Stats */}
            {progress.percentage > 0 && (
                <>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Reading progress">
                        <span className="stat-label">Progress</span>
                        <span className="stat-value">{progress.percentage}%</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item" title="Estimated characters read">
                        <span className="stat-label">Chars</span>
                        <span className="stat-value">{progress.charsRead}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default StatsToolbar;
