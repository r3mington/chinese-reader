import React, { useEffect, useState } from 'react';
import { getStoryStats, getReadingStats } from '../lib/stats';
import '../styles/oled.css';

const StoryStatsModal = ({ story, onClose }) => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const load = async () => {
            if (story) {
                const data = await getStoryStats(story.id);
                setStats(data);
            }
        };
        load();
    }, [story]);

    if (!story) return null;

    // Helper to format duration
    const formatDuration = (minutes) => {
        if (!minutes) return '0m';
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Helper to generate SVG path for chart
    const renderChart = () => {
        if (!stats || !stats.history || stats.history.length < 2) {
            return (
                <div className="empty-chart">
                    Read more to see your speed evolution!
                </div>
            );
        }

        // Sort history by date
        const data = [...stats.history].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Dimensions
        const width = 300;
        const height = 150;
        const padding = 20;

        // Scales
        const maxCpm = Math.max(...data.map(d => d.cpm)) || 100;
        const minCpm = Math.min(...data.map(d => d.cpm)) || 0;

        // Points
        const points = data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
            // Invert Y because SVG 0 is top
            const y = height - padding - ((d.cpm - minCpm) / (maxCpm - minCpm || 1)) * (height - 2 * padding);
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg width="100%" height="200" viewBox={`0 0 ${width} ${height}`} className="stats-chart">
                {/* Grid lines */}
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeDasharray="4" opacity="0.5" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" opacity="0.5" />

                {/* Trend line */}
                <polyline
                    fill="none"
                    stroke="var(--accent-blue)"
                    strokeWidth="2"
                    points={points}
                />

                {/* Data points */}
                {data.map((d, i) => {
                    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
                    const y = height - padding - ((d.cpm - minCpm) / (maxCpm - minCpm || 1)) * (height - 2 * padding);
                    return (
                        <circle cx={x} cy={y} r="3" fill="var(--accent-blue)" key={i}>
                            <title>{`${new Date(d.date).toLocaleDateString()}: ${d.cpm} CPM`}</title>
                        </circle>
                    );
                })}
            </svg>
        );
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content stats-modal">
                <div className="modal-header">
                    <h2>Stats: {story.title}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="stats-summary-grid">
                        <div className="stat-card">
                            <span className="label">Total Time</span>
                            <span className="value">{formatDuration(stats?.totalTime)}</span>
                        </div>
                        <div className="stat-card">
                            <span className="label">Chars Read</span>
                            <span className="value">{stats?.totalChars || 0}</span>
                        </div>
                        <div className="stat-card">
                            <span className="label">Avg CPM</span>
                            <span className="value">{stats?.avgCpm || '--'}</span>
                        </div>
                    </div>

                    <div className="chart-container">
                        <h3>Speed Evolution (CPM)</h3>
                        {renderChart()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryStatsModal;
