import { useState, useEffect } from 'react';

const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = String(hours % 12 || 12).padStart(2, '0');

    return `${year}.${month}.${day} ${ampm} ${displayHours}:${minutes}`;
  };

  return (
    <header className="bg-gray-100">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Title */}
          <div className="flex items-center">
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight text-gray-700"
              style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)' }}
            >
              기상데이터 제공 및 API 서비스
            </h1>
          </div>

          {/* Right side - Date/Time */}
          <div className="flex items-center">
            <span className="text-gray-500 font-medium text-sm sm:text-base">
              {formatDateTime(currentTime)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
