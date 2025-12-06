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

      // Check for Google API key
      const googleKey = process.env.googleKey;
      if (!googleKey) {
        return res.status(500).json({ error: 'Google API key is not configured' });
      }
      console.log('Google API key found:', googleKey ? 'Yes' : 'No');

      // Fetch the image and convert to base64 for Gemini
      let imageBase64 = null;
      let mimeType = 'image/jpeg';
      
      try {
        console.log('Fetching image from URL:', imageUrl);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        imageBase64 = Buffer.from(imageBuffer).toString('base64');
        
        // Determine mime type
        const contentType = imageResponse.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          mimeType = contentType;
        } else if (imageUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
          const ext = imageUrl.match(/\.(\w+)$/i)?.[1]?.toLowerCase();
          if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'gif') mimeType = 'image/gif';
          else if (ext === 'webp') mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
        }
        console.log('Image converted to base64, mimeType:', mimeType);
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError);
        return res.status(500).json({ 
          error: 'Failed to fetch image from URL',
          details: fetchError.message
        });
      }

      // Prepare the request body for Gemini API
      const requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: 'You are given an album cover. From this album cover alone, you need to identify the name of the album, the artist, and the first song on the album. Reply with nothing but the format: "{Song Name}, {Album}, by {Artist}". If you cannot identify all three pieces of information from the cover, reply with exactly: NULL',
              },
            ],
          },
        ],
      };

      console.log('=== Sending to Gemini API ===');
      console.log('Model: gemini-2.5-flash');
      console.log('Image URL:', imageUrl);
      console.log('Mime type:', mimeType);
      console.log('Prompt text:', requestBody.contents[0].parts[1].text);

      // Call Gemini API to identify the album
      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'x-goog-api-key': googleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Gemini API response status:', geminiResponse.status, geminiResponse.statusText);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error:', errorText);
        return res.status(geminiResponse.status).json({ 
          error: 'Failed to get album name from Gemini API',
          details: errorText.substring(0, 500)
        });
      }

      const geminiData = await geminiResponse.json();
      console.log('=== Gemini API Response ===');
      console.log('Full response:', JSON.stringify(geminiData, null, 2));
      
      // Extract the response from Gemini
      let response = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
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

