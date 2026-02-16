import { get, set } from 'idb-keyval';

const STATS_KEY = 'reading_stats';
const STORY_CPM_KEY = 'story_cpm_stats';

// Initial state
const defaultStats = {
    totalMinutes: 0,
    dailyLog: {}, // { "YYYY-MM-DD": minutes }
    lastActive: Date.now(),
};

let currentSessionStart = null;
let savedStats = null;

// CPM tracking
let scrollEvents = []; // Array of { timestamp, charsRead }
let currentStoryId = null;
let storyStartTime = null;
let storyStartPosition = null; // Track where reading started in the story
let storyTotalChars = 0;
let lastScrollTime = null;
let storyCpmData = {}; // { storyId: { totalChars, totalSeconds, avgCpm } }

export const loadStats = async () => {
    try {
        savedStats = await get(STATS_KEY) || defaultStats;
        storyCpmData = await get(STORY_CPM_KEY) || {};
    } catch (e) {
        console.warn('Failed to load stats', e);
        savedStats = defaultStats;
        storyCpmData = {};
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

// CPM Tracking Functions
export const initStoryTracking = (storyId) => {
    currentStoryId = storyId;
    storyStartTime = null; // Will be set on first scroll
    storyTotalChars = 0;
    storyStartPosition = null; // Track where reading started
    scrollEvents = [];
    lastScrollTime = null;
};

export const trackScrollProgress = (charsRead) => {
    const now = Date.now();

    // Initialize on first scroll
    if (storyStartPosition === null) {
        storyStartPosition = charsRead;
        storyStartTime = now;
        lastScrollTime = now;
        return;
    }

    // Detect pause (>5 seconds since last scroll)
    if (lastScrollTime && (now - lastScrollTime) > 5000) {
        // Reset story timer after pause
        storyStartTime = now;
        storyStartPosition = charsRead;
        storyTotalChars = 0;
        scrollEvents = [];
    }

    lastScrollTime = now;

    // Calculate characters read from start position
    const currentProgress = charsRead - storyStartPosition;

    // Only track forward progress
    if (currentProgress > storyTotalChars) {
        const charsAdded = currentProgress - storyTotalChars;

        // Add to rolling window (incremental chars only)
        scrollEvents.push({ timestamp: now, charsRead: charsAdded });

        // Remove events older than 60 seconds
        scrollEvents = scrollEvents.filter(e => (now - e.timestamp) <= 60000);

        // Update story total (cumulative for this session)
        storyTotalChars = currentProgress;

        // Calculate story average based on time since story start
        if (currentStoryId && storyStartTime) {
            const elapsedSeconds = (now - storyStartTime) / 1000;
            if (elapsedSeconds > 0) {
                // Use the cumulative chars read from start of session
                const avgCpm = Math.round((storyTotalChars / elapsedSeconds) * 60);

                // Save to storage
                storyCpmData[currentStoryId] = {
                    totalChars: storyTotalChars,
                    totalSeconds: elapsedSeconds,
                    avgCpm
                };

                // Persist
                set(STORY_CPM_KEY, storyCpmData).catch(e => console.warn('Failed to save CPM', e));
            }
        }

        // Dispatch CPM update event
        dispatchCpmUpdate();
    }
};

export const getCpmStats = () => {
    const now = Date.now();

    // Calculate 60s CPM
    let recentCpm = '--';
    if (scrollEvents.length > 0 && lastScrollTime && (now - lastScrollTime) <= 60000) {
        const totalChars = scrollEvents.reduce((sum, e) => sum + e.charsRead, 0);
        const oldestEvent = scrollEvents[0];
        const timeSpan = (now - oldestEvent.timestamp) / 1000;

        if (timeSpan >= 10) { // Only show after 10 seconds of data
            recentCpm = Math.round((totalChars / timeSpan) * 60);
        }
    }

    // Get story average
    let storyCpm = '--';
    if (currentStoryId && storyCpmData[currentStoryId]) {
        storyCpm = storyCpmData[currentStoryId].avgCpm;
    }

    return { recentCpm, storyCpm };
};

const dispatchCpmUpdate = () => {
    const cpmStats = getCpmStats();
    window.dispatchEvent(new CustomEvent('cpmUpdated', { detail: cpmStats }));
};
