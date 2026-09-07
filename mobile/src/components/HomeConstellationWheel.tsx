// ljingleCelestialConstellationStableDragFastWheelR14
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';

import {
  colors,
} from '../theme/colors';
import {
  LjingleStar,
} from './LjingleStar';
import {
  getHomeConstellationNodeOffsets,
  getHomeConstellationRotation,
  setHomeConstellationNodeOffsets,
  setHomeConstellationRotation,
} from '../services/homeConstellationPreference';

type Props = {
  accentColor: string;
  onOpenCatalogue: () => void;
  onOpenTopics: () => void;
  onOpenEntries: () => void;
  onOpenArchive: () => void;
  onOpenRadio: () => void;
};

type NodeKey =
  | 'catalogue'
  | 'topics'
  | 'entries'
  | 'profile'
  | 'radio';

type Point = {
  x: number;
  y: number;
};

type NodeDefinition = {
  key: NodeKey;
  accessibilityLabel: string;
  angle: number;
  radiusScale: number;
  onPress: () => void;
};

type NodeOffsetMap = Record<
  NodeKey,
  Point
>;

type EdgeDefinition = {
  from: NodeKey;
  to: NodeKey;
  bendA: number;
  bendB: number;
  branchX: number;
  branchY: number;
  branchFromSecond?: boolean;
};

const WHEEL_HEIGHT = 360;
const TOUCH_SIZE = 118;
const DRAG_MARGIN_X = 20;
const DRAG_MARGIN_TOP = 18;
const DRAG_MARGIN_BOTTOM = 18;
const FIELD_MARGIN_X = 12;
const FIELD_MARGIN_Y = 12;
const NODE_BOUNDS_RADIUS = 38;
const ROTATION_X_GAIN = 1.15;
const ROTATION_Y_GAIN = 0.18;

const NODE_WORDS: Record<
  NodeKey,
  string
> = {
  catalogue: 'KATALOG',
  topics: 'TEME',
  entries: 'ZAPISI',
  profile: 'ARHIV',
  radio: 'RADIO',
};

function zeroPoint(): Point {
  return {
    x: 0,
    y: 0,
  };
}

function createZeroOffsets():
NodeOffsetMap {
  return {
    catalogue:
      zeroPoint(),
    topics:
      zeroPoint(),
    entries:
      zeroPoint(),
    profile:
      zeroPoint(),
    radio:
      zeroPoint(),
  };
}

function normalizeOffsets(
  value: unknown,
): NodeOffsetMap {
  const next =
    createZeroOffsets();

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return next;
  }

  const raw =
    value as Record<
      string,
      unknown
    >;

  for (
    const key of
    Object.keys(
      next,
    ) as NodeKey[]
  ) {
    const item =
      raw[key];

    if (
      !item ||
      typeof item !== 'object'
    ) {
      continue;
    }

    const point =
      item as Record<
        string,
        unknown
      >;

    const x =
      Number(point.x);
    const y =
      Number(point.y);

    next[key] = {
      x:
        Number.isFinite(x)
          ? x
          : 0,
      y:
        Number.isFinite(y)
          ? y
          : 0,
    };
  }

  return next;
}

function addPoints(
  left: Point,
  right: Point,
): Point {
  return {
    x:
      left.x + right.x,
    y:
      left.y + right.y,
  };
}

function subtractPoints(
  left: Point,
  right: Point,
): Point {
  return {
    x:
      left.x - right.x,
    y:
      left.y - right.y,
  };
}

