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
                text: 'What is the album name in this image? If you can see an album name and creator/artist, reply with nothing but the format: "Album Name by Creator". If you can only see the album name without creator, reply with just the album name. If there is no album name visible in the image, reply with exactly: NULL',
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
      
      // Extract the album name from Claude's response
      let albumName = claudeData.content?.[0]?.text?.trim() || null;
      console.log('Extracted albumName (raw):', albumName);
      
      // If the response is "NULL" (case-insensitive), set it to null
      if (albumName && albumName.toUpperCase() === 'NULL') {
        albumName = null;
        console.log('Converted "NULL" to null');
      }

      console.log('Final albumName:', albumName);
      
      // If we have an album name, search YouTube
      let youtubeUrl = null;
      if (albumName) {
        try {
          console.log('Searching YouTube for:', albumName);
          const searchResults = await ytsr(albumName, { limit: 1 });
          
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

      // Return the album name and YouTube URL (or null if not found)
      res.status(200).json({ albumName, youtubeUrl });
    } catch (error) {
      console.error('Error in getAlbum:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

