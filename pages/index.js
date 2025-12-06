import React, { useState, useEffect, useRef } from 'react';

export default function Home() {
  // Commented out existing state and logic
  // const [uploading, setUploading] = useState(false);
  // const [result, setResult] = useState(null);
  // const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [frozenImage, setFrozenImage] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  // Set body and html margin to 0
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    const startCamera = async () => {
      try {
        // Request camera access with preference for back camera (environment)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment' // Back camera (rear-facing)
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Failed to access camera. Please allow camera permissions.');
        
        // Fallback: try any available camera if back camera fails
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
        } catch (fallbackErr) {
          console.error('Fallback camera access failed:', fallbackErr);
        }
      }
    };

    startCamera();

    // Cleanup: stop camera when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const captureFrame = async () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      // Create a canvas to capture the frame
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL and freeze
      const imageDataUrl = canvas.toDataURL('image/png');
      setFrozenImage(imageDataUrl);
      setResult(null);
      setError(null);
      
      // Extract base64 from data URL
      const base64 = imageDataUrl.split(',')[1];
      
      try {
        // Step 1: Upload image
        setStatus('Uploading Image');
        const uploadResponse = await fetch('/api/uploadImage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        
        if (!uploadData.imageUrl) {
          throw new Error('No image URL returned from upload');
        }

        // Step 2: Get album and search YouTube
        setStatus('Searching For Song');
        const apiResponse = await fetch('/api/getAlbum', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: uploadData.imageUrl }),
        });

        if (!apiResponse.ok) {
          throw new Error('Failed to get album name');
        }

        const apiData = await apiResponse.json();
        setResult(apiData);
        setStatus(null);
      } catch (err) {
        setError(err.message);
        setStatus(null);
      }
    }
  };

  const handleTap = () => {
    if (frozenImage) {
      // If frozen (whether processing or not), clear everything and go back to initial state
      setFrozenImage(null);
      setResult(null);
      setError(null);
      setStatus(null);
      
      // Ensure video plays when clearing frozen image
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
        });
      }
    } else if (!frozenImage) {
      // Capture and freeze, then process
      captureFrame();
    }
  };

  // Commented out existing file upload handler
  // const handleFileUpload = async (event) => {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   setUploading(true);
  //   setError(null);
  //   setResult(null);

  //   try {
  //     // Convert file to base64
  //     const reader = new FileReader();
  //     const base64 = await new Promise((resolve, reject) => {
  //       reader.onload = () => {
  //         const base64String = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
  //         resolve(base64String);
  //       };
  //       reader.onerror = reject;
  //       reader.readAsDataURL(file);
  //     });

  //     // First, upload the image to get the URL
  //     const uploadResponse = await fetch('/api/uploadImage', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ imageBase64: base64 }),
  //     });

  //     if (!uploadResponse.ok) {
  //       throw new Error('Failed to upload image');
  //     }

  //     const uploadData = await uploadResponse.json();
      
  //     if (!uploadData.imageUrl) {
  //       throw new Error('No image URL returned from upload');
  //     }

  //     // Now send only the URL to getAlbum
  //     const apiResponse = await fetch('/api/getAlbum', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ imageUrl: uploadData.imageUrl }),
  //     });

  //     if (!apiResponse.ok) {
  //       throw new Error('Failed to get album name');
  //     }

  //     const apiData = await apiResponse.json();
  //     setResult(apiData);
  //   } catch (err) {
  //     setError(err.message);
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  return (
    <div 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
        cursor: 'pointer'
      }}
      onClick={handleTap}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleTap();
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          display: frozenImage ? 'none' : 'block'
        }}
      />
      {frozenImage && (
        <>
          <img
            src={frozenImage}
            alt="Frozen frame"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100vw',
              height: result?.youtubeUrl ? 'calc(100vh - 300px)' : '100vh',
              objectFit: 'cover',
              display: 'block',
              zIndex: 1
            }}
          />
          {result?.youtubeUrl && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '300px',
              backgroundColor: '#000',
              zIndex: 2
            }}>
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '20px 20px 0 0',
                overflow: 'hidden'
              }}>
                <iframe
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0
                  }}
                  src={`${result.youtubeUrl}${result.youtubeUrl.includes('?') ? '&' : '?'}autoplay=1`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </>
      )}
      {status && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '16px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {status}
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'red',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 20px',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          {error}
        </div>
      )}
      
      {/* Commented out existing UI */}
      {/* <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Upload Image</h1>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ marginBottom: '20px' }}
        />
        
        {uploading && <p>Uploading and analyzing image...</p>}
        
        {error && (
          <div style={{ color: 'red', marginTop: '10px' }}>
            Error: {error}
          </div>
        )}
        
        {result && (
          <div style={{ marginTop: '20px' }}>
            <h2>Album Name:</h2>
            {result.albumName ? (
              <>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: '#333',
                  marginTop: '10px',
                  padding: '15px',
                  background: '#f0f0f0',
                  borderRadius: '4px'
                }}>
                  {result.albumName}
                </div>
                {result.youtubeUrl && (
                  <div style={{ marginTop: '20px' }}>
                    <h3>YouTube:</h3>
                    <div style={{ 
                      position: 'relative', 
                      paddingBottom: '56.25%', 
                      height: 0, 
                      overflow: 'hidden',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      marginTop: '10px'
                    }}>
                      <iframe
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 0
                        }}
                        src={`${result.youtubeUrl}${result.youtubeUrl.includes('?') ? '&' : '?'}autoplay=1`}
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </>
            ) : result.albumName === null ? (
              <div style={{ 
                fontSize: '18px', 
                color: '#666',
                marginTop: '10px',
                padding: '15px',
                background: '#f5f5f5',
                borderRadius: '4px',
                fontStyle: 'italic'
              }}>
                No album name found in the image
              </div>
            ) : (
              <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div> */}
    </div>
  );
}
