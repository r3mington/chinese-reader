import React, { useState, useEffect } from 'react';
import { getReadingStats } from '../lib/stats';
import { useIsMobile } from '../lib/useIsMobile';
import '../styles/index.css';

const StatsToolbar = () => {
    const [stats, setStats] = useState({ daily: 0, weekly: 0, total: 0 });
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

        window.addEventListener('statsUpdated', handleStatsUpdate);

        // Poll every minute just in case
        const interval = setInterval(fetchStats, 60000);

        return () => {
            window.removeEventListener('statsUpdated', handleStatsUpdate);
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
                <span className="stats-icon">📊</span>
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
        </div>
    );
};

export default StatsToolbar;
