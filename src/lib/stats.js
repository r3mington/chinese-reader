import { get, set } from 'idb-keyval';

const STATS_KEY = 'reading_stats';
const STORY_CPM_KEY = 'story_cpm_stats';
const DRAFT_KEY = 'session_draft_v1'; // periodic checkpoint of in-flight session


// Initial state
const defaultStats = {
    totalMinutes: 0,
    dailyLog: {}, // { "YYYY-MM-DD": minutes }
    lastActive: Date.now(),
};

let currentSessionStart = null;
let savedStats = null;
let isPaused = false; // Global pause flag
let sessionStartChars = 0; // chars at the moment the current session started
let isCurrentStoryRead = false; // If true, don't save per-book session stats
let sessionLookups = 0; // Track dictionary lookups in current session
let accumulatedSessionTime = 0; // ms accumulated in this session before current active segment
let globalCurrentCharsRead = 0;
let hasMeasuredSinceSessionStart = false;

// Use LOCAL date string (YYYY-MM-DD) so timezone doesn't shift sessions to wrong day
const localDateKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

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
    if (isPaused) return;
    currentSessionStart = Date.now();
    accumulatedSessionTime = 0;
    // Snapshot chars at session start so we can compute the delta on end
    sessionStartChars = globalCurrentCharsRead;
    hasMeasuredSinceSessionStart = false;
    sessionLookups = 0;
};

export const trackSessionLookup = () => {
    if (!isPaused) sessionLookups++;
};

export const pauseStats = () => {
    if (!isPaused && currentSessionStart) {
        // Accumulate the time spent in the current active segment
        accumulatedSessionTime += (Date.now() - currentSessionStart);
        currentSessionStart = null;
    }
    isPaused = true;
    window.dispatchEvent(new CustomEvent('statsPauseChanged', { detail: { paused: true } }));
};

export const resumeStats = () => {
    isPaused = false;
    // Start a new active segment
    currentSessionStart = Date.now();

    // Reset story tracking anchor so paused time isn't counted in CPM
    if (storyStartTime) {
        storyStartTime = Date.now();
        storyStartPosition = null;
        storyTotalChars = 0;
        scrollEvents = [];
    }
    window.dispatchEvent(new CustomEvent('statsPauseChanged', { detail: { paused: false } }));
};

export const getIsPaused = () => isPaused;

export const getCurrentSessionDuration = () => {
    let checkTime = accumulatedSessionTime;
    if (currentSessionStart && !isPaused) {
        checkTime += (Date.now() - currentSessionStart);
    }
    // Return minutes
    return checkTime / 1000 / 60;
};

export const endReadingSession = async () => {
    if (isPaused && accumulatedSessionTime === 0 && !currentSessionStart) return;

    const now = Date.now();

    // Calculate final duration: accumulated + current segment (if active)
    let totalDurationMs = accumulatedSessionTime;
    if (currentSessionStart && !isPaused) {
        totalDurationMs += (now - currentSessionStart);
    }

    const durationMinutes = totalDurationMs / 1000 / 60;

    // Only save sessions of at least 30 seconds
    if (durationMinutes >= 0.5) {
        await updateReadingTime(durationMinutes);

        if (currentStoryId && !isCurrentStoryRead) {
            // Chars read in THIS session = delta from when session started
            const sessionChars = Math.max(0, globalCurrentCharsRead - sessionStartChars);

            // Calculate session CPM explicitly as chars / duration
            const cpmVal = durationMinutes > 0 ? Math.round(sessionChars / durationMinutes) : 0;

            await saveSession(currentStoryId, durationMinutes, sessionChars, cpmVal, sessionLookups, globalCurrentCharsRead); // Pass lookups and position
        }
    }

    currentSessionStart = null;
    accumulatedSessionTime = 0;
    sessionStartChars = globalCurrentCharsRead; // update snapshot for next session
    hasMeasuredSinceSessionStart = false;

    // Clear any outstanding draft since we saved properly
    set(DRAFT_KEY, null).catch(() => {});
};

/**
 * Periodically called (every ~60s) to write the in-flight session to IDB.
 * If the app crashes, recoverSessionDraft() on next launch merges this.
 */
