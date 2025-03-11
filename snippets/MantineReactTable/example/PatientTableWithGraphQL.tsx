import { Badge, Center, Flex, useMantineTheme } from '@mantine/core';
import { calculateAge, formatDateTime } from '@medplum/core';
import { HumanName } from '@medplum/fhirtypes';
import { ResourceAvatar, useMedplum, useMedplumNavigate } from '@medplum/react';
import { IconUsersGroup } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { MRT_ColumnDef, MRT_ColumnFiltersState, MRT_SortingState } from 'mantine-react-table';
import { useEffect, useMemo, useState } from 'react';
import { Table, TableOptions } from '../Table';
import { getHumanName, handleApiError } from '../utils';
import { graphqlQuery, GraphQLQueryResponse, GraphQLQueryResponsePatient } from './PatientTable.graphql';

const formatName = (name?: HumanName | HumanName[]) => {
  if (!name) {
    return '';
  }

  const names = Array.isArray(name) ? name : [name];
  const officialName = names.find((n) => n.use === 'official') ?? names[0];
  const preferredName = names.find((n) => n.use === 'usual');

  const formattedOfficial = `${officialName.given?.[0]} ${officialName.family}`;
  return preferredName
    ? `${formattedOfficial} (${preferredName.given?.[0]} ${preferredName.family})`
    : formattedOfficial;
};

