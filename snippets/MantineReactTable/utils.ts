import { showNotification } from '@mantine/notifications';
import { formatHumanName, normalizeErrorString } from '@medplum/core';
import { HumanName } from '@medplum/fhirtypes';
import { MRT_SortingState } from 'mantine-react-table';

export function getSortingString(sorting: MRT_SortingState) {
  return sorting.map(({ desc, id }) => `${desc ? '-' : ''}${id}`).join(',');
}

export function handleApiError(error: unknown): void {
  const message = normalizeErrorString(error);
  if (message.includes('Internal Server Error')) {
    showNotification({
      title: 'Server Error',
      message: 'The server is currently unavailable. Please try again later.',
      color: 'red',
      autoClose: true,
    });
  }

  // Generic error fallback
  showNotification({
    title: 'Error',
    message: normalizeErrorString(error),
    color: 'red',
    autoClose: true,
  });
}


/* Format a FIHR Human Name into a human readable string.
 * @param name A single HumanName object or an array of HumanName objects.
 */
export function getHumanName(name?: HumanName | HumanName[]) {
  if (!name) return '';

  if (Array.isArray(name)) {
    name = name.find((n) => n.use === 'official') || name[0];
  }

  return formatHumanName(name);
}