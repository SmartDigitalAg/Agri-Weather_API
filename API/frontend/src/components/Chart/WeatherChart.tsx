import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';
import type { WeatherVariable } from '../../types';
import { weatherVariables } from '../../data/mockData';

interface ChartData {
  name: string;
  date?: string;
  temperature?: number;
  maxTemp?: number;
  minTemp?: number;
  humidity?: number;
  rainfall?: number;
  windSpeed?: number;
}

interface WeatherChartProps {
  data: ChartData[];
  selectedVariables: WeatherVariable[];
  chartType?: 'line' | 'bar' | 'composed';
}

const WeatherChart: React.FC<WeatherChartProps> = ({
  data,
  selectedVariables,
  chartType = 'composed',
}) => {
  const getVariableConfig = (key: WeatherVariable) => {
    return weatherVariables.find((v) => v.key === key);
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { color: string; name: string; value: number; unit: string }[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
          <p className="font-medium text-gray-800 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 h-full flex items-center justify-center">
        <p className="text-gray-500">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        기상 데이터 그래프
      </h2>

      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'composed' ? (
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                label={{ value: '기온 (°C)', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                label={{ value: '강수량 (mm)', angle: 90, position: 'insideRight', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Temperature range area */}
              {selectedVariables.includes('temperature') && data[0]?.maxTemp !== undefined && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="maxTemp"
                  fill="#fecaca"
                  stroke="transparent"
                  name="최고기온"
                />
              )}

              {/* Rainfall bars */}
              {selectedVariables.includes('rainfall') && (
                <Bar
                  yAxisId="right"
                  dataKey="rainfall"
                  fill="#06b6d4"
                  name="강수량"
                  barSize={20}
                  radius={[4, 4, 0, 0]}
                />
              )}

              {/* Temperature line */}
              {selectedVariables.includes('temperature') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                  name="평균기온"
                />
              )}

              {/* Humidity line */}
              {selectedVariables.includes('humidity') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="습도"
                />
              )}

              {/* Wind speed line */}
              {selectedVariables.includes('windSpeed') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="windSpeed"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                  name="풍속"
                />
              )}
            </ComposedChart>
          ) : chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {selectedVariables.map((variable) => {
                const config = getVariableConfig(variable);
                return config ? (
                  <Line
                    key={variable}
                    type="monotone"
                    dataKey={variable}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ fill: config.color, r: 4 }}
                    name={config.label}
                  />
                ) : null;
              })}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {selectedVariables.map((variable) => {
                const config = getVariableConfig(variable);
                return config ? (
                  <Bar
                    key={variable}
                    dataKey={variable}
                    fill={config.color}
                    name={config.label}
                    radius={[4, 4, 0, 0]}
                  />
                ) : null;
              })}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Selected variables badges */}
      <div className="mt-4 flex flex-wrap gap-2">
        {selectedVariables.map((variable) => {
          const config = getVariableConfig(variable);
          return config ? (
            <span
              key={variable}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${config.color}20`,
                color: config.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: config.color }}
              />
              {config.label} ({config.unit})
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
};

export default WeatherChart;