export const checkpointSession = async () => {
    if (!currentStoryId || isCurrentStoryRead) return;

    const now = Date.now();
    let totalDurationMs = accumulatedSessionTime;
    if (currentSessionStart && !isPaused) {
        totalDurationMs += (now - currentSessionStart);
    }
    const durationMinutes = totalDurationMs / 1000 / 60;
    const sessionChars = Math.max(0, globalCurrentCharsRead - sessionStartChars);

    // Only worth saving if we have meaningful data
    if (durationMinutes < 0.5 && sessionChars === 0) return;

    const draft = {
        storyId: currentStoryId,
        durationMinutes,
        chars: sessionChars,
        lookups: sessionLookups,
        endPosition: globalCurrentCharsRead,
        date: localDateKey(),
        savedAt: now
    };

    try {
        await set(DRAFT_KEY, draft);
    } catch (e) {
        console.warn('Failed to save session draft', e);
    }
};

/**
 * Called once on app init. If a session draft exists from a previous crash,
 * merges it into the real stats (if the draft is < 24h old and long enough).
 */
export const recoverSessionDraft = async () => {
    try {
        const draft = await get(DRAFT_KEY);
        if (!draft) return;

        const ageMs = Date.now() - (draft.savedAt || 0);
        const tooOld = ageMs > 24 * 60 * 60 * 1000; // ignore drafts older than 24h
        const tooShort = draft.durationMinutes < 0.5;

        if (tooOld || tooShort) {
            await set(DRAFT_KEY, null);
            return;
        }

        console.log(`[Stats] Recovering crashed session: ${Math.round(draft.durationMinutes)}mn, ${draft.chars} chars`);

        // Merge into real stats
        if (!savedStats) await loadStats();
        await updateReadingTime(draft.durationMinutes);

        if (draft.storyId && draft.durationMinutes >= 0.5) {
            const cpmVal = draft.durationMinutes > 0 ? Math.round(draft.chars / draft.durationMinutes) : 0;
            await saveSession(draft.storyId, draft.durationMinutes, draft.chars, cpmVal, draft.lookups || 0, draft.endPosition || 0);
        }

        // Clear the draft after successful recovery
        await set(DRAFT_KEY, null);
    } catch (e) {
        console.warn('Failed to recover session draft', e);
    }
};