function distanceOf(
  point: Point,
) {
  return Math.sqrt(
    point.x * point.x +
      point.y * point.y,
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function pointOnCircle(
  center: Point,
  radius: number,
  angleDegrees: number,
): Point {
  const radians =
    (
      angleDegrees *
      Math.PI
    ) /
    180;

  return {
    x:
      center.x +
      Math.cos(radians) *
        radius,
    y:
      center.y +
      Math.sin(radians) *
        radius,
  };
}

function lineGeometry(
  from: Point,
  to: Point,
) {
  const dx =
    to.x - from.x;
  const dy =
    to.y - from.y;

  const length =
    Math.sqrt(
      dx * dx +
        dy * dy,
    );

  const angle =
    Math.atan2(
      dy,
      dx,
    ) *
    (180 / Math.PI);

  return {
    left:
      (
        from.x + to.x
      ) /
        2 -
      length / 2,
    top:
      (
        from.y + to.y
      ) /
      2,
    width:
      Math.max(
        1,
        length,
      ),
    transform: [
      {
        rotate:
          angle + 'deg',
      },
    ],
  };
}

function lerpPoint(
  from: Point,
  to: Point,
  t: number,
): Point {
  return {
    x:
      from.x +
      (
        to.x - from.x
      ) *
        t,
    y:
      from.y +
      (
        to.y - from.y
      ) *
        t,
  };
}

function kinkPoints(
  from: Point,
  to: Point,
  bendA: number,
  bendB: number,
) {
  const dx =
    to.x - from.x;
  const dy =
    to.y - from.y;

  const length =
    Math.max(
      1,
      Math.sqrt(
        dx * dx +
          dy * dy,
      ),
    );

  const normal = {
    x:
      -dy / length,
    y:
      dx / length,
  };

  const first =
    lerpPoint(
      from,
      to,
      0.34,
    );

  const second =
    lerpPoint(
      from,
      to,
      0.70,
    );

  return {
    one: {
      x:
        first.x +
        normal.x * bendA,
      y:
        first.y +
        normal.y * bendA,
    },
    two: {
      x:
        second.x +
        normal.x * bendB,
      y:
        second.y +
        normal.y * bendB,
    },
  };
}

function constrainAbsoluteOffset({
  baseAnchor,
  proposedOffset,
  width,
}: {
  baseAnchor: Point;
  proposedOffset: Point;
  width: number;
}): Point {
  const point =
    addPoints(
      baseAnchor,
      proposedOffset,
    );

  const constrained = {
    x: clamp(
      point.x,
      DRAG_MARGIN_X,
      Math.max(
        DRAG_MARGIN_X,
        width -
          DRAG_MARGIN_X,
      ),
    ),
    y: clamp(
      point.y,
      DRAG_MARGIN_TOP,
      WHEEL_HEIGHT -
        DRAG_MARGIN_BOTTOM,
    ),
  };

  return subtractPoints(
    constrained,
    baseAnchor,
  );
}

function rotatePointAround(
  center: Point,
  point: Point,
  degrees: number,
): Point {
  const radians =
    (
      degrees *
      Math.PI
    ) /
    180;

  const cos =
    Math.cos(radians);
  const sin =
    Math.sin(radians);

  const dx =
    point.x - center.x;
  const dy =
    point.y - center.y;

  return {
    x:
      center.x +
      dx * cos -
      dy * sin,
    y:
      center.y +
      dx * sin +
      dy * cos,
  };
}

function computeFieldShift({
  anchors,
  center,
  width,
  rotation,
}: {
  anchors: Record<
    NodeKey,
    Point
  >;
  center: Point;
  width: number;
  rotation: number;
}): Point {
  const rotated =
    (
      Object.keys(
        anchors,
      ) as NodeKey[]
    ).map(
      (key) =>
        rotatePointAround(
          center,
          anchors[key],
          rotation,
        ),
    );

  const minX =
    Math.min(
      ...rotated.map(
        (point) =>
          point.x -
          NODE_BOUNDS_RADIUS,
      ),
    );

  const maxX =
    Math.max(
      ...rotated.map(
        (point) =>
          point.x +
          NODE_BOUNDS_RADIUS,
      ),
    );

  const minY =
    Math.min(
      ...rotated.map(
        (point) =>
          point.y -
          NODE_BOUNDS_RADIUS,
      ),
    );

  const maxY =
    Math.max(
      ...rotated.map(
        (point) =>
          point.y +
          NODE_BOUNDS_RADIUS,
      ),
    );

  const availableWidth =
    width -
    FIELD_MARGIN_X * 2;

  const availableHeight =
    WHEEL_HEIGHT -
    FIELD_MARGIN_Y * 2;

  const spanX =
    maxX - minX;
  const spanY =
    maxY - minY;

  let x = 0;
  let y = 0;

  if (
    spanX >
    availableWidth
  ) {
    x =
      width / 2 -
      (
        minX + maxX
      ) /
        2;
  } else {
    if (
      minX <
      FIELD_MARGIN_X
    ) {
      x +=
        FIELD_MARGIN_X -
        minX;
    }

    if (
      maxX + x >
      width -
        FIELD_MARGIN_X
    ) {
      x -=
        maxX + x -
        (
          width -
          FIELD_MARGIN_X
        );
    }
  }

  if (
    spanY >
    availableHeight
  ) {
    y =
      WHEEL_HEIGHT / 2 -
      (
        minY + maxY
      ) /
        2;
  } else {
    if (
      minY <
      FIELD_MARGIN_Y
    ) {
      y +=
        FIELD_MARGIN_Y -
        minY;
    }

    if (
      maxY + y >
      WHEEL_HEIGHT -
        FIELD_MARGIN_Y
    ) {
      y -=
        maxY + y -
        (
          WHEEL_HEIGHT -
          FIELD_MARGIN_Y
        );
    }
  }

  return {
    x,
    y,
  };
}

function NodeWord({
  kind,
  color,
}: {
  kind: NodeKey;
  color: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      pointerEvents="none"
      numberOfLines={1}
      style={[
        styles.nodeWord,
        {
          color,
        },
      ]}
    >
      {NODE_WORDS[kind]}
    </Text>
  );
}

function WordConstellationNode({
  kind,
  color,
  accentColor,
}: {
  kind: NodeKey;
  color: string;
  accentColor: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={
        styles.wordConstellationNode
      }
    >
      <LjingleStar
        variant="spark"
        size={8}
        color={color}
        opacity={0.34}
        style={
          styles.wordStarMain
        }
      />

      <LjingleStar
        variant="spark"
        size={5}
        color={colors.white}
        opacity={0.17}
        style={
          styles.wordStarLow
        }
      />

      <LjingleStar
        variant="spark"
        size={4}
        color={accentColor}
        opacity={0.15}
        style={
          styles.wordStarAccent
        }
      />

      <NodeWord
        kind={kind}
        color={color}
      />
    </View>
  );
}

function RadioConstellationNode({
  color,
  accentColor,
}: {
  color: string;
  accentColor: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={
        styles.radioConstellation
      }
    >
      <LjingleStar
        variant="spark"
        size={8}
        color={color}
        opacity={0.33}
        style={
          styles.radioStarMain
        }
      />

      <LjingleStar
        variant="spark"
        size={5}
        color={colors.white}
        opacity={0.16}
        style={styles.radioStarA}
      />

      <LjingleStar
        variant="spark"
        size={4}
        color={accentColor}
        opacity={0.14}
        style={styles.radioStarB}
      />

      <Text
        allowFontScaling={false}
        style={[
          styles.musicNote,
          styles.musicNoteA,
          {
            color,
          },
        ]}
      >
        ♪
      </Text>

      <Text
        allowFontScaling={false}
        style={[
          styles.musicNote,
          styles.musicNoteB,
          {
            color:
              accentColor,
          },
        ]}
      >
        ♫
      </Text>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.radioWord,
          {
            color,
          },
        ]}
      >
        RADIO
      </Text>
    </View>
  );
}

