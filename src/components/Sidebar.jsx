import React, { useState, useEffect, useRef } from 'react';
import { getStories, saveStory, deleteStory, setStoryRead } from '../lib/storage';
import { Link } from 'react-router-dom';

const Sidebar = ({ onSelectStory, currentStoryId, onViewStats, onViewGlobalStats }) => {
    const [stories, setStories] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const titleRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        loadStories();
    }, []);

    const loadStories = async () => {
        const list = await getStories();
        // Sort by recent first
        setStories(list.sort((a, b) => b.createdAt - a.createdAt));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const title = titleRef.current?.value || '';
        const content = contentRef.current?.value || '';

        if (!title.trim() || !content.trim()) return;

        const story = await saveStory(title, content);
        setStories([story, ...stories]);
        setIsAdding(false);
        onSelectStory(story);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Auto-fill title from filename
        let title = file.name;
        if (title.endsWith('.txt')) {
            title = title.slice(0, -4);
        }
        if (titleRef.current) titleRef.current.value = title;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            if (contentRef.current) {
                contentRef.current.value = text;
            }
        };
        reader.readAsText(file);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (confirm('Delete this story?')) {
            await deleteStory(id);
            setStories(stories.filter(s => s.id !== id));
            if (currentStoryId === id) {
                onSelectStory(null);
            }
        }
    };

    const handleToggleRead = async (story, e) => {
        e.stopPropagation();
        const newVal = !story.isRead;
        await setStoryRead(story.id, newVal);
        setStories(stories.map(s => s.id === story.id ? { ...s, isRead: newVal } : s));
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Library</h2>
                <button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? 'Cancel' : '+ New'}
                </button>
            </div>

            {isAdding && (
                <form className="add-story-form" onSubmit={handleCreate}>
                    <input
                        type="text"
                        placeholder="Title"
                        ref={titleRef}
                        className="input-field"
                        autoFocus
                    />
                    <textarea
                        placeholder="Paste Chinese text here (handles 100k+ chars natively)..."
                        ref={contentRef}
                        className="input-textarea"
                    />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Or select a .txt file:</span>
                        <input
                            type="file"
                            accept=".txt"
                            onChange={handleFileUpload}
                            style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                        />
                    </div>
                    <button type="submit" className="btn-block">Save Story</button>
                </form>
            )}

            <div className="story-list">
                {stories.map(story => (
                    <div
                        key={story.id}
                        className={`story-item ${story.id === currentStoryId ? 'active' : ''} ${story.isRead ? 'story-read' : ''}`}
                        onClick={() => onSelectStory(story)}
                    >
                        <div className="story-title">
                            {story.title}
                            {story.isRead && <span className="story-read-badge">READ</span>}
                        </div>
                        <div className="story-meta">
                            {new Date(story.createdAt).toLocaleDateString()}
                            <div className="story-actions">
                                <button
                                    className={`icon-btn read-toggle-btn ${story.isRead ? 'read-toggle-active' : ''}`}
                                    onClick={(e) => handleToggleRead(story, e)}
                                    title={story.isRead ? 'Mark as unread' : 'Mark as read (stops stats tracking)'}
                                >
                                    ✓
                                </button>
                                <button
                                    className="icon-btn stats-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewStats && onViewStats(story);
                                    }}
                                    title="View Stats & History"
                                >
                                    📊
                                </button>
                                <button
                                    className="delete-btn"
                                    onClick={(e) => handleDelete(story.id, e)}
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {stories.length === 0 && !isAdding && (
                    <div className="empty-state">No stories yet. Click + New to add one.</div>
                )}
            </div>

            <div className="sidebar-footer">
                <Link to="/vocabulary" className="sidebar-footer-link">
                    View Vocabulary Stats →
                </Link>
                <button className="sidebar-footer-link sidebar-footer-btn" onClick={onViewGlobalStats}>
                    Reading Stats →
                </button>
            </div>

        </div>
    );
};

export default Sidebar;
