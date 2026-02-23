import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/oled.css';

/**
 * Renders a slow-breathing, watermark-style list of recently looked up words
 * in the background of the Reader component.
 */
const RecentLookups = ({ words = [] }) => {
    // We only want to show the last 5-6 words so it doesn't get cluttered.
    // The newest words are at the beginning of the array if shifted, or end if pushed.
    // Assuming `words` is ordered [oldest, ..., newest]
    const displayWords = words.slice(-5);

    return (
        <div className="recent-lookups-container">
            <AnimatePresence mode="popLayout">
                {displayWords.map((word, i) => (
                    <motion.div
                        key={word + i} // Combining word and index just in case of duplicates
                        className="recent-lookup-watermark"

                        // 1. Entry Animation: Scale up from 0.8, fade in to low opacity
                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                        animate={{
                            opacity: 0.03,
                            scale: 1,
                            x: 0,
                            // 2. Passive Breathing Animation overlay (runs forever)
                            transition: {
                                // For the initial entry:
                                duration: 0.8,
                                ease: "easeOut",
                            }
                        }}

                        // 3. Exit Animation: Smoothly fade and shrink away
                        exit={{ opacity: 0, scale: 0.6, x: -20, transition: { duration: 0.8 } }}

                        // Frame-motion layout prop automatically animates the shifting 
                        // of the other elements when one enters/exits!
                        layout
                    >
                        {/* We add a secondary motion div just for the continuous breathing 
                            so it doesn't conflict with the layout/entry animations */}
                        <motion.span
                            animate={{
                                scale: [1, 1.05, 1],
                                y: [0, -8, 0],
                            }}
                            transition={{
                                duration: 8 + (Math.random() * 4), // 8-12 seconds per breath
                                repeat: Infinity,
                                ease: "easeInOut",
                                // Offset the start time randomly so they don't breathe in sync
                                delay: Math.random() * 2
                            }}
                            style={{ display: 'inline-block' }}
                        >
                            {word}
                        </motion.span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default RecentLookups;