export const updateReadingTime = async (minutes) => {
    if (!savedStats) await loadStats();

    const today = localDateKey();

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
export const initStoryTracking = (storyId, isRead = false) => {
    currentStoryId = storyId;
    isCurrentStoryRead = isRead;
    storyStartTime = null; // Will be set on first scroll
    storyTotalChars = 0;
    storyStartPosition = null; // Track where reading started
    scrollEvents = [];
    lastScrollTime = null;
    globalCurrentCharsRead = 0;
    hasMeasuredSinceSessionStart = false;
};

export const trackScrollProgress = (charsRead) => {
    if (isPaused) return; // Don't track when paused
    const now = Date.now();

    globalCurrentCharsRead = charsRead;
    if (!hasMeasuredSinceSessionStart) {
        sessionStartChars = charsRead;
        hasMeasuredSinceSessionStart = true;
    }

    // Initialize on first scroll
    if (storyStartPosition === null) {
        storyStartPosition = charsRead;
        storyStartTime = now;
        lastScrollTime = now;
        // Seed the scroll events with t=0 (now) and chars=0 so we have an anchor
        scrollEvents.push({ timestamp: now, charsRead: 0 });
        return;
    }

    // Detect pause (>5 minutes since last scroll) - effectively a new session
    if (lastScrollTime && (now - lastScrollTime) > 300000) {
        // Reset story timer after long pause
        storyStartTime = now;
        storyStartPosition = charsRead;
        storyTotalChars = 0;
        scrollEvents = [{ timestamp: now, charsRead: 0 }];
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

        // Update story total
        storyTotalChars = currentProgress;

        // Calculate story average based on time since story start
        if (currentStoryId && storyStartTime) {
            const elapsedSeconds = (now - storyStartTime) / 1000;

            // Only update story CPM after 5 seconds of reading to avoid spikes
            if (elapsedSeconds > 5) {
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

    // Calculate 5m CPM
    let recentCpm = '--';

    // Filter events for the calculation window (last 5m)
    // Note: We do this filter here too for display accuracy
    const activeEvents = scrollEvents.filter(e => (now - e.timestamp) <= 300000);

    if (activeEvents.length > 0) {
        const totalChars = activeEvents.reduce((sum, e) => sum + e.charsRead, 0);
        const oldestEvent = activeEvents[0];

        // Use time relative to NOW to account for reading time (pauses between scrolls)
        // Ensure we don't divide by zero or very small numbers
        const timeSpan = Math.max(1, (now - oldestEvent.timestamp) / 1000);

        // Only show valid stats if we have > 0 chars and > 2s of history
        if (totalChars > 0 && timeSpan >= 2) {
            recentCpm = Math.round((totalChars / timeSpan) * 60);
        } else if (activeEvents.length > 2) {
            // If we have events but 0 chars (static), CPM is 0
            // Or if we just started
            if (timeSpan >= 2) recentCpm = 0;
        }
    }

    // User requested only ONE rolling 60s measure
    // We return recentCpm but maybe label it just 'cpm'
    return { cpm: recentCpm };
};

const dispatchCpmUpdate = () => {
    // Only dispatch if we have data
    // ...
    // Simple dispatch
    window.dispatchEvent(new CustomEvent('cpmUpdated', {
        detail: getCpmStats()
    }));
};

// --- Story Specific Stats & History ---

// Get stats for a specific story
export const getStoryStats = async (storyId) => {
    if (!savedStats) await loadStats();

    // Structure: { totalTime: min, totalChars: n, history: [] }
    const storyData = (savedStats.storyStats && savedStats.storyStats[storyId]) || {
        totalTime: 0,
        totalChars: 0,
        history: [], // { date, duration, cpm, chars }
    };

    let totalCpm = 0;
    let count = 0;
    const dailyLog = {};
    const dailyCharsLog = {};
    const dailyMinsLog = {};
    const dailyLookupsLog = {};
    let recalculatedHistory = [];
    if (storyData.history) {
        // Exclude old short sessions (< 3 mins) dynamically from stats
        const validHistory = storyData.history.filter(s => s.duration >= 3);

        let validTime = 0;
        let validChars = 0;
        let validLookups = 0;

        recalculatedHistory = validHistory.map(s => {
            validTime += (s.duration || 0);
            validChars += (s.chars || 0);
            validLookups += (s.lookups || 0);

            const recalculatedCpm = s.duration > 0 ? Math.round((s.chars || 0) / s.duration) : 0;
            return { ...s, cpm: recalculatedCpm };
        });

        // Override the raw cached numbers dynamically so UI shows updated sums
        storyData.totalTime = validTime;
        storyData.totalChars = validChars;
        storyData.totalLookups = validLookups;

        recalculatedHistory.forEach(s => {
            if (s.cpm > 0) {
                totalCpm += s.cpm;
                count++;
            }
            if (s.date) {
                const day = localDateKey(new Date(s.date));
                if (s.duration > 0) {
                    dailyLog[day] = (dailyLog[day] || 0) + s.duration;
                    dailyMinsLog[day] = (dailyMinsLog[day] || 0) + s.duration;
                }
                if (s.chars > 0) {
                    dailyCharsLog[day] = (dailyCharsLog[day] || 0) + s.chars;
                }
                if (s.lookups > 0) {
                    dailyLookupsLog[day] = (dailyLookupsLog[day] || 0) + s.lookups;
                }
            }
        });
    }

    const dailyCpmLog = {};
    Object.keys(dailyCharsLog).forEach(key => {
        const mins = dailyMinsLog[key] || 0;
        dailyCpmLog[key] = mins > 0 ? Math.round(dailyCharsLog[key] / mins) : 0;
    });

    const dailyLookupRateLog = {};
    Object.keys(dailyCharsLog).forEach(key => {
        const chars = dailyCharsLog[key] || 0;
        const lookups = dailyLookupsLog[key] || 0;
        dailyLookupRateLog[key] = chars > 0 ? Number(((lookups / chars) * 100).toFixed(1)) : 0;
    });

    return {
        ...storyData,
        history: recalculatedHistory,
        avgCpm: count > 0 ? Math.round(totalCpm / count) : '--',
        dailyLog,
        dailyCharsLog,
        dailyCpmLog,
        dailyLookupRateLog,
    };
};

export const saveSession = async (storyId, durationMinutes, charsRead, cpm, lookups = 0, endPosition = 0) => {
    if (!storyId || durationMinutes < 3) return;
    if (!savedStats) await loadStats();

    if (!savedStats.storyStats) savedStats.storyStats = {};
    if (!savedStats.storyStats[storyId]) {
        savedStats.storyStats[storyId] = {
            totalTime: 0,
            totalChars: 0,
            history: []
        };
    }

    const stats = savedStats.storyStats[storyId];

    // Update totals
    stats.totalTime += durationMinutes;
    stats.totalChars += charsRead;
    stats.totalLookups = (stats.totalLookups || 0) + lookups;

    // Add to history
    stats.history.push({
        startTime: new Date().toISOString(), // when this session started (approx end - duration)
        date: new Date().toISOString(),
        duration: durationMinutes,
        chars: charsRead,
        cpm: cpm,
        lookups: lookups,
        endPosition: endPosition
    });

    // Persist
    await set(STATS_KEY, savedStats);

    // Dispatch stats update
    window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
};

export const resetStoryStats = async (storyId) => {
    if (!savedStats) await loadStats();
    if (savedStats.storyStats && savedStats.storyStats[storyId]) {
        savedStats.storyStats[storyId] = { totalTime: 0, totalChars: 0, totalLookups: 0, history: [] };
        await set(STATS_KEY, savedStats);
        window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
    }
};

export const deleteSession = async (storyId, sessionIndex) => {
    if (!savedStats) await loadStats();
    const storyData = savedStats.storyStats?.[storyId];
    if (!storyData || !storyData.history) return;

    const session = storyData.history[sessionIndex];
    if (!session) return;

    // Subtract from totals
    storyData.totalTime = Math.max(0, (storyData.totalTime || 0) - (session.duration || 0));
    storyData.totalChars = Math.max(0, (storyData.totalChars || 0) - (session.chars || 0));
    storyData.totalLookups = Math.max(0, (storyData.totalLookups || 0) - (session.lookups || 0));

    // Remove from history
    storyData.history.splice(sessionIndex, 1);

    await set(STATS_KEY, savedStats);
    window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
};

export const updateSession = async (storyId, sessionIndex, { duration, chars, lookups }) => {
    if (!savedStats) await loadStats();
    const storyData = savedStats.storyStats?.[storyId];
    if (!storyData || !storyData.history) return;

    const session = storyData.history[sessionIndex];
    if (!session) return;

    // Remove old values from totals
    storyData.totalTime = Math.max(0, (storyData.totalTime || 0) - (session.duration || 0));
    storyData.totalChars = Math.max(0, (storyData.totalChars || 0) - (session.chars || 0));
    storyData.totalLookups = Math.max(0, (storyData.totalLookups || 0) - (session.lookups || 0));

    // Update session object
    session.duration = Math.max(0, duration);
    session.chars = Math.max(0, chars);
    session.lookups = Math.max(0, lookups);
    session.cpm = session.duration > 0 ? Math.round(session.chars / session.duration) : 0;

    // Add new values to totals
    storyData.totalTime += session.duration;
    storyData.totalChars += session.chars;
    storyData.totalLookups += session.lookups;

    await set(STATS_KEY, savedStats);
    window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
};

export const getGlobalStats = async () => {
    if (!savedStats) await loadStats();

    const storyStats = savedStats.storyStats || {};

    let totalTime = 0;
    let totalChars = 0;
    let totalLookups = 0;
    let allSessions = [];
    let bestCpm = 0;
    const books = [];

    for (const [storyId, data] of Object.entries(storyStats)) {
        if (!data || !data.history) continue;

        // Filter out existing < 3 min sessions
        const sessions = (data.history || [])
            .filter(s => s.duration >= 3)
            .map(s => ({
                ...s,
                cpm: s.duration > 0 ? Math.round((s.chars || 0) / s.duration) : 0
            }));

        // Accumulate totals exclusively from valid sessions
        const bookTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const bookChars = sessions.reduce((sum, s) => sum + (s.chars || 0), 0);
        const bookLookups = sessions.reduce((sum, s) => sum + (s.lookups || 0), 0);

        totalTime += bookTime;
        totalChars += bookChars;
        totalLookups += bookLookups;

        allSessions = allSessions.concat(sessions.map(s => ({ ...s, storyId })));

        const validCpms = sessions.filter(s => s.cpm > 0).map(s => s.cpm);
        const bookBest = validCpms.length > 0 ? Math.max(...validCpms) : 0;
        const bookAvg = validCpms.length > 0 ? Math.round(validCpms.reduce((a, b) => a + b, 0) / validCpms.length) : 0;
        if (bookBest > bestCpm) bestCpm = bookBest;

        books.push({
            storyId,
            totalTime: bookTime,
            totalChars: bookChars,
            sessions: sessions.length,
            avgCpm: bookAvg,
            bestCpm: bookBest,
            lastSession: sessions.length > 0 ? sessions[sessions.length - 1].date : null,
        });
    }

    // Sort books by last session date (most recent first)
    books.sort((a, b) => new Date(b.lastSession || 0) - new Date(a.lastSession || 0));

    // (dailyLog previously tracked cached minutes per day, but could be out of sync.
    //  We'll use dailyMinsLog natively computed from allSessions below)
    // Daily chars log: sum chars per day from session history
    const dailyCharsLog = {};
    const dailyMinsLog = {}; // for CPM calculation
    allSessions.forEach(s => {
        if (!s.date) return;
        const key = localDateKey(new Date(s.date));
        if (s.chars) dailyCharsLog[key] = (dailyCharsLog[key] || 0) + (s.chars || 0);
        if (s.duration) dailyMinsLog[key] = (dailyMinsLog[key] || 0) + (s.duration || 0);
    });
    // Daily CPM = totalChars / totalMins for that day
    const dailyCpmLog = {};
    Object.keys(dailyCharsLog).forEach(key => {
        const mins = dailyMinsLog[key] || 0;
        dailyCpmLog[key] = mins > 0 ? Math.round(dailyCharsLog[key] / mins) : 0;
    });

    // Global avg CPM
    const validCpms = allSessions.filter(s => s.cpm > 0).map(s => s.cpm);
    const avgCpm = validCpms.length > 0 ? Math.round(validCpms.reduce((a, b) => a + b, 0) / validCpms.length) : 0;

    // Reading streak (consecutive days with any activity)
    const activeDays = new Set([
        ...Object.keys(dailyMinsLog).filter(d => dailyMinsLog[d] > 0),
        ...allSessions.map(s => new Date(s.date).toISOString().split('T')[0])
    ]);
    let streak = 0;
    const d = new Date();
    while (activeDays.has(d.toISOString().split('T')[0])) {
        streak++;
        d.setDate(d.getDate() - 1);
    }

    // Today's activity per book
    const todayKey = localDateKey();
    const todayByBook = {};
    for (const [storyId, data] of Object.entries(storyStats)) {
        if (!data || !data.history) continue;
        const todaySessions = data.history.filter(s => s.date && localDateKey(new Date(s.date)) === todayKey);
        if (todaySessions.length === 0) continue;
        const mins = todaySessions.reduce((a, s) => a + (s.duration || 0), 0);
        const chars = todaySessions.reduce((a, s) => a + (s.chars || 0), 0);
        const lookups = todaySessions.reduce((a, s) => a + (s.lookups || 0), 0);
        const cpm = mins > 0 ? Math.round(chars / mins) : 0;
        todayByBook[storyId] = { mins, chars, lookups, cpm, sessions: todaySessions.length };
    }

    return {
        totalTime,
        totalChars,
        totalLookups,
        totalSessions: allSessions.length,
        avgCpm,
        bestCpm,
        streak,
        dailyLog: dailyMinsLog, // exactly matches session history
        dailyCharsLog,
        dailyCpmLog,
        books: books.sort((a, b) => new Date(b.lastSession) - new Date(a.lastSession)),
        todayByBook,
        allSessions,
    };
};
