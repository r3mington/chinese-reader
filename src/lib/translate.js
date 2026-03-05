export const translateParagraph = async (text) => {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Google Translate API returns an array where the first element 
        // is an array of sentence translations. We need to join them.
        let translatedText = '';
        if (data && data[0] && Array.isArray(data[0])) {
            data[0].forEach(item => {
                if (item[0]) {
                    translatedText += item[0];
                }
            });
        }

        translatedText = translatedText.trim();

        // If Google Translate fails silently by echoing the input text exactly,
        // use a secondary translation API as a fallback.
        if (translatedText === text.trim()) {
            console.warn("Google Translate echoed the source text. Falling back to MyMemory API...");

            const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|en`;
            const fallbackResponse = await fetch(fallbackUrl);
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData?.responseData?.translatedText) {
                    return fallbackData.responseData.translatedText;
                }
            }
        }

        return translatedText || 'Translation unavailable.';
    } catch (error) {
        console.error("Translation API error:", error);
        return "Failed to fetch translation. Check your network connection.";
    }
};
