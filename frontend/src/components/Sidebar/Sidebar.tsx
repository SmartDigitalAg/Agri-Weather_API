import { useState } from 'react';
import type { DataCategory } from '../../types';

interface SidebarProps {
  selectedCategory: DataCategory;
  onCategoryChange: (category: DataCategory) => void;
}

const categories: { key: DataCategory; label: string }[] = [
  { key: 'current', label: '현재기상' },
  { key: 'past', label: '과거기상' },
  { key: 'forecast', label: '기상예보' },
  { key: 'api', label: 'API설명' },
];

const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="relative flex h-fit">
      {/* Sidebar */}
      <aside
        className={`bg-white rounded-xl shadow-lg transition-all duration-300 overflow-hidden h-fit ${
          isCollapsed ? 'w-0 opacity-0' : 'w-64 opacity-100'
        }`}
      >
        <div className="p-4">
          {/* Category Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">
              데이터 유형
            </h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.key}
                  onClick={() => onCategoryChange(category.key)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                    selectedCategory === category.key
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium">{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-2 bg-white shadow-lg rounded-lg p-2 hover:bg-gray-100 transition-all duration-300 z-10 ${
          isCollapsed ? 'left-0' : 'left-[248px]'
        }`}
      >
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
            isCollapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
};

export default Sidebar;
