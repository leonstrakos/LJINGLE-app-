import {
  relationTypeLabels,
  type EntityLink,
  type EntityReferenceType,
  type RelationType,
} from '../types/collection';

export type ConnectionDirection =
  | 'OUT'
  | 'IN'
  | 'BOTH';

export type ConnectionDirectionCopy = {
  direction: ConnectionDirection;
  marker: 'TO' | 'FROM' | '↔';
  label: string;
};

const symmetric = new Set<RelationType>([
  'RELATED',
  'REMEMBERED_WITH',
]);

const directionalLabels: Partial<
  Record<
    RelationType,
    {
      out: string;
      in: string;
    }
  >
> = {
  INSPIRED_BY: {
    out: 'Inspirirano ovime',
    in: 'Inspiriralo ovo',
  },
  ABOUT: {
    out: 'Govori o ovome',
    in: 'O ovome govori',
  },
  REFERENCES: {
    out: 'Referencira ovo',
    in: 'Ovo referencira ovu stavku',
  },
  ADAPTATION_OF: {
    out: 'Adaptirano prema ovome',
    in: 'Adaptacija ovoga',
  },
};

export function connectionDirectionCopy(
  link: EntityLink,
  currentType: EntityReferenceType,
  currentId: string,
): ConnectionDirectionCopy {
  if (symmetric.has(link.relationType)) {
    return {
      direction: 'BOTH',
      marker: '↔',
      label:
        link.relationType ===
        'REMEMBERED_WITH'
          ? 'Pamtim uz ovo'
          : relationTypeLabels[
              link.relationType
            ],
    };
  }

  const outgoing =
    link.sourceType === currentType &&
    link.sourceId === currentId;

  const labels =
    directionalLabels[link.relationType];

  return {
    direction: outgoing ? 'OUT' : 'IN',
    marker: outgoing ? 'TO' : 'FROM',
    label:
      (outgoing
        ? labels?.out
        : labels?.in) ??
      relationTypeLabels[
        link.relationType
      ],
  };
}
