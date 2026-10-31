/**
 * Validates and extracts an 11-character YouTube video ID.
 * Supports raw 11-character IDs or various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * 
 * @param {string} input - YouTube URL or video ID
 * @returns {string|null} - The extracted valid 11-char video ID, or null if invalid
 */
const extractYouTubeVideoId = (input) => {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // If already a valid 11-character YouTube video ID
  const directIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (directIdRegex.test(trimmed)) {
    return trimmed;
  }

  // Extract from URLs
  const urlRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(urlRegex);

  if (match && match[1] && directIdRegex.test(match[1])) {
    return match[1];
  }

  return null;
};

/**
 * Checks whether an input contains a valid YouTube video ID or URL.
 * @param {string} input 
 * @returns {boolean}
 */
const isValidYouTubeVideoId = (input) => {
  return extractYouTubeVideoId(input) !== null;
};

module.exports = {
  extractYouTubeVideoId,
  isValidYouTubeVideoId,
};