function Segment({
  from,
  to,
  color,
  opacity = 0.23,
}: {
  from: Point;
  to: Point;
  color: string;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.segment,
        lineGeometry(
          from,
          to,
        ),
        {
          backgroundColor:
            color,
          opacity,
        },
      ]}
    />
  );
}

function StarAt({
  point,
  color,
  size,
  opacity,
}: {
  point: Point;
  color: string;
  size: number;
  opacity: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.vertexStar,
        {
          left:
            point.x - 8,
          top:
            point.y - 8,
        },
      ]}
    >
      <LjingleStar
        variant="spark"
        size={size}
        color={color}
        opacity={opacity}
      />
    </View>
  );
}

function ChartConnection({
  edge,
  from,
  to,
  lineColor,
  starColor,
  accentColor,
}: {
  edge: EdgeDefinition;
  from: Point;
  to: Point;
  lineColor: string;
  starColor: string;
  accentColor: string;
}) {
  const kink =
    kinkPoints(
      from,
      to,
      edge.bendA,
      edge.bendB,
    );

  const branchBase =
    edge.branchFromSecond
      ? kink.two
      : kink.one;

  const branch = {
    x:
      branchBase.x +
      edge.branchX,
    y:
      branchBase.y +
      edge.branchY,
  };

  const softOne =
    lerpPoint(
      from,
      kink.one,
      0.46,
    );

  const softTwo =
    lerpPoint(
      kink.two,
      to,
      0.58,
    );

  const isRadioEdge =
    edge.from === 'radio' ||
    edge.to === 'radio';

  return (
    <View
      pointerEvents="none"
      style={
        StyleSheet.absoluteFill
      }
    >
      <Segment
        from={from}
        to={kink.one}
        color={lineColor}
      />

      <Segment
        from={kink.one}
        to={kink.two}
        color={lineColor}
        opacity={0.25}
      />

      <Segment
        from={kink.two}
        to={to}
        color={lineColor}
      />

      <Segment
        from={branchBase}
        to={branch}
        color={lineColor}
        opacity={0.17}
      />

      <StarAt
        point={kink.one}
        color={starColor}
        size={7}
        opacity={0.52}
      />

      <StarAt
        point={kink.two}
        color={
          isRadioEdge
            ? accentColor
            : starColor
        }
        size={6}
        opacity={
          isRadioEdge
            ? 0.31
            : 0.41
        }
      />

      <StarAt
        point={branch}
        color={colors.white}
        size={5}
        opacity={0.25}
      />

      <StarAt
        point={softOne}
        color={colors.white}
        size={4}
        opacity={0.13}
      />

      <StarAt
        point={softTwo}
        color={
          isRadioEdge
            ? accentColor
            : colors.white
        }
        size={4}
        opacity={
          isRadioEdge
            ? 0.15
            : 0.12
        }
      />
    </View>
  );
}

