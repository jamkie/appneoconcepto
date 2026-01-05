import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyState?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  className,
  emptyState
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

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
                    column.hideOnMobile && "hidden md:table-cell"
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
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
    </div>
  );
}
