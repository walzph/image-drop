import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import ImageDropPage from './components/ImageDropPage';

function App() {
  return (
    <div className="container">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:dropPath" element={<ImageDropPage />} />
      </Routes>
    </div>
  );
}

export default App;