import React, { useState, useEffect } from 'react';
import { getProperNames, addProperName, removeProperName } from '../lib/names';
import '../styles/oled.css';

const SettingsPage = ({ onClose }) => {
    const [names, setNames] = useState([]);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        loadNames();
    }, []);

    const loadNames = async () => {
        const list = await getProperNames();
        setNames(list);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        const trimmed = newName.trim();
        if (trimmed) {
            await addProperName(trimmed);
            setNewName('');
            loadNames();
        }
    };

    const handleRemove = async (word) => {
        await removeProperName(word);
        loadNames();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflowY: 'auto', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '600px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                    <button 
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Back to Reader
                    </button>
                    <h1 style={{ marginLeft: 'auto', fontSize: '20px', fontWeight: 'normal', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-blue)', margin: '0 0 0 auto' }}>Settings</h1>
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Proper Names Tagging</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                        Add character names, places, or custom multi-character words here. They will automatically be highlighted in purple during reading, overriding the default dictionary slicing.
                    </p>

                    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. 王子凯"
                            style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }}
                        />
                        <button type="submit" style={{ padding: '0 24px', borderRadius: '8px', background: 'var(--accent-blue)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                            Add
                        </button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {names.length === 0 && (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                No custom names tracked yet.
                            </div>
                        )}
                        {names.map(name => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '18px', color: '#bb86fc', fontWeight: '500' }}>{name}</span>
                                <button 
                                    onClick={() => handleRemove(name)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                                    title="Remove name"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default SettingsPage;
