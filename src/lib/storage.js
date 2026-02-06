import { get, set, update } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

const STORIES_KEY = 'stories';
const SETTINGS_KEY = 'settings';
const BOOKMARKS_KEY = 'bookmarks';

export const saveStory = async (title, content) => {
  const newStory = {
    id: uuidv4(),
    title,
    content,
    createdAt: Date.now(),
    progress: 0, // Character index
  };

  await update(STORIES_KEY, (stories = []) => {
    return [newStory, ...stories];
  });

  return newStory;
};

export const getStories = async () => {
  return (await get(STORIES_KEY)) || [];
};

export const deleteStory = async (id) => {
  await update(STORIES_KEY, (stories = []) => {
    return stories.filter(story => story.id !== id);
  });
};

export const updateStoryProgress = async (id, progress) => {
  await update(STORIES_KEY, (stories = []) => {
    return stories.map(story =>
      story.id === id ? { ...story, progress } : story
    );
  });
};

export const saveBookmark = async (storyId, scrollPosition) => {
  await update(BOOKMARKS_KEY, (bookmarks = {}) => {
    return { ...bookmarks, [storyId]: { scrollPosition, lastRead: Date.now() } };
  });
};

export const getBookmark = async (storyId) => {
  const bookmarks = await get(BOOKMARKS_KEY);
  return bookmarks ? bookmarks[storyId] : null;
};

export const getSettings = async () => {
  return (await get(SETTINGS_KEY)) || {
    theme: 'light',
    fontSize: 18,
  };
};

export const saveSettings = async (settings) => {
  await set(SETTINGS_KEY, settings);
};
