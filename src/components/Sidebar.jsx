import React, { useState, useEffect } from 'react';
import { getStories, saveStory, deleteStory } from '../lib/storage';
import { Link } from 'react-router-dom';

const Sidebar = ({ onSelectStory, currentStoryId }) => {
    const [stories, setStories] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');

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
        if (!newTitle.trim() || !newContent.trim()) return;

        const story = await saveStory(newTitle, newContent);
        setStories([story, ...stories]);
        setIsAdding(false);
        setNewTitle('');
        setNewContent('');
        onSelectStory(story);
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
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="input-field"
                        autoFocus
                    />
                    <textarea
                        placeholder="Paste Chinese text here..."
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        className="input-textarea"
                    />
                    <button type="submit" className="btn-block">Save Story</button>
                </form>
            )}

            <div className="story-list">
                {stories.map(story => (
                    <div
                        key={story.id}
                        className={`story-item ${story.id === currentStoryId ? 'active' : ''}`}
                        onClick={() => onSelectStory(story)}
                    >
                        <div className="story-title">{story.title}</div>
                        <div className="story-meta">
                            {new Date(story.createdAt).toLocaleDateString()}
                            <button
                                className="delete-btn"
                                onClick={(e) => handleDelete(story.id, e)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
                {stories.length === 0 && !isAdding && (
                    <div className="empty-state">No stories yet. Click + New to add one.</div>
                )}
            </div>

            <div className="sidebar-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <Link to="/vocabulary" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                    View Vocabulary Stats →
                </Link>
            </div>
        </div>
    );
};

export default Sidebar;
