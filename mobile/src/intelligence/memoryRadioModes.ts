import type {
  MemoryTrack,
} from '../types/memoryRadio';

import type {
  MemoryRadioContext,
} from '../storage/memoryRadioContext';

// memoryRadioModesV1

export type MemoryRadioMode =
  | 'MEMORY'
  | 'JINGLE'
  | 'ERA'
  | 'THIS_TIME'
  | 'LOST_SIGNAL';

export const memoryRadioModes: Array<{
  id: MemoryRadioMode;
  label: string;
}> = [
  {
    id: 'MEMORY',
    label: 'Memory',
  },
  {
    id: 'JINGLE',
    label: 'Jingle',
  },
  {
    id: 'ERA',
    label: 'Era',
  },
  {
    id: 'THIS_TIME',
    label: 'This Time',
  },
  {
    id: 'LOST_SIGNAL',
    label: 'Lost Signal',
  },
];

export type MemoryRadioStation = {
  mode: MemoryRadioMode;
  eyebrow: string;
  description: string;
  contextLabel: string | null;
  emptyText: string;
  count: number;
  pool: MemoryTrack[];
};

type DatedTrack = {
  track: MemoryTrack;
  timestamp: number;
  occurredAt: string;
};

type EraCluster = {
  start: number;
  end: number;
  tracks: DatedTrack[];
};

const DAY_MS =
  24 * 60 * 60 * 1000;

function datedTracks(
  memories: MemoryTrack[],
  contexts:
    Map<
      string,
      MemoryRadioContext
    >
) {
  const result:
    DatedTrack[] =
      [];

  for (const track of memories) {
    const context =
      contexts.get(
        track.trackId
      );

    if (!context) {
      continue;
    }

    const timestamp =
      Date.parse(
        context.occurredAt
      );

    if (
      !Number.isFinite(
        timestamp
      )
    ) {
      continue;
    }

    result.push({
      track,
      timestamp,
      occurredAt:
        context.occurredAt,
    });
  }

  return result.sort(
    (left, right) =>
      left.timestamp -
      right.timestamp
  );
}

function buildEraClusters(
  dated: DatedTrack[],
  gapDays = 75
) {
  const clusters:
    EraCluster[] =
      [];

  for (const item of dated) {
    const previous =
      clusters[
        clusters.length - 1
      ];

    if (
      !previous ||
      item.timestamp -
        previous.end >
        gapDays * DAY_MS
    ) {
      clusters.push({
        start:
          item.timestamp,
        end:
          item.timestamp,
        tracks: [item],
      });

      continue;
    }

    previous.end =
      item.timestamp;

    previous.tracks.push(
      item
    );
  }

  return clusters;
}

function eraContainingTrack(
  clusters: EraCluster[],
  trackId: string | null
) {
  if (!trackId) {
    return null;
  }

  return (
    clusters.find(
      (cluster) =>
        cluster.tracks.some(
          (item) =>
            item.track.trackId ===
            trackId
        )
    ) ?? null
  );
}

function formatMonthYear(
  timestamp: number
) {
  return new Intl.DateTimeFormat(
    'hr-HR',
    {
      month: 'short',
      year: 'numeric',
    }
  ).format(
    new Date(timestamp)
  );
}

function eraLabel(
  era: EraCluster
) {
  const start =
    formatMonthYear(
      era.start
    );

  const end =
    formatMonthYear(
      era.end
    );

  return start === end
    ? start
    : start + ' — ' + end;
}

function yearDay(
  date: Date
) {
  const yearStart =
    new Date(
      date.getFullYear(),
      0,
      1
    );

  return Math.floor(
    (
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime() -
      yearStart.getTime()
    ) /
      DAY_MS
  );
}

function circularDayDistance(
  left: number,
  right: number
) {
  const raw =
    Math.abs(
      left - right
    );

  return Math.min(
    raw,
    365 - raw
  );
}

export function buildMemoryRadioStation(
  options: {
    mode: MemoryRadioMode;
    memories: MemoryTrack[];
    contexts:
      Map<
        string,
        MemoryRadioContext
      >;
    currentTrackId:
      string | null;
    now?: Date;
  }
): MemoryRadioStation {
  const {
    mode,
    memories,
    contexts,
    currentTrackId,
    now = new Date(),
  } = options;

  if (mode === 'MEMORY') {
    return {
      mode,
      eyebrow:
        'NOW REMEMBERING',
      description:
        'Sve spremljene frekvencije.',
      contextLabel: null,
      emptyText:
        'Poveži prvu pjesmu sa zapisom i radio će se probuditi.',
      count:
        memories.length,
      pool:
        memories,
    };
  }

  if (mode === 'JINGLE') {
    const pool =
      memories.filter(
        (memory) =>
          contexts.get(
            memory.trackId
          )?.isJingle === true
      );

    return {
      mode,
      eyebrow:
        'JINGLE SIGNAL',
      description:
        'Uspomene povezane s naslovima koje si označio kao Jingle.',
      contextLabel:
        pool.length > 0
          ? 'osobni signal'
          : null,
      emptyText:
        'Još nema audio-uspomene povezane s Jingle naslovom.',
      count:
        pool.length,
      pool,
    };
  }

  const dated =
    datedTracks(
      memories,
      contexts
    );

  if (mode === 'ERA') {
    const eras =
      buildEraClusters(
        dated
      );

    const selected =
      eraContainingTrack(
        eras,
        currentTrackId
      ) ??
      eras[
        eras.length - 1
      ] ??
      null;

    if (!selected) {
      return {
        mode,
        eyebrow:
          'ERA SIGNAL',
        description:
          'Radio traži skup uspomena iz istog razdoblja.',
        contextLabel:
          null,
        emptyText:
          'Još nema dovoljno datiranih uspomena za Era signal.',
        count: 0,
        pool: [],
      };
    }

    const ids =
      new Set(
        selected.tracks.map(
          (item) =>
            item.track.trackId
        )
      );

    const pool =
      memories.filter(
        (memory) =>
          ids.has(
            memory.trackId
          )
      );

    return {
      mode,
      eyebrow:
        'ERA SIGNAL',
      description:
        'Frekvencije iz istog životnog klastera.',
      contextLabel:
        eraLabel(
          selected
        ),
      emptyText:
        'Ova era još nema spremljenih frekvencija.',
      count:
        pool.length,
      pool,
    };
  }

  if (mode === 'LOST_SIGNAL') {
    return {
      mode,
      eyebrow:
        'LOST SIGNAL',
      description:
        'Arheologija stvari koje su nekad zauzimale stvaran dio tvog života.',
      contextLabel:
        null,
      emptyText:
        'Signal postoji, ali oko njega nema spremljene audio frekvencije.',
      count: 0,
      pool: [],
    };
  }

  const todayDay =
    yearDay(now);

  const currentYear =
    now.getFullYear();

  const pool =
    dated
      .filter((item) => {
        const date =
          new Date(
            item.timestamp
          );

        if (
          date.getFullYear() ===
          currentYear
        ) {
          return false;
        }

        return (
          circularDayDistance(
            yearDay(date),
            todayDay
          ) <= 31
        );
      })
      .sort(
        (left, right) =>
          right.timestamp -
          left.timestamp
      )
      .map(
        (item) =>
          item.track
      );

  return {
    mode:
      'THIS_TIME',
    eyebrow:
      'SEASONAL SIGNAL',
    description:
      'Približno isti dio godine u prijašnjim godinama.',
    contextLabel:
      pool.length > 0
        ? '± 31 dan'
        : null,
    emptyText:
      'Još nema uspomene iz ovog dijela godine u ranijim godinama.',
    count:
      pool.length,
    pool,
  };
}
