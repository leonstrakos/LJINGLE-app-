// ljingleCelestialConstellationReorganizeR13
import {
  Platform,
} from 'react-native';
import {
  File,
  Paths,
} from 'expo-file-system';

export type HomeConstellationNodeOffsetMap =
  Record<
    string,
    {
      x: number;
      y: number;
    }
  >;

type StoredState = {
  rotation: number;
  offsets: HomeConstellationNodeOffsetMap;
};

const WEB_KEY =
  'ljingle_home_constellation_rotation';

const FILE_NAME =
  'ljingle-home-constellation-rotation.json';

let cachedState:
  StoredState | null =
  null;

function defaultState():
StoredState {
  return {
    rotation: 0,
    offsets: {},
  };
}

function normalizeRotation(
  value: number,
) {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  const snapped =
    Math.round(
      value / 90,
    ) * 90;

  const wrapped =
    ((snapped % 360) + 360) %
    360;

  return wrapped;
}

function normalizeOffsets(
  value: unknown,
): HomeConstellationNodeOffsetMap {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return {};
  }

  const raw =
    value as Record<
      string,
      unknown
    >;

  const next:
    HomeConstellationNodeOffsetMap =
    {};

  for (
    const key of
    Object.keys(
      raw,
    )
  ) {
    const item =
      raw[key];

    if (
      item &&
      typeof item ===
        'object'
    ) {
      const point =
        item as Record<
          string,
          unknown
        >;

      const x =
        Number(
          point.x,
        );
      const y =
        Number(
          point.y,
        );

      next[key] = {
        x:
          Number.isFinite(
            x,
          )
            ? x
            : 0,
        y:
          Number.isFinite(
            y,
          )
            ? y
            : 0,
      };
    }
  }

  return next;
}

function parseStored(
  raw: string | null | undefined,
): StoredState {
  if (
    !raw
  ) {
    return defaultState();
  }

  try {
    const parsed =
      JSON.parse(
        raw,
      ) as unknown;

    if (
      typeof parsed ===
        'number'
    ) {
      return {
        rotation:
          normalizeRotation(
            parsed,
          ),
        offsets: {},
      };
    }

    if (
      parsed &&
      typeof parsed ===
        'object'
    ) {
      const object =
        parsed as Record<
          string,
          unknown
        >;

      return {
        rotation:
          normalizeRotation(
            Number(
              object.rotation,
            ),
          ),
        offsets:
          normalizeOffsets(
            object.offsets,
          ),
      };
    }
  } catch {
    const maybeLegacy =
      Number(raw);

    if (
      Number.isFinite(
        maybeLegacy,
      )
    ) {
      return {
        rotation:
          normalizeRotation(
            maybeLegacy,
          ),
        offsets: {},
      };
    }
  }

  return defaultState();
}

async function readState():
Promise<StoredState> {
  if (
    cachedState
  ) {
    return cachedState;
  }

  try {
    if (
      Platform.OS === 'web'
    ) {
      const raw =
        (globalThis)
          .localStorage
          ?.getItem(
            WEB_KEY,
          );

      cachedState =
        parseStored(
          raw,
        );

      return cachedState;
    }

    const file =
      new File(
        Paths.document,
        FILE_NAME,
      );

    const raw =
      await file.text();

    cachedState =
      parseStored(
        raw,
      );

    return cachedState;
  } catch {
    cachedState =
      defaultState();

    return cachedState;
  }
}

async function writeState(
  next: StoredState,
): Promise<void> {
  cachedState = next;

  try {
    const serialized =
      JSON.stringify(
        next,
      );

    if (
      Platform.OS === 'web'
    ) {
      (globalThis)
        .localStorage
        ?.setItem(
          WEB_KEY,
          serialized,
        );

      return;
    }

    const file =
      new File(
        Paths.document,
        FILE_NAME,
      );

    file.create({
      overwrite: true,
      intermediates: true,
    });

    file.write(
      serialized,
    );
  } catch {
    // cosmetic persistence only
  }
}

export async function getHomeConstellationRotation():
Promise<number> {
  const state =
    await readState();

  return state.rotation;
}

export async function setHomeConstellationRotation(
  value: number,
): Promise<void> {
  const state =
    await readState();

  await writeState({
    rotation:
      normalizeRotation(
        value,
      ),
    offsets:
      state.offsets,
  });
}

export async function getHomeConstellationNodeOffsets():
Promise<HomeConstellationNodeOffsetMap> {
  const state =
    await readState();

  return state.offsets;
}

export async function setHomeConstellationNodeOffsets(
  value: HomeConstellationNodeOffsetMap,
): Promise<void> {
  const state =
    await readState();

  await writeState({
    rotation:
      state.rotation,
    offsets:
      normalizeOffsets(
        value,
      ),
  });
}
