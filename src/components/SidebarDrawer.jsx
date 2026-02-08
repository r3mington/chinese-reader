import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import '../styles/oled.css';

const SidebarDrawer = ({ isOpen, onClose, onSelectStory, currentStoryId }) => {
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

    return (
        <>
            {isOpen && <div className="drawer-backdrop" onClick={onClose} />}
            <div className={`drawer ${isOpen ? 'open' : ''}`}>
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

export default SidebarDrawer;
