import React, { useState, useEffect } from 'react';
import { getReadingStats } from '../lib/stats';
import '../styles/index.css';

const StatsToolbar = () => {
    const [stats, setStats] = useState({ daily: 0, weekly: 0, total: 0 });

    const fetchStats = async () => {
        const data = await getReadingStats();
        setStats(data);
    };

    useEffect(() => {
        fetchStats();

        // Listen for updates from stats.js
        const handleStatsUpdate = (e) => {
            if (e.detail) {
                // e.detail is the full stats object, we might need to re-calculate daily/weekly 
                // or just re-fetch to be consistent and simple
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

    return (
        <div className="stats-toolbar">
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
