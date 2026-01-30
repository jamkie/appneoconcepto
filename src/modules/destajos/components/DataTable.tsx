import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { usePagination } from '../hooks/usePagination';
import { TablePagination } from './TablePagination';

interface Column<T> {
  key: string;
  header: string | (() => React.ReactNode);
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  sortKey?: string;
  getValue?: (item: T) => string | number | Date | null | undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyState?: React.ReactNode;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  pageSize?: number;
  showPagination?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  className,
  emptyState,
  defaultSortKey,
  defaultSortDirection = 'asc',
  pageSize: initialPageSize = 10,
  showPagination = true,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    const column = columns.find(col => col.sortKey === sortColumn);
    if (!column || !column.getValue) return data;

    return [...data].sort((a, b) => {
      const aValue = column.getValue!(a);
      const bValue = column.getValue!(b);

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' });
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const pagination = usePagination(sortedData, { initialPageSize });

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortKey) return null;
    
    if (sortColumn === column.sortKey) {
      return sortDirection === 'asc' 
        ? <ArrowUp className="w-3 h-3 ml-1" />
        : <ArrowDown className="w-3 h-3 ml-1" />;
    }
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  };

  const displayData = showPagination ? pagination.paginatedData : sortedData;

  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "font-semibold text-foreground whitespace-nowrap",
                    column.className,
                    column.hideOnMobile && "hidden md:table-cell",
                    column.sortKey && "cursor-pointer hover:bg-muted/80 select-none"
                  )}
                  onClick={column.sortKey ? () => handleSort(column.sortKey!) : undefined}
                >
                  <div className="flex items-center">
                    {typeof column.header === 'function' ? column.header() : column.header}
                    {renderSortIcon(column)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "border-border",
                  onRowClick && "cursor-pointer hover:bg-muted/50"
                )}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.className,
                      column.hideOnMobile && "hidden md:table-cell"
                    )}
                  >
                    {column.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {showPagination && data.length > 0 && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          canGoNext={pagination.canGoNext}
          canGoPrevious={pagination.canGoPrevious}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onFirstPage={pagination.goToFirstPage}
          onLastPage={pagination.goToLastPage}
          onNextPage={pagination.goToNextPage}
          onPreviousPage={pagination.goToPreviousPage}
        />
      )}
    </div>
  );
}