import React from 'react';

function HomePage() {
  return (
    <div className="glass-container">
      <h1>🖼️ Image Drop App</h1>
      <p style={{ fontSize: '18px', lineHeight: '1.6', margin: '20px 0' }}>
        Welcome to the Image Drop App! This application allows you to create simple, beautiful image upload experiences.
      </p>
      <p style={{ fontSize: '18px', lineHeight: '1.6', margin: '20px 0' }}>
        Each image drop is configured with a unique URL path, custom background, and dedicated storage location.
      </p>
      <p style={{ fontSize: '18px', lineHeight: '1.6', margin: '20px 0' }}>
        To access an image drop, navigate to <strong>/&lt;drop-path&gt;</strong> where &lt;drop-path&gt; is the configured path for your image drop.
      </p>
    </div>
  );
}

export default HomePage;