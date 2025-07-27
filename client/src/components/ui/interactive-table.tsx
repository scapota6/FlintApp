import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface InteractiveTableProps {
  data: any[];
  columns: Column[];
  className?: string;
  onRowClick?: (row: any) => void;
  hoverable?: boolean;
}

export function InteractiveTable({
  data,
  columns,
  className = "",
  onRowClick,
  hoverable = true
}: InteractiveTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0;

    const { key, direction } = sortConfig;
    const aValue = a[key];
    const bValue = b[key];

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-3 w-3 text-purple-400" />
      : <ChevronDown className="h-3 w-3 text-purple-400" />;
  };

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-700 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider
                    ${column.sortable 
                      ? 'cursor-pointer hover:bg-gray-700/50 transition-colors duration-200 select-none' 
                      : ''
                    }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-900/30 divide-y divide-gray-700">
            {sortedData.map((row, index) => (
              <tr
                key={index}
                className={`transition-all duration-200 ${
                  hoverable 
                    ? 'hover:bg-gray-800/50 hover:shadow-sm cursor-pointer transform hover:scale-[1.01]' 
                    : ''
                } ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm text-gray-300">
                    <div className="transition-all duration-200 hover:text-white">
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="animate-pulse">
            <div className="h-8 w-8 bg-gray-600 rounded-full mx-auto mb-4"></div>
            <p>No data available</p>
          </div>
        </div>
      )}
    </div>
  );
}