export function PatientTable() {
  const medplum = useMedplum();
  const navigate = useMedplumNavigate();
  const theme = useMantineTheme();

  const [data, setData] = useState<GraphQLQueryResponsePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [rowCount, setRowCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [clinicianList, setClinicianList] = useState<string[]>([]);

  const columns = useMemo<MRT_ColumnDef<GraphQLQueryResponsePatient>[]>(() => {
    return [
      {
        header: 'Client',
        id: 'name',
        accessorFn: (row) => ({
          name: formatName(row.name),
          photoURL: row.photo?.[0]?.url,
        }),
        mantineTableBodyCellProps: { style: { fontWeight: 'bold' } },
        // eslint-disable-next-line react/prop-types
        Cell: ({ cell }) => {
          // eslint-disable-next-line react/prop-types
          const value = cell.getValue() as { name: string; photoURL: string };
          return (
            <Center inline>
              <ResourceAvatar src={value.photoURL} alt={value.name} mr="0.5rem" />
              {value.name}
            </Center>
          );
        },
      },
      {
        header: 'Clinician',
        id: 'generalPractitioner',
        accessorFn: (row) => row.generalPractitioner?.map((person) => person.display),
        // eslint-disable-next-line react/prop-types
        Cell: ({ cell }) => {
          // eslint-disable-next-line react/prop-types
          const names = cell.getValue() as string[];

          return (
            <Flex direction="column">
              {names?.map((name, index) => <span key={`practitioner-${index}`}>{name}</span>)}
            </Flex>
          );
        },
        enableColumnActions: true,
        enableSorting: true,
        enableColumnFilter: true,
        mantineFilterSelectProps: {
          data: clinicianList.map((clinician) => ({ value: clinician, label: clinician })),
        },
        filterVariant: 'select',
      },
      {
        header: 'Caregivers',
        id: 'RelatedPersonList.name',
        accessorFn: (row) => row.RelatedPersonList?.map((relatedPerson) => formatName(relatedPerson.name)),
        // eslint-disable-next-line react/prop-types
        Cell: ({ cell }) => {
          // eslint-disable-next-line react/prop-types
          const names = cell.getValue() as string[];

          return <Flex direction="column">{names?.map((name, index) => <span key={index}>{name}</span>)}</Flex>;
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        header: 'Client type',
        id: 'type',
        accessorFn: (row) => {
          if (!row.birthDate) {
            return '';
          }

          const { years } = calculateAge(row.birthDate);
          if (years >= 18) {
            return 'Adult';
          }
          return 'Minor';
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        header: 'Join date',
        id: 'joinDate',
        accessorFn: (row) => {
          const joinDate = row.joinDate?.[0]?.valueDateTime;
          if (!joinDate) return '';
          return dayjs(formatDateTime(joinDate)).format('MM/DD/YYYY');
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        header: 'Next session',
        id: 'lastEncounter.date',
        accessorFn: (row) => {
          const encounterStartTime = row.lastEncounter?.[0]?.period?.start;
          if (encounterStartTime && dayjs(formatDateTime(encounterStartTime)).isAfter(dayjs())) {
            return `${dayjs(formatDateTime(encounterStartTime)).format('MMMM D [at] h:mm A')} (${dayjs(formatDateTime(encounterStartTime)).fromNow()})`;
          }
          return '';
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        header: 'Status',
        id: 'status',
        accessorFn: (row) => {
          const status = row.status?.[0]?.valueString;
          return status || '';
        },
        enableColumnActions: true,
        enableSorting: false,
        enableColumnFilter: true,
        mantineFilterSelectProps: {
          data: [
            { value: 'created-account', label: 'Created Account' },
            { value: 'intake-scheduled', label: 'Intake Scheduled' },
            { value: 'on-track', label: 'On Track' },
            { value: 'needs-appointment', label: 'Needs Appointment' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'discharged', label: 'Discharged' },
          ],
        },
        filterVariant: 'select',
        // eslint-disable-next-line react/prop-types
        Cell: ({ renderedCellValue }) => (
          <Badge size="lg" fullWidth fw={400}>
            {renderedCellValue}
          </Badge>
        ),
      },
    ];
  }, [clinicianList]);

  useEffect(() => {
    const fetchPractitioners = async () => {
      const practitionersList = await medplum.searchResources('Practitioner', { active: true });
      setClinicianList(practitionersList.map((practitioner) => getHumanName(practitioner.name) || ''));
    };
    void fetchPractitioners();
  }, [medplum]);

  useEffect(() => {
    const fetchPatients = async () => {
      if (!data.length) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      const offset = pageIndex * pageSize;

      const rootFilters = [];
      const relatedPersonFilters = [];
      for (const columnFilter of columnFilters) {
        if (columnFilter.id === 'status') continue;

        if (columnFilter.id === 'name') {
          rootFilters.push(`name co "${columnFilter.value as string}"`);
        }

        if (columnFilter.id === 'RelatedPersonList.name') {
          relatedPersonFilters.push(`name co "${columnFilter.value as string}"`);
          // Enforce sorting on filter to push empty results to the bottom
          if (!sorting.find(({ id }) => id === 'RelatedPersonList.name')) {
            setSorting((sorting) => [...sorting, { id: 'RelatedPersonList.name', desc: false }]);
          }
        }

        if (columnFilter.id === 'generalPractitioner') {
          rootFilters.push(`general-practitioner:Practitioner.name co "${columnFilter.value as string}"`);
        }
      }

      const mappedSorting = sorting
        .map(({ id, desc }) => {
          const sortFieldMap: Record<string, string> = {
            name: 'family',
            generalPractitioner: 'general-practitioner',
          };

          const sortField = sortFieldMap[id];
          if (!sortField) return null;
          return `${desc ? '-' : ''}${sortField}`;
        })
        .filter(Boolean)
        .join(',');

      if (globalFilter) {
        rootFilters.push(`name co "${globalFilter}" or _id eq "${globalFilter}" or identifier eq "${globalFilter}"`);
      }

      // If we send `filter: ""`, the query fails with the message "Cant consume unknown more tokens."
      const mappedFilters = rootFilters.join(' and ') || undefined;
      const mappedRelatedPersonFilters = relatedPersonFilters.join(' and ') || undefined;

      const graphqlResult = (await medplum.graphql(graphqlQuery, 'PaginatedQuery', {
        offset,
        count: pageSize,
        filters: mappedFilters,
        relatedPersonFilters: mappedRelatedPersonFilters,
        sorting: mappedSorting || '_id',
      })) as GraphQLQueryResponse;

      if (graphqlResult.errors) {
        handleApiError(error);
        setError(graphqlResult.errors.map((e) => e.message).join(', '));
      } else {
        const result = graphqlResult.data.PatientConnection;
        let filteredData = result.edges.map(({ resource }) => ({ ...resource }));

        const statusFilter = columnFilters.find((filter) => filter.id === 'status');
        if (statusFilter) {
          filteredData = filteredData.filter((patient) => patient.status?.[0]?.valueCode === statusFilter.value);
        }

        setRowCount(result.count);
        setPageSize(result.pageSize);
        setData(filteredData);
        setError(null);
      }

      setIsLoading(false);
      setIsRefetching(false);
    };

    void fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, pageIndex, columnFilters, globalFilter, medplum]);

  const options: TableOptions<GraphQLQueryResponsePatient> = useMemo(() => {
    return {
      columns,
      data,
      rowCount,

      isLoading,
      error,
      isRefetching,
      columnFilters,
      globalFilter,
      sorting,
      pageIndex,
      pageSize,
      rowActionLabel: 'View chart',
      enableGlobalFilter: true,
      enableTopToolbar: true,

      onColumnFiltersChange: setColumnFilters,
      onGlobalFilterChange: setGlobalFilter,
      onSortingChange: setSorting,
      onPaginationChange: (updater) => {
        const newPagination = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
        setPageIndex(newPagination.pageIndex);
        setPageSize(newPagination.pageSize);
      },

      onRowClick:
        ({ row: { original } }) =>
        () => {
          navigate(`/patient/${original.id}`);
        },
    };
  }, [
    data,
    columns,
    isLoading,
    error,
    isRefetching,
    columnFilters,
    globalFilter,
    sorting,
    pageIndex,
    pageSize,
    rowCount,
    navigate,
  ]);

  return (
    <Table
      options={options}
      title={
        <>
          <IconUsersGroup color={theme.colors.cyan[7]} size="2.5rem" stroke={1.5} style={{ marginRight: '0.75rem' }} />
          Clients
        </>
      }
    />
  );
}
