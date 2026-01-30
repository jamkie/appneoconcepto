import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedData: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { initialPage = 1, initialPageSize = 10 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Adjust current page if it exceeds total pages (e.g., after filtering)
  const adjustedCurrentPage = Math.min(currentPage, totalPages);
  if (adjustedCurrentPage !== currentPage) {
    setCurrentPage(adjustedCurrentPage);
  }
  
  const paginatedData = useMemo(() => {
    const startIndex = (adjustedCurrentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, adjustedCurrentPage, pageSize]);
  
  const startIndex = (adjustedCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(adjustedCurrentPage * pageSize, totalItems);
  
  const canGoNext = adjustedCurrentPage < totalPages;
  const canGoPrevious = adjustedCurrentPage > 1;
  
  const setPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };
  
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };
  
  const goToFirstPage = () => setPage(1);
  const goToLastPage = () => setPage(totalPages);
  const goToNextPage = () => setPage(adjustedCurrentPage + 1);
  const goToPreviousPage = () => setPage(adjustedCurrentPage - 1);
  
  return {
    currentPage: adjustedCurrentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    setPage,
    setPageSize,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    startIndex: totalItems > 0 ? startIndex : 0,
    endIndex,
  };
}
