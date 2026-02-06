import { get, set } from 'idb-keyval';

const STATS_KEY = 'reading_stats';

// Initial state
const defaultStats = {
    totalMinutes: 0,
    dailyLog: {}, // { "YYYY-MM-DD": minutes }
    lastActive: Date.now(),
};

let currentSessionStart = null;
let savedStats = null;

export const loadStats = async () => {
    try {
        savedStats = await get(STATS_KEY) || defaultStats;
    } catch (e) {
        console.warn('Failed to load stats', e);
        savedStats = defaultStats;
    }
    return savedStats;
};

export const startReadingSession = () => {
    currentSessionStart = Date.now();
};

export const endReadingSession = async () => {
    if (!currentSessionStart) return;

    const now = Date.now();
    const durationMinutes = (now - currentSessionStart) / 1000 / 60;

    if (durationMinutes > 0) {
        await updateReadingTime(durationMinutes);
    }

    currentSessionStart = null;
};

export const updateReadingTime = async (minutes) => {
    if (!savedStats) await loadStats();

    const today = new Date().toISOString().split('T')[0];

    savedStats.totalMinutes += minutes;
    savedStats.dailyLog[today] = (savedStats.dailyLog[today] || 0) + minutes;
    savedStats.lastActive = Date.now();

    try {
        await set(STATS_KEY, savedStats);
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
    } catch (e) {
        console.warn('Failed to save stats', e);
    }
};

export const getReadingStats = async () => {
    if (!savedStats) await loadStats();

    const today = new Date().toISOString().split('T')[0];
    const daily = savedStats.dailyLog[today] || 0;

    // Calculate weekly (last 7 days)
    let weekly = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        weekly += savedStats.dailyLog[dateStr] || 0;
    }

    return {
        daily: Math.round(daily),
        weekly: Math.round(weekly),
        total: Math.round(savedStats.totalMinutes)
    };
};
