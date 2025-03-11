import { Box, Paper } from '@mantine/core';
import { formatDateTime, getReferenceString, QueryTypes } from '@medplum/core';
import { ClinicalImpression, Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import dayjs from 'dayjs';
import { MRT_ColumnDef, MRT_SortingState } from 'mantine-react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableOptions } from '../Table';
import { getSortingString, handleApiError } from '../utils';

export function ClinicalImpressionTable({ patient }: { patient: Patient }) {
  const medplum = useMedplum();
  const [chartNote, setChartNote] = useState<ClinicalImpression[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [rowCount, setRowCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const fetchNotes = useCallback(async () => {
    if (!chartNote.length) {
      setLoading(true);
    } else {
      setIsRefetching(true);
    }

    try {
      const options: QueryTypes = {
        _count: pageSize,
        _offset: pageIndex * pageSize,
        _total: 'accurate',
        patient: getReferenceString(patient),
      };

      if (sorting.length > 0) {
        options._sort = getSortingString(sorting);
      } else {
        options._sort = '-date';
      }

      const chartNotes = await medplum.searchResources('ClinicalImpression', options);
      setChartNote(chartNotes);
      setRowCount(chartNotes.bundle.total ?? 0);
      setError(null);
    } catch (error) {
      handleApiError(error);
      setError('Error loading notes');
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [medplum, patient, sorting, pageIndex, pageSize, chartNote.length]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  const columns = useMemo<MRT_ColumnDef<ClinicalImpression>[]>(
    () => [
      {
        header: 'Date',
        id: 'date',
        accessorFn: (row) => row.date && dayjs(formatDateTime(row.date)).format('MM/DD/YYYY'),
      },
      {
        header: 'Time',
        id: 'time',
        accessorFn: (row) => row.date && dayjs(formatDateTime(row.date)).format('hh:mm A'),
        enableSorting: false,
      },
      {
        header: 'Note',
        id: 'note',
        enableSorting: false,
        accessorFn: (row) => {
          const notes = row.note?.map((note) => note.text).join('\n');

          return notes?.length && notes.length > 100 ? `${notes?.slice(0, 100)}...` : notes;
        },
      },
    ],
    []
  );

  const options: TableOptions<ClinicalImpression> = useMemo(
    () => ({
      data: chartNote,

      columns,
      rowCount,
      pageIndex,
      pageSize,
      isLoading,
      error,
      isRefetching,
      sorting,

      enableTopToolbar: false,
      enableColumnFilters: false,
      enableGlobalFilter: false,

      onSortingChange: setSorting,
      onPaginationChange: (updater) => {
        const newPagination = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
        setPageIndex(newPagination.pageIndex);
        setPageSize(newPagination.pageSize);
      },

      onRowClick:
        ({
          row: {
            original: { subject, id },
          },
        }) =>
        () => {
          const patientId = subject?.reference?.split('/')[1];
          // return navigate(`/patient/${patientId}/chart-note/${id}`);
        },
    }),
    [isLoading, error, isRefetching, sorting, pageIndex, pageSize, rowCount, chartNote, columns]
  );

  return (
    <Box>
      <Paper withBorder>
        <Table options={options} />
      </Paper>
    </Box>
  );
}
