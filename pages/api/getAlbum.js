// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import ytsr from 'ytsr';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { imageUrl } = req.body;

      console.log('=== getAlbum API called ===');
      console.log('Received imageUrl:', imageUrl);

      if (!imageUrl) {
        return res.status(400).json({ error: 'No image URL provided' });
      }

      // Check for Claude API key
      const claudeKey = process.env.claudeKey;
      if (!claudeKey) {
        return res.status(500).json({ error: 'Claude API key is not configured' });
      }
      console.log('Claude API key found:', claudeKey ? 'Yes' : 'No');

      // Prepare the request body with image URL
      const requestBody = {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: 'You are given an album cover. From this album cover alone, you need to identify the name of the album, the artist, and the first song on the album. Reply with nothing but the format: "{Song Name}, {Album}, by {Artist}". If you cannot identify all three pieces of information from the cover, reply with exactly: NULL',
              },
            ],
          },
        ],
      };

      console.log('=== Sending to Claude API ===');
      console.log('Using image source type: url');
      console.log('Model:', requestBody.model);
      console.log('Image URL:', imageUrl);
      console.log('Image source:', JSON.stringify({ type: 'url', url: imageUrl }, null, 2));
      console.log('Prompt text:', requestBody.messages[0].content[1].text);

      // Call Claude API to identify the album
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Claude API response status:', claudeResponse.status, claudeResponse.statusText);

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text();
        console.error('Claude API error:', errorText);
        return res.status(claudeResponse.status).json({ 
          error: 'Failed to get album name from Claude API',
          details: errorText.substring(0, 500)
        });
      }

      const claudeData = await claudeResponse.json();
      console.log('=== Claude API Response ===');
      console.log('Full response:', JSON.stringify(claudeData, null, 2));
      
      // Extract the response from Claude
      let response = claudeData.content?.[0]?.text?.trim() || null;
      console.log('Extracted response (raw):', response);
      
      // If the response is "NULL" (case-insensitive), set it to null
      if (response && response.toUpperCase() === 'NULL') {
        response = null;
        console.log('Converted "NULL" to null');
      }

      // Parse the response format: "{Song Name}, {Album}, by {Artist}"
      let songName = null;
      let albumName = null;
      let artistName = null;
      
      if (response) {
        // Try to parse the format: "Song Name, Album, by Artist"
        const match = response.match(/^"?(.+?),\s*(.+?),\s*by\s*(.+?)"?$/);
        if (match) {
          songName = match[1].trim();
          albumName = match[2].trim();
          artistName = match[3].trim();
          console.log('Parsed - Song:', songName, 'Album:', albumName, 'Artist:', artistName);
        } else {
          // If format doesn't match, use the whole response as album name (fallback)
          albumName = response;
          console.log('Could not parse format, using full response as album name');
        }
      }

      console.log('Final response:', response);
      
      // If we have a song name, search YouTube (prefer song name, fallback to album name)
      let youtubeUrl = null;
      const searchQuery = songName || albumName;
      if (searchQuery) {
        try {
          const youtubeSearchQuery = `${searchQuery} album`;
          console.log('Searching YouTube for:', youtubeSearchQuery);
          const searchResults = await ytsr(youtubeSearchQuery, { limit: 1 });
          
          if (searchResults.items && searchResults.items.length > 0) {
            const firstVideo = searchResults.items.find(item => item.type === 'video');
            if (firstVideo && firstVideo.url) {
              // Extract video ID from URL and convert to embed format
              const url = firstVideo.url;
              let videoId = null;
              
              // Handle different YouTube URL formats
              if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('watch?v=')[1].split('&')[0];
              } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
              } else if (url.includes('youtube.com/embed/')) {
                videoId = url.split('embed/')[1].split('?')[0];
              }
              
              if (videoId) {
                youtubeUrl = `https://www.youtube.com/embed/${videoId}`;
                console.log('Found YouTube URL:', firstVideo.url);
                console.log('Converted to embed URL:', youtubeUrl);
              } else {
                youtubeUrl = firstVideo.url;
                console.log('Using original YouTube URL:', youtubeUrl);
              }
            }
          }
        } catch (youtubeError) {
          console.error('Error searching YouTube:', youtubeError);
          // Continue even if YouTube search fails
        }
      }

      console.log('=== End getAlbum ===');

      // Return the song name, album name, artist, and YouTube URL (or null if not found)
      res.status(200).json({ 
        songName,
        albumName,
        artistName,
        youtubeUrl 
      });
    } catch (error) {
      console.error('Error in getAlbum:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

