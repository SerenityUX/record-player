// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import FormData from 'form-data';
import axios from 'axios';

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
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Upload to freeimage.host (server-side, no CORS issues)
      const formData = new FormData();
      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
      formData.append('action', 'upload');
      formData.append('source', imageBase64);
      formData.append('format', 'json');

      const imageHostResponse = await axios.post('https://freeimage.host/api/1/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      const imageHostData = imageHostResponse.data;

      if (!imageHostData.success) {
        return res.status(500).json({ 
          error: 'Failed to upload image to freeimage.host',
          details: imageHostData 
        });
      }

      const imageUrl = imageHostData.image.url;

      // Return the image URL
      res.status(200).json({ imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

