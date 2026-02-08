import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import '../styles/oled.css';

const LibraryModal = ({ isOpen, onClose, onSelectStory, currentStoryId }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <div className="library-modal-backdrop" onClick={onClose} />
            <div className="library-modal">
                <button className="library-modal-close" onClick={onClose}>✕</button>
                <Sidebar
                    onSelectStory={(story) => {
                        onSelectStory(story);
                        onClose();
                    }}
                    currentStoryId={currentStoryId}
                />
            </div>
        </>
    );
};

export default LibraryModal;
