import { Flex, Group, Title, useMantineTheme } from '@mantine/core';
import {
  IconAdjustmentsHorizontal,
  IconColumns,
  IconDotsVertical,
  IconFilter,
  IconFilterOff,
} from '@tabler/icons-react';
import {
  MRT_ColumnFiltersState,
  MRT_ProgressBar,
  MRT_Row,
  MRT_RowData,
  MRT_SortingState,
  MRT_TableContainer,
  MRT_TableInstance,
  MRT_TableOptions,
  MRT_TablePagination,
  useMantineReactTable,
} from 'mantine-react-table';
import { MouseEventHandler, ReactNode } from 'react';
import { GlobalFilterTextInput } from './GlobalFilterTextInput';
import { ShowHideColumnsButton } from './ShowHideColumnsButton';
import { ToggleFiltersButton } from './ToggleFiltersButton';

import classes from './Table.module.css';


export interface UseTableOptions<RowData extends MRT_RowData> {
  pageIndex: number;
  pageSize: number;
  isLoading?: boolean;
  error?: string | null;
  isRefetching?: boolean;
  columnFilters?: MRT_ColumnFiltersState;
  globalFilter?: string;
  sorting?: MRT_SortingState;
  rowActionLabel?: string;

  onRowClick?: (props: {
    row: MRT_Row<RowData>;
    table: MRT_TableInstance<RowData>;
  }) => MouseEventHandler<HTMLTableRowElement>;
}

export type TableOptions<RowData extends MRT_RowData> = MRT_TableOptions<RowData> & UseTableOptions<RowData>;

export function useTable<RowData extends MRT_RowData>(options: TableOptions<RowData>) {
  const theme = useMantineTheme();

  const {
    pageIndex,
    pageSize,
    isLoading = false,
    error,
    isRefetching,
    columnFilters = [],
    globalFilter = '',
    sorting = [],
    rowActionLabel,
    onRowClick,
    ...mantineTableOptions
  } = options;

  return useMantineReactTable({
    enableGlobalFilter: true,
    enableGlobalFilterModes: true,

    mantineToolbarAlertBannerProps: error ? { color: 'red', children: error } : undefined,

    mantineTableBodyRowProps: (props) => ({
      onClick: onRowClick?.(props),
      style: { cursor: 'pointer' },
    }),
    mantineTableHeadCellProps: { className: classes.tableHeadCell },

    enableRowActions: !!rowActionLabel,
    positionActionsColumn: 'last',
    renderRowActions: rowActionLabel
      ? () => (
          <div>
            <a>{rowActionLabel}</a>
          </div>
        )
      : undefined,

    // Enable server side pagination, filtering and sorting
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,

    paginationDisplayMode: 'pages',

    ...mantineTableOptions,

    state: {
      isLoading,
      columnFilters,
      globalFilter,
      sorting,
      pagination: { pageIndex, pageSize },
      showAlertBanner: !!error,
      showProgressBars: isRefetching ?? false,
      showGlobalFilter: true,

      ...mantineTableOptions.state,
    },

    mantinePaginationProps: {
      showRowsPerPage: false,
      withControls: false, // Don't show pagination arrows
      radius: 'xl',
      size: 'lg',
      color: 'cyan.9',
      autoContrast: true,

      ...(mantineTableOptions.mantinePaginationProps ?? {}),
    },

    icons: {
      IconDots: (props: Record<string, unknown>) => <IconDotsVertical {...props} />,
      IconDotsVertical: (props: Record<string, unknown>) => <IconAdjustmentsHorizontal {...props} />,
      IconFilter: (props: Record<string, unknown>) => <IconFilter color={theme.colors.cyan[9]} {...props} />,
      IconFilterOff: (props: Record<string, unknown>) => <IconFilterOff color={theme.colors.cyan[9]} {...props} />,
      IconColumns: (props: Record<string, unknown>) => <IconColumns color={theme.colors.cyan[9]} {...props} />,

      ...(mantineTableOptions.icons ?? {}),
    },
  });
}

export interface TableProps<RowData extends MRT_RowData> {
  title?: ReactNode;
  options: TableOptions<RowData>;
}

export function Table<RowData extends MRT_RowData>({ title, options }: TableProps<RowData>) {
  const table = useTable(options);

  return (
    <div className={classes.table}>
      <Flex justify="space-between">
        <Title display="flex" mb="1.75rem">
          {title}
        </Title>
        <Flex>
          {options.enableTopToolbar && (
            <Group style={{ gap: 'sm' }}>
              {options.enableGlobalFilter && <GlobalFilterTextInput table={table} />}
              <ShowHideColumnsButton table={table} />
              <ToggleFiltersButton table={table} />
            </Group>
          )}
        </Flex>
      </Flex>
      <div style={{ position: 'relative' }}>
        <MRT_ProgressBar isTopToolbar={true} table={table} />
      </div>
      <MRT_TableContainer table={table} />
      {(options.rowCount ?? 0) > options.pageSize && (
        <MRT_TablePagination className={classes.pagination} table={table} />
      )}
    </div>
  );
}
