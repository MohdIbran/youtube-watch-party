/**
 * Extracts an 11-character YouTube video ID from various URL formats or raw ID.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - Raw 11-character ID
 * 
 * @param {string} input 
 * @returns {string|null}
 */
export const extractYouTubeId = (input) => {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Direct 11-character ID
  const directIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (directIdRegex.test(trimmed)) {
    return trimmed;
  }

  // From YouTube URLs
  const urlRegex = /(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(urlRegex);

  if (match && match[1] && directIdRegex.test(match[1])) {
    return match[1];
  }

  return null;
};

/**
 * Formats seconds into MM:SS or HH:MM:SS
 * @param {number} totalSeconds 
 * @returns {string}
 */
export const formatTime = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};