function DraggableNode({
  definition,
  baseAnchor,
  committedOffset,
  displayOffset,
  width,
  glyphColor,
  accentColor,
  counterRotation,
  rotationDegreesRef,
  onLivePosition,
  onCommitPosition,
  onDraggingChange,
}: {
  definition: NodeDefinition;
  baseAnchor: Point;
  committedOffset: Point;
  displayOffset: Point;
  width: number;
  glyphColor: string;
  accentColor: string;
  counterRotation:
    Animated.AnimatedInterpolation<string>;
  rotationDegreesRef:
    MutableRefObject<number>;
  onLivePosition: (
    key: NodeKey,
    absoluteOffset: Point,
  ) => void;
  onCommitPosition: (
    key: NodeKey,
    absoluteOffset: Point,
  ) => void;
  onDraggingChange: (
    active: boolean,
  ) => void;
}) {
  const scale =
    useRef(
      new Animated.Value(1),
    ).current;

  const startOffsetRef =
    useRef<Point>(
      committedOffset,
    );

  const latestOffsetRef =
    useRef<Point>(
      committedOffset,
    );

  const movedRef =
    useRef(false);

  const pan =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => true,

          onStartShouldSetPanResponderCapture:
            () => true,

          onMoveShouldSetPanResponder:
            () => true,

          onMoveShouldSetPanResponderCapture:
            () => true,

          onPanResponderTerminationRequest:
            () => false,

          onShouldBlockNativeResponder:
            () => true,

          onPanResponderGrant:
            () => {
              movedRef.current =
                false;

              startOffsetRef.current =
                committedOffset;

              latestOffsetRef.current =
                committedOffset;

              onDraggingChange(
                true,
              );

              Animated.spring(
                scale,
                {
                  toValue: 1.03,
                  damping: 24,
                  stiffness: 115,
                  mass: 0.94,
                  useNativeDriver: true,
                },
              ).start();
            },

          onPanResponderMove: (
            _,
            gesture,
          ) => {
            const theta =
              (
                rotationDegreesRef.current *
                Math.PI
              ) /
              180;

            const cos =
              Math.cos(theta);
            const sin =
              Math.sin(theta);

            const localDx =
              gesture.dx * cos +
              gesture.dy * sin;

            const localDy =
              -gesture.dx * sin +
              gesture.dy * cos;

            if (
              Math.sqrt(
                localDx * localDx +
                  localDy * localDy,
              ) > 4
            ) {
              movedRef.current =
                true;
            }

            const proposed = {
              x:
                startOffsetRef.current.x +
                localDx,
              y:
                startOffsetRef.current.y +
                localDy,
            };

            const constrained =
              constrainAbsoluteOffset({
                baseAnchor,
                proposedOffset:
                  proposed,
                width,
              });

            latestOffsetRef.current =
              constrained;

            onLivePosition(
              definition.key,
              constrained,
            );
          },

          onPanResponderRelease:
            () => {
              onDraggingChange(
                false,
              );

              Animated.spring(
                scale,
                {
                  toValue: 1,
                  damping: 22,
                  stiffness: 105,
                  mass: 0.95,
                  useNativeDriver: true,
                },
              ).start();

              if (
                movedRef.current
              ) {
                /*
                 * Critical: commit EXACTLY the last live point.
                 * No release-delta recomputation = no teleport.
                 */
                onCommitPosition(
                  definition.key,
                  latestOffsetRef.current,
                );
              } else {
                onLivePosition(
                  definition.key,
                  committedOffset,
                );

                definition.onPress();
              }

              movedRef.current =
                false;
            },

          onPanResponderTerminate:
            () => {
              onDraggingChange(
                false,
              );

              onLivePosition(
                definition.key,
                committedOffset,
              );

              Animated.spring(
                scale,
                {
                  toValue: 1,
                  damping: 22,
                  stiffness: 105,
                  mass: 0.95,
                  useNativeDriver: true,
                },
              ).start();

              movedRef.current =
                false;
            },
        }),
      [
        baseAnchor,
        committedOffset,
        definition,
        onCommitPosition,
        onDraggingChange,
        onLivePosition,
        rotationDegreesRef,
        scale,
        width,
      ],
    );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.nodeAnchorHost,
        {
          left:
            baseAnchor.x -
            TOUCH_SIZE / 2,
          top:
            baseAnchor.y -
            TOUCH_SIZE / 2,
          transform: [
            {
              translateX:
                displayOffset.x,
            },
            {
              translateY:
                displayOffset.y,
            },
          ],
        },
      ]}
    >
      {/*
        Reserved tether layer. Kept structurally, intentionally invisible.
      */}
      <View
        pointerEvents="none"
        style={
          styles.hiddenTether
        }
      />

      <Animated.View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          definition.accessibilityLabel
        }
        onAccessibilityTap={
          definition.onPress
        }
        style={[
          styles.nodeTouchTarget,
          {
            transform: [
              {
                scale,
              },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.nodeVisual,
            {
              transform: [
                {
                  rotate:
                    counterRotation,
                },
              ],
            },
          ]}
        >
          {definition.key ===
          'radio' ? (
            <RadioConstellationNode
              color={glyphColor}
              accentColor={
                accentColor
              }
            />
          ) : (
            <WordConstellationNode
              kind={
                definition.key
              }
              color={glyphColor}
              accentColor={
                accentColor
              }
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function HomeConstellationWheel({
  accentColor,
  onOpenCatalogue,
  onOpenTopics,
  onOpenEntries,
  onOpenArchive,
  onOpenRadio,
}: Props) {
  const [
    width,
    setWidth,
  ] =
    useState(0);

  const [
    preferencesReady,
    setPreferencesReady,
  ] =
    useState(false);

  const [
    committedOffsets,
    setCommittedOffsets,
  ] =
    useState<NodeOffsetMap>(
      createZeroOffsets(),
    );

  const [
    displayOffsets,
    setDisplayOffsets,
  ] =
    useState<NodeOffsetMap>(
      createZeroOffsets(),
    );

  const rotation =
    useRef(
      new Animated.Value(0),
    ).current;

  const rotationDegreesRef =
    useRef(0);

  const rotationBase =
    useRef(0);

  const fieldShift =
    useRef(
      new Animated.ValueXY({
        x: 0,
        y: 0,
      }),
    ).current;

  const nodeDraggingRef =
    useRef(false);

  const anchorsRef =
    useRef<
      Record<
        NodeKey,
        Point
      > | null
    >(null);

  const widthRef =
    useRef(0);

  useEffect(
    () => {
      let active = true;

      void Promise.all([
        getHomeConstellationRotation(),
        getHomeConstellationNodeOffsets(),
      ])
        .then(
          ([
            savedRotation,
            savedOffsets,
          ]) => {
            if (!active) {
              return;
            }

            const normalized =
              normalizeOffsets(
                savedOffsets,
              );

            rotationBase.current =
              savedRotation;

            rotationDegreesRef.current =
              savedRotation;

            rotation.setValue(
              savedRotation,
            );

            setCommittedOffsets(
              normalized,
            );

            setDisplayOffsets(
              normalized,
            );

            setPreferencesReady(
              true,
            );
          },
        )
        .catch(
          () => {
            if (!active) {
              return;
            }

            setPreferencesReady(
              true,
            );
          },
        );

      return () => {
        active = false;
      };
    },
    [rotation],
  );

  const glyphColor =
    colors.text;

  const lineColor =
    colors.separator;

  const center = {
    x:
      width * 0.50,
    y:
      WHEEL_HEIGHT / 2,
  };

  const baseRadius =
    Math.min(
      Math.max(
        88,
        width * 0.30,
      ),
      118,
    );

  const definitions =
    useMemo<NodeDefinition[]>(
      () => [
        {
          key:
            'catalogue',
          accessibilityLabel:
            'Otvori katalog',
          angle: -126,
          radiusScale: 0.82,
          onPress:
            onOpenCatalogue,
        },
        {
          key:
            'topics',
          accessibilityLabel:
            'Otvori teme',
          angle: -18,
          radiusScale: 1.02,
          onPress:
            onOpenTopics,
        },
        {
          key:
            'entries',
          accessibilityLabel:
            'Otvori zapise',
          angle: 166,
          radiusScale: 0.93,
          onPress:
            onOpenEntries,
        },
        {
          key:
            'profile',
          accessibilityLabel:
            'Otvori arhiv',
          angle: 118,
          radiusScale: 0.90,
          onPress:
            onOpenArchive,
        },
        {
          key:
            'radio',
          accessibilityLabel:
            'Otvori Memory Radio',
          angle: 58,
          radiusScale: 1.38,
          onPress:
            onOpenRadio,
        },
      ],
      [
        onOpenArchive,
        onOpenCatalogue,
        onOpenEntries,
        onOpenRadio,
        onOpenTopics,
      ],
    );

  const baseAnchors =
    useMemo(
      () =>
        Object.fromEntries(
          definitions.map(
            (definition) => [
              definition.key,
              pointOnCircle(
                center,
                baseRadius *
                  definition.radiusScale,
                definition.angle,
              ),
            ],
          ),
        ) as Record<
          NodeKey,
          Point
        >,
      [
        baseRadius,
        center.x,
        center.y,
        definitions,
      ],
    );

  const anchors =
    useMemo(
      () =>
        Object.fromEntries(
          (
            Object.keys(
              baseAnchors,
            ) as NodeKey[]
          ).map(
            (key) => [
              key,
              addPoints(
                baseAnchors[key],
                displayOffsets[key],
              ),
            ],
          ),
        ) as Record<
          NodeKey,
          Point
        >,
      [
        baseAnchors,
        displayOffsets,
      ],
    );

  anchorsRef.current =
    anchors;

  widthRef.current =
    width;

  const rotateString =
    rotation.interpolate({
      inputRange: [
        -2160,
        2160,
      ],
      outputRange: [
        '-2160deg',
        '2160deg',
      ],
      extrapolate:
        'extend',
    });

  const counterRotation =
    rotation.interpolate({
      inputRange: [
        -2160,
        2160,
      ],
      outputRange: [
        '2160deg',
        '-2160deg',
      ],
      extrapolate:
        'extend',
    });

  const onLivePosition =
    useCallback(
      (
        key: NodeKey,
        absoluteOffset: Point,
      ) => {
        setDisplayOffsets(
          (previous) => ({
            ...previous,
            [key]:
              absoluteOffset,
          }),
        );
      },
      [],
    );

  const onCommitPosition =
    useCallback(
      (
        key: NodeKey,
        absoluteOffset: Point,
      ) => {
        setCommittedOffsets(
          (previous) => {
            const next = {
              ...previous,
              [key]:
                absoluteOffset,
            };

            void setHomeConstellationNodeOffsets(
              next,
            );

            return next;
          },
        );

        setDisplayOffsets(
          (previous) => ({
            ...previous,
            [key]:
              absoluteOffset,
          }),
        );
      },
      [],
    );

  const onDraggingChange =
    useCallback(
      (active: boolean) => {
        nodeDraggingRef.current =
          active;
      },
      [],
    );

  const updateFieldShiftFor =
    useCallback(
      (
        degrees: number,
        animated: boolean,
      ) => {
        const currentAnchors =
          anchorsRef.current;

        const currentWidth =
          widthRef.current;

        if (
          !currentAnchors ||
          currentWidth <= 0
        ) {
          return;
        }

        const currentCenter = {
          x:
            currentWidth * 0.50,
          y:
            WHEEL_HEIGHT / 2,
        };

        const nextShift =
          computeFieldShift({
            anchors:
              currentAnchors,
            center:
              currentCenter,
            width:
              currentWidth,
            rotation:
              degrees,
          });

        if (animated) {
          Animated.spring(
            fieldShift,
            {
              toValue:
                nextShift,
              damping: 23,
              stiffness: 112,
              mass: 0.96,
              restDisplacementThreshold: 0.4,
              restSpeedThreshold: 0.4,
              useNativeDriver: true,
            },
          ).start();
        } else {
          fieldShift.setValue(
            nextShift,
          );
        }
      },
      [fieldShift],
    );

  useEffect(
    () => {
      if (
        !preferencesReady ||
        width <= 0
      ) {
        return;
      }

      updateFieldShiftFor(
        rotationDegreesRef.current,
        false,
      );
    },
    [
      preferencesReady,
      updateFieldShiftFor,
      width,
    ],
  );

  const wheelPan =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => false,

          onMoveShouldSetPanResponder:
            (_, gesture) =>
              !nodeDraggingRef.current &&
              Math.abs(
                gesture.dx,
              ) +
                Math.abs(
                  gesture.dy,
                ) >
                8,

          onPanResponderGrant:
            () => {
              rotation.stopAnimation(
                (value) => {
                  rotationBase.current =
                    value;

                  rotationDegreesRef.current =
                    value;
                },
              );
            },

          onPanResponderMove:
            (_, gesture) => {
              const delta =
                gesture.dx *
                  ROTATION_X_GAIN +
                gesture.dy *
                  ROTATION_Y_GAIN;

              const next =
                rotationBase.current +
                delta;

              rotationDegreesRef.current =
                next;

              rotation.setValue(
                next,
              );

              updateFieldShiftFor(
                next,
                false,
              );
            },

          onPanResponderRelease:
            (_, gesture) => {
              const raw =
                rotationBase.current +
                gesture.dx *
                  ROTATION_X_GAIN +
                gesture.dy *
                  ROTATION_Y_GAIN;

              const snapped =
                Math.round(
                  raw / 90,
                ) *
                90;

              rotationBase.current =
                snapped;

              rotationDegreesRef.current =
                snapped;

              Animated.spring(
                rotation,
                {
                  toValue:
                    snapped,
                  damping: 20,
                  stiffness: 108,
                  mass: 0.95,
                  restDisplacementThreshold: 0.45,
                  restSpeedThreshold: 0.45,
                  useNativeDriver: true,
                },
              ).start();

              updateFieldShiftFor(
                snapped,
                true,
              );

              void setHomeConstellationRotation(
                snapped,
              );
            },

          onPanResponderTerminate:
            () => {
              rotationDegreesRef.current =
                rotationBase.current;

              Animated.spring(
                rotation,
                {
                  toValue:
                    rotationBase.current,
                  damping: 20,
                  stiffness: 108,
                  mass: 0.95,
                  restDisplacementThreshold: 0.45,
                  restSpeedThreshold: 0.45,
                  useNativeDriver: true,
                },
              ).start();

              updateFieldShiftFor(
                rotationBase.current,
                true,
              );
            },
        }),
      [
        rotation,
        updateFieldShiftFor,
      ],
    );

  const onLayout =
    (
      event: LayoutChangeEvent,
    ) => {
      const nextWidth =
        Math.round(
          event.nativeEvent.layout.width,
        );

      if (
        nextWidth > 0 &&
        nextWidth !== width
      ) {
        setWidth(
          nextWidth,
        );
      }
    };

  if (
    width <= 0 ||
    !preferencesReady
  ) {
    return (
      <View
        onLayout={onLayout}
        style={styles.root}
      />
    );
  }

  /*
   * Clean outer chart loop: no long interior crossing line.
   * Richness comes from 3 segments + local branches + stars.
   */
  const edges: EdgeDefinition[] = [
    {
      from: 'catalogue',
      to: 'topics',
      bendA: -12,
      bendB: 9,
      branchX: -4,
      branchY: -15,
    },
    {
      from: 'topics',
      to: 'radio',
      bendA: 16,
      bendB: -12,
      branchX: 14,
      branchY: -5,
      branchFromSecond: true,
    },
    {
      from: 'radio',
      to: 'profile',
      bendA: 13,
      bendB: -10,
      branchX: 8,
      branchY: 14,
    },
    {
      from: 'profile',
      to: 'entries',
      bendA: -11,
      bendB: 8,
      branchX: -13,
      branchY: 6,
      branchFromSecond: true,
    },
    {
      from: 'entries',
      to: 'catalogue',
      bendA: 11,
      bendB: -8,
      branchX: -11,
      branchY: -10,
    },
  ];

  return (
    <View
      onLayout={onLayout}
      style={styles.root}
    >
      <View
        {...wheelPan.panHandlers}
        style={
          StyleSheet.absoluteFill
        }
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.shiftField,
          {
            transform: [
              {
                translateX:
                  fieldShift.x,
              },
              {
                translateY:
                  fieldShift.y,
              },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.rotatingField,
            {
              transform: [
                {
                  rotate:
                    rotateString,
                },
              ],
            },
          ]}
        >
          {edges.map(
            (edge) => (
              <ChartConnection
                key={
                  edge.from +
                  '-' +
                  edge.to
                }
                edge={edge}
                from={
                  anchors[
                    edge.from
                  ]
                }
                to={
                  anchors[
                    edge.to
                  ]
                }
                lineColor={
                  lineColor
                }
                starColor={
                  glyphColor
                }
                accentColor={
                  accentColor
                }
              />
            ),
          )}

          <View
            pointerEvents="none"
            style={[
              styles.centerStar,
              {
                left:
                  center.x - 8,
                top:
                  center.y - 8,
              },
            ]}
          >
            <LjingleStar
              variant="spark"
              size={7}
              color={glyphColor}
              opacity={0.36}
            />

            <LjingleStar
              variant="spark"
              size={4}
              color={accentColor}
              opacity={0.16}
              style={
                styles.centerSatellite
              }
            />
          </View>

          {definitions.map(
            (definition) => (
              <DraggableNode
                key={
                  definition.key
                }
                definition={
                  definition
                }
                baseAnchor={
                  baseAnchors[
                    definition.key
                  ]
                }
                committedOffset={
                  committedOffsets[
                    definition.key
                  ]
                }
                displayOffset={
                  displayOffsets[
                    definition.key
                  ]
                }
                width={width}
                glyphColor={
                  glyphColor
                }
                accentColor={
                  accentColor
                }
                counterRotation={
                  counterRotation
                }
                rotationDegreesRef={
                  rotationDegreesRef
                }
                onLivePosition={
                  onLivePosition
                }
                onCommitPosition={
                  onCommitPosition
                }
                onDraggingChange={
                  onDraggingChange
                }
              />
            ),
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      position: 'relative',
      width: '100%',
      height: WHEEL_HEIGHT,
      marginTop: 2,
      marginBottom: 8,
      overflow: 'hidden',
    },

    shiftField: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'visible',
    },

    rotatingField: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'visible',
    },

    segment: {
      position: 'absolute',
      height:
        StyleSheet.hairlineWidth,
    },

    vertexStar: {
      position: 'absolute',
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },

    centerStar: {
      position: 'absolute',
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },

    centerSatellite: {
      position: 'absolute',
      right: -6,
      top: 1,
    },

    nodeAnchorHost: {
      position: 'absolute',
      width: TOUCH_SIZE,
      height: TOUCH_SIZE,
      overflow: 'visible',
      zIndex: 8,
    },

    nodeTouchTarget: {
      width: TOUCH_SIZE,
      height: TOUCH_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },

    nodeVisual: {
      width: TOUCH_SIZE,
      height: TOUCH_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    hiddenTether: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },

    wordConstellationNode: {
      position: 'relative',
      minWidth: 86,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    nodeWord: {
      maxWidth:
        TOUCH_SIZE - 8,
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
      letterSpacing: 1.08,
      opacity: 0.78,
    },

    wordStarMain: {
      position: 'absolute',
      left: -2,
      top: 2,
    },

    wordStarLow: {
      position: 'absolute',
      right: 2,
      bottom: 3,
    },

    wordStarAccent: {
      position: 'absolute',
      right: -4,
      top: 12,
    },

    radioConstellation: {
      position: 'relative',
      width: 92,
      height: 82,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    radioWord: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: -2,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '900',
      letterSpacing: 1.45,
      opacity: 0.78,
    },

    musicNote: {
      position: 'absolute',
      fontWeight: '700',
      opacity: 0.54,
    },

    musicNoteA: {
      left: 15,
      top: 13,
      fontSize: 23,
      transform: [
        {
          rotate: '-12deg',
        },
      ],
    },

    musicNoteB: {
      right: 11,
      top: 2,
      fontSize: 28,
      transform: [
        {
          rotate: '9deg',
        },
      ],
    },

    radioStarMain: {
      position: 'absolute',
      left: 40,
      top: 8,
    },

    radioStarA: {
      position: 'absolute',
      left: 7,
      top: 39,
    },

    radioStarB: {
      position: 'absolute',
      right: 3,
      top: 31,
    },
  });
