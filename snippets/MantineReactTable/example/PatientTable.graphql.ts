import { Encounter, Extension, Patient, Reference, RelatedPerson } from '@medplum/fhirtypes';

export type GraphQLQueryResponsePatient = Pick<Patient, 'id' | 'photo' | 'name' | 'birthDate'> & {
  RelatedPersonList: RelatedPerson[];
  lastEncounter: [Pick<Encounter, 'period'>];
  joinDate: Extension[];
  status: Extension[];
  generalPractitioner: Reference[];
};

export interface GraphQLQueryResponse {
  data: {
    PatientConnection: {
      count: number;
      offset: number;
      pageSize: number;
      edges: {
        resource: GraphQLQueryResponsePatient;
      }[];
    };
  };
  errors?: {
    message: string;
  }[];
}

export const graphqlQuery = `
query PaginatedQuery($offset: Int, $count: Int, $filters: String, $relatedPersonFilters: String, $sorting: String) {
  PatientConnection(_offset: $offset, _count: $count, _filter: $filters, _sort: $sorting) {
    count
    offset
    pageSize
    edges {
      resource {
        resourceType
        id
        photo {
          url
        }
        status: extension(url: "http://example.com/StructureDefinition/patient-status") {
          valueString
          valueCode
        }
        joinDate: extension(url: "http://example.com/StructureDefinition/patient-join-date") {
          valueDateTime
        }
        name {
          family
          given
          use
        }
        RelatedPersonList(_reference: patient, active: "true", _filter: $relatedPersonFilters) {
          name {
            family
            given
          }
        }
        lastEncounter: EncounterList(_reference: subject, _sort: "-date", _count: 1) {
          period {
            end
          }
        }
        generalPractitioner {
          display
        }
        birthDate
      }
    }
  }
}`;
