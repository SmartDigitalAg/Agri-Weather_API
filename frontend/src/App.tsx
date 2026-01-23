import { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CurrentWeather from './pages/CurrentWeather';
import PastWeather from './pages/PastWeather';
import WeatherForecast from './pages/WeatherForecast';
import type { DataCategory } from './types';

function App() {
  // State for sidebar selections
  const [selectedCategory, setSelectedCategory] = useState<DataCategory>('current');

  // Render page based on selected category
  const renderPage = () => {
    switch (selectedCategory) {
      case 'current':
        return <CurrentWeather />;
      case 'past':
        return <PastWeather />;
      case 'forecast':
        return <WeatherForecast />;
      case 'api':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">
            API 설명 페이지 (준비중)
          </div>
        );
      default:
        return <CurrentWeather />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-4 lg:p-6 gap-4 lg:gap-6">
        {/* Sidebar */}
        <Sidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        {/* Main Area */}
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
