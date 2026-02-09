import React, { useState } from 'react';
import type { WeatherData, DataSource } from '../../types';
import { downloadCSV, downloadExcel } from '../../services/api';
import { provinces, citiesByProvince, defaultCities } from '../../data/mockData';

interface DataQuerySectionProps {
  data: WeatherData[];
  isLoading: boolean;
  error: string | null;
  onSearch: (options: SearchOptions) => void;
}

interface SearchOptions {
  source: DataSource;
  province: string;
  city: string;
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
}

const DataQuerySection: React.FC<DataQuerySectionProps> = ({
  data,
  isLoading,
  error,
  onSearch,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    source: 'KMA',
    province: '',
    city: '',
    startYear: currentYear.toString(),
    startMonth: '1',
    startDay: '1',
    endYear: currentYear.toString(),
    endMonth: '12',
    endDay: '31',
  });

  const cities = searchOptions.province && citiesByProvince[searchOptions.province]
    ? citiesByProvince[searchOptions.province]
    : defaultCities;

  const handleOptionChange = (key: keyof SearchOptions, value: string) => {
    setSearchOptions((prev) => {
      const newOptions = { ...prev, [key]: value };
      if (key === 'province') {
        newOptions.city = '';
      }
      return newOptions;
    });
  };

  const handleSearch = () => {
    onSearch(searchOptions);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-full">
      {/* Search Options */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          과거기상 데이터 조회
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">출처</label>
            <select
              value={searchOptions.source}
              onChange={(e) => handleOptionChange('source', e.target.value as DataSource)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="KMA">기상청</option>
              <option value="RDA">농진청</option>
            </select>
          </div>

          {/* Province */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">시/도</label>
            <select
              value={searchOptions.province}
              onChange={(e) => handleOptionChange('province', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            >
              {provinces.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">시/군/구</label>
            <select
              value={searchOptions.city}
              onChange={(e) => handleOptionChange('city', e.target.value)}
              disabled={!searchOptions.province}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm disabled:bg-gray-100"
            >
              {cities.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 font-medium"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  조회 중...
                </span>
              ) : '조회'}
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">시작일</label>
            <div className="flex space-x-2">
              <select
                value={searchOptions.startYear}
                onChange={(e) => handleOptionChange('startYear', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={searchOptions.startMonth}
                onChange={(e) => handleOptionChange('startMonth', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                value={searchOptions.startDay}
                onChange={(e) => handleOptionChange('startDay', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">종료일</label>
            <div className="flex space-x-2">
              <select
                value={searchOptions.endYear}
                onChange={(e) => handleOptionChange('endYear', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={searchOptions.endMonth}
                onChange={(e) => handleOptionChange('endMonth', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                value={searchOptions.endDay}
                onChange={(e) => handleOptionChange('endDay', e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => downloadCSV(data)}
          disabled={data.length === 0}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV 다운로드
        </button>
        <button
          onClick={() => downloadExcel(data)}
          disabled={data.length === 0}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Excel 다운로드
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">기상데이터</h3>
          <span className="text-xs text-gray-500">총 {data.length}건</span>
        </div>
        <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">기온(°C)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">습도(%)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">강수량(mm)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">풍속(m/s)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">풍향</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">기압(hPa)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="ml-2 text-gray-600">데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    조회된 데이터가 없습니다. 조건을 선택하고 조회 버튼을 클릭해주세요.
                  </td>
                </tr>
              ) : (
                data.slice(0, 100).map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{row.time}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">{row.temperature}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">{row.humidity}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-blue-600">{row.rainfall}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">{row.windSpeed}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-gray-600">{row.windDirection}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">{row.pressure}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.length > 100 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            최대 100건까지 표시됩니다. 전체 데이터는 다운로드해주세요.
          </p>
        )}
      </div>
    </div>
  );
};

export default DataQuerySection;
