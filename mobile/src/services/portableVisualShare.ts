// sharingVisualGraphPortableFinalV1_1

import {
  File as ExpoFile,
  Paths,
} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type {
  LjinglePortablePackage,
  PortableObject,
  PortableRelationship,
} from '../types/portablePackage';

type RGB = [
  number,
  number,
  number,
];

type GraphEdge = {
  marker: 'TO' | 'FROM' | 'BOTH';
  label: string;
  object: PortableObject;
  relationship: PortableRelationship;
};

const PALETTE = {
  paper: [246, 244, 238] as RGB,
  ink: [25, 27, 31] as RGB,
  navy: [22, 36, 63] as RGB,
  gold: [194, 157, 73] as RGB,
  muted: [105, 105, 108] as RGB,
  line: [198, 194, 184] as RGB,
  white: [255, 255, 255] as RGB,
  soft: [234, 231, 223] as RGB,
};

function safeName(
  value: string,
) {
  return (
    value
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '-',
      )
      .replace(
        /-+/g,
        '-',
      )
      .replace(
        /^-|-$|^\.+|\.+$/g,
        '',
      )
      .slice(0, 70) ||
    'ljingle'
  );
}

function xml(
  value: unknown,
) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cleanAscii(
  value: unknown,
) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^\x20-\x7E]/g,
      '',
    )
    .trim();
}

function words(
  value: string,
  maxChars: number,
  maxLines: number,
) {
  const source =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const lines: string[] = [];
  let line = '';

  for (
    const word
    of source
  ) {
    const next =
      line
        ? line + ' ' + word
        : word;

    if (
      next.length <=
      maxChars
    ) {
      line = next;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    line = word;

    if (
      lines.length >=
      maxLines - 1
    ) {
      break;
    }
  }

  if (
    line &&
    lines.length <
      maxLines
  ) {
    lines.push(line);
  }

  if (
    lines.length ===
      maxLines &&
    source.join(' ').length >
      lines.join(' ').length
  ) {
    const last =
      lines.length - 1;

    const currentLastLine =
      lines[last] ?? '';

    lines[last] =
      currentLastLine
        .slice(
          0,
          Math.max(
            0,
            maxChars - 1,
          ),
        )
        .trimEnd() +
      '…';
  }

  return lines;
}

function relationLabel(
  relationType: string,
  outgoing: boolean,
) {
  switch (
    relationType
  ) {
    case 'INSPIRED_BY':
      return outgoing
        ? 'INSPIRED BY'
        : 'INSPIRES';

    case 'ABOUT':
      return outgoing
        ? 'ABOUT'
        : 'MENTIONED BY';

    case 'REFERENCES':
      return outgoing
        ? 'REFERENCES'
        : 'REFERENCED BY';

    case 'ADAPTATION_OF':
      return outgoing
        ? 'ADAPTATION OF'
        : 'ADAPTED AS';

    case 'REMEMBERED_WITH':
      return 'REMEMBERED WITH';

    case 'RELATED':
      return 'RELATED';

    default:
      return relationType
        .replaceAll(
          '_',
          ' ',
        )
        .toUpperCase();
  }
}

function rootObject(
  pack: LjinglePortablePackage,
) {
  return (
    pack.objects.find(
      (object) =>
        object.portableId ===
        pack.rootPortableId,
    ) ??
    pack.objects[0] ??
    null
  );
}

function connectionRows(
  pack: LjinglePortablePackage,
): GraphEdge[] {
  const symmetric =
    new Set([
      'RELATED',
      'REMEMBERED_WITH',
    ]);

  const rows: GraphEdge[] =
    [];

  const seen =
    new Set<string>();

  for (
    const relationship
    of pack.relationships
  ) {
    const outgoing =
      relationship.sourcePortableId ===
      pack.rootPortableId;

    const incoming =
      relationship.targetPortableId ===
      pack.rootPortableId;

    if (
      !outgoing &&
      !incoming
    ) {
      continue;
    }

    const otherPortableId =
      outgoing
        ? relationship.targetPortableId
        : relationship.sourcePortableId;

    const other =
      pack.objects.find(
        (object) =>
          object.portableId ===
          otherPortableId,
      );

    if (!other) {
      continue;
    }

    const dedupeKey =
      other.portableId +
      ':' +
      relationship.relationType;

    if (
      seen.has(
        dedupeKey,
      )
    ) {
      continue;
    }

    seen.add(
      dedupeKey,
    );

    rows.push({
      marker:
        symmetric.has(
          relationship.relationType,
        )
          ? 'BOTH'
          : outgoing
            ? 'TO'
            : 'FROM',
      label:
        relationLabel(
          relationship.relationType,
          outgoing,
        ),
      object: other,
      relationship,
    });

    if (
      rows.length >= 8
    ) {
      break;
    }
  }

  return rows;
}

function graphPosition(
  index: number,
  count: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const total =
    Math.max(
      1,
      count,
    );

  const angle =
    -Math.PI / 2 +
    (
      (
        Math.PI * 2
      ) /
      total
    ) *
      index;

  return {
    x:
      centerX +
      Math.cos(angle) *
        radius,
    y:
      centerY +
      Math.sin(angle) *
        radius,
  };
}

function entityLabel(
  object: PortableObject,
) {
  switch (
    object.entityType
  ) {
    case 'BOOK':
      return 'BOOK';
    case 'MEDIA':
      return 'MEDIA';
    case 'GAME':
      return 'GAME';
    case 'TOPIC':
      return 'TOPIC';
    case 'ENTRY':
      return 'NOTE';
    case 'FREQUENCY':
      return 'AUDIO';
    case 'COLLECTION':
      return 'COLLECTION';
    default:
      return object.entityType;
  }
}

function simpleGraphPositions(
  count: number,
  centerX: number,
  centerY: number,
  xRadius: number,
  yRadius: number,
) {
  const presets: Array<
    Array<[number, number]>
  > = [
    [],
    [[0, -1]],
    [
      [-1, 0],
      [1, 0],
    ],
    [
      [0, -1],
      [-1, 0],
      [1, 0],
    ],
    [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, -1],
      [-1, -0.15],
      [1, -0.15],
      [-0.6, 0.95],
      [0.6, 0.95],
    ],
    [
      [0, -1],
      [-0.95, -0.35],
      [0.95, -0.35],
      [-0.95, 0.75],
      [0.95, 0.75],
      [0, 1],
    ],
  ];

  const safeCount =
    Math.max(
      0,
      Math.min(
        6,
        count,
      ),
    );

  const points =
    presets[safeCount] ??
    [];

  return points.map(
    ([dx, dy]) => ({
      x:
        centerX +
        dx * xRadius,
      y:
        centerY +
        dy * yRadius,
    }),
  );
}

export function portableVisualSvg(
  pack: LjinglePortablePackage,
) {
  const width = 1080;
  const height = 1350;

  const root =
    rootObject(pack);

  const edges =
    connectionRows(pack)
      .slice(0, 6);

  const cx = 540;
  const cy = 735;

  const positions =
    simpleGraphPositions(
      edges.length,
      cx,
      cy,
      325,
      305,
    );

  const rootLines =
    words(
      root?.title ??
        pack.title,
      20,
      3,
    );

  const titleLines =
    words(
      pack.title,
      30,
      2,
    );

  const lines =
    positions
      .map(
        (
          position,
          index,
        ) => {
          const edge =
            edges[index];

          if (!edge) {
            return '';
          }

          const mx =
            (
              cx +
              position.x
            ) /
            2;

          const my =
            (
              cy +
              position.y
            ) /
            2;

          return `
            <line
              x1="${cx}"
              y1="${cy}"
              x2="${position.x}"
              y2="${position.y}"
              class="line"
            />

            <circle
              cx="${mx}"
              cy="${my}"
              r="8"
              class="junction"
            />

            <text
              x="${mx}"
              y="${my - 18}"
              text-anchor="middle"
              class="relation"
            >${xml(words(edge.label, 18, 1)[0] ?? '')}</text>
          `;
        },
      )
      .join('');

  const nodes =
    positions
      .map(
        (
          position,
          index,
        ) => {
          const edge =
            edges[index];

          if (!edge) {
            return '';
          }

          const nodeLines =
            words(
              edge.object.title,
              15,
              2,
            );

          return `
            <circle
              cx="${position.x}"
              cy="${position.y}"
              r="70"
              class="node"
            />

            <text
              x="${position.x}"
              y="${position.y - 14}"
              text-anchor="middle"
              class="type"
            >${xml(entityLabel(edge.object))}</text>

            ${nodeLines
              .map(
                (
                  line,
                  lineIndex,
                ) =>
                  `<text
                    x="${position.x}"
                    y="${position.y + 20 + lineIndex * 24}"
                    text-anchor="middle"
                    class="nodeTitle"
                  >${xml(line)}</text>`,
              )
              .join('')}
          `;
        },
      )
      .join('');

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
  >
    <style>
      .paper {
        fill: #F7F2E8;
      }

      .border {
        fill: none;
        stroke: #C39A4A;
        stroke-width: 2;
      }

      .header,
      .meta,
      .relation,
      .type,
      .footer {
        font-family: "Courier New", monospace;
        letter-spacing: 4px;
      }

      .header {
        fill: #10264A;
        font-size: 23px;
        font-weight: 700;
      }

      .title {
        fill: #10264A;
        font-family: Georgia, serif;
        font-size: 63px;
        letter-spacing: 8px;
      }

      .meta {
        fill: #10264A;
        font-size: 19px;
        font-weight: 700;
      }

      .line {
        stroke: #10264A;
        stroke-width: 2;
      }

      .junction {
        fill: #C39A4A;
      }

      .relation {
        fill: #8B6A2A;
        font-size: 13px;
        letter-spacing: 1px;
      }

      .node {
        fill: #F7F2E8;
        stroke: #10264A;
        stroke-width: 2;
      }

      .rootNode {
        fill: #F7F2E8;
        stroke: #10264A;
        stroke-width: 3;
      }

      .type {
        fill: #B38331;
        font-size: 15px;
        font-weight: 700;
      }

      .nodeTitle {
        fill: #10264A;
        font-family: Georgia, serif;
        font-size: 19px;
      }

      .rootTitle {
        fill: #10264A;
        font-family: Georgia, serif;
        font-size: 28px;
        font-weight: 700;
      }

      .footer {
        fill: #10264A;
        font-size: 15px;
      }

      .footerBrand {
        fill: #10264A;
        font-family: Georgia, serif;
        font-size: 25px;
        letter-spacing: 6px;
      }
    </style>

    <rect
      width="${width}"
      height="${height}"
      class="paper"
    />

    <rect
      x="26"
      y="26"
      width="${width - 52}"
      height="${height - 52}"
      rx="18"
      class="border"
    />

    <text
      x="90"
      y="105"
      class="header"
    >${xml((root ? entityLabel(root) : pack.kind) + '  MEMORY GRAPH')}</text>

    ${titleLines
      .map(
        (
          line,
          index,
        ) =>
          `<text
            x="90"
            y="${190 + index * 70}"
            class="title"
          >${xml(line)}</text>`,
      )
      .join('')}

    <text
      x="90"
      y="340"
      class="meta"
    >${pack.objects.length} OBJECTS   ·   ${pack.relationships.length} RELATIONS   ·   ${pack.assets.length} ASSETS</text>

    ${lines}
    ${nodes}

    <circle
      cx="${cx}"
      cy="${cy}"
      r="108"
      class="rootNode"
    />

    <text
      x="${cx}"
      y="${cy - 54}"
      text-anchor="middle"
      class="type"
    >${xml(root ? entityLabel(root) : pack.kind)}</text>

    ${rootLines
      .map(
        (
          line,
          index,
        ) =>
          `<text
            x="${cx}"
            y="${cy - 10 + index * 34}"
            text-anchor="middle"
            class="rootTitle"
          >${xml(line)}</text>`,
      )
      .join('')}

    <line
      x1="90"
      y1="1230"
      x2="990"
      y2="1230"
      class="border"
    />

    <circle
      cx="540"
      cy="1230"
      r="5"
      class="junction"
    />

    <text
      x="90"
      y="1283"
      class="footer"
    >${pack.provenance ? 'STABLE ORIGIN   DIRECTED GRAPH' : 'PORTABLE MEMORY GRAPH'}</text>

    <text
      x="990"
      y="1283"
      text-anchor="end"
      class="footerBrand"
    >LJINGLE</text>
  </svg>`;
}

// -------------------------------------------------------------------------
// Tiny deterministic bitmap font for native PNG output.
// Social share targets want PNG/JPEG; SVG often disappears from their chooser.
// -------------------------------------------------------------------------

const FONT:
  Record<
    string,
    string[]
  > = {
  ' ': [
    '00000','00000','00000','00000','00000','00000','00000',
  ],
  'A': [
    '01110','10001','10001','11111','10001','10001','10001',
  ],
  'B': [
    '11110','10001','10001','11110','10001','10001','11110',
  ],
  'C': [
    '01111','10000','10000','10000','10000','10000','01111',
  ],
  'D': [
    '11110','10001','10001','10001','10001','10001','11110',
  ],
  'E': [
    '11111','10000','10000','11110','10000','10000','11111',
  ],
  'F': [
    '11111','10000','10000','11110','10000','10000','10000',
  ],
  'G': [
    '01111','10000','10000','10111','10001','10001','01111',
  ],
  'H': [
    '10001','10001','10001','11111','10001','10001','10001',
  ],
  'I': [
    '11111','00100','00100','00100','00100','00100','11111',
  ],
  'J': [
    '00111','00010','00010','00010','10010','10010','01100',
  ],
  'K': [
    '10001','10010','10100','11000','10100','10010','10001',
  ],
  'L': [
    '10000','10000','10000','10000','10000','10000','11111',
  ],
  'M': [
    '10001','11011','10101','10101','10001','10001','10001',
  ],
  'N': [
    '10001','11001','10101','10011','10001','10001','10001',
  ],
  'O': [
    '01110','10001','10001','10001','10001','10001','01110',
  ],
  'P': [
    '11110','10001','10001','11110','10000','10000','10000',
  ],
  'Q': [
    '01110','10001','10001','10001','10101','10010','01101',
  ],
  'R': [
    '11110','10001','10001','11110','10100','10010','10001',
  ],
  'S': [
    '01111','10000','10000','01110','00001','00001','11110',
  ],
  'T': [
    '11111','00100','00100','00100','00100','00100','00100',
  ],
  'U': [
    '10001','10001','10001','10001','10001','10001','01110',
  ],
  'V': [
    '10001','10001','10001','10001','10001','01010','00100',
  ],
  'W': [
    '10001','10001','10001','10101','10101','11011','10001',
  ],
  'X': [
    '10001','10001','01010','00100','01010','10001','10001',
  ],
  'Y': [
    '10001','10001','01010','00100','00100','00100','00100',
  ],
  'Z': [
    '11111','00001','00010','00100','01000','10000','11111',
  ],
  '0': [
    '01110','10001','10011','10101','11001','10001','01110',
  ],
  '1': [
    '00100','01100','00100','00100','00100','00100','01110',
  ],
  '2': [
    '01110','10001','00001','00010','00100','01000','11111',
  ],
  '3': [
    '11110','00001','00001','01110','00001','00001','11110',
  ],
  '4': [
    '00010','00110','01010','10010','11111','00010','00010',
  ],
  '5': [
    '11111','10000','10000','11110','00001','00001','11110',
  ],
  '6': [
    '01110','10000','10000','11110','10001','10001','01110',
  ],
  '7': [
    '11111','00001','00010','00100','01000','01000','01000',
  ],
  '8': [
    '01110','10001','10001','01110','10001','10001','01110',
  ],
  '9': [
    '01110','10001','10001','01111','00001','00001','01110',
  ],
  '-': [
    '00000','00000','00000','11111','00000','00000','00000',
  ],
  '.': [
    '00000','00000','00000','00000','00000','00110','00110',
  ],
  ':': [
    '00000','00110','00110','00000','00110','00110','00000',
  ],
  '#': [
    '01010','01010','11111','01010','11111','01010','01010',
  ],
  '@': [
    '01110','10001','10111','10101','10111','10000','01111',
  ],
  '/': [
    '00001','00010','00100','01000','10000','00000','00000',
  ],
  '+': [
    '00000','00100','00100','11111','00100','00100','00000',
  ],
  '&': [
    '01100','10010','10100','01000','10101','10010','01101',
  ],
  '?': [
    '01110','10001','00001','00010','00100','00000','00100',
  ],
};

function bitmapText(
  value: string,
) {
  return (
    cleanAscii(value)
      .toUpperCase() ||
    '?'
  );
}

function createCanvas(
  width: number,
  height: number,
  color: RGB,
) {
  const pixels =
    new Uint8Array(
      width *
        height *
        3,
    );

  for (
    let offset = 0;
    offset <
    pixels.length;
    offset += 3
  ) {
    pixels[offset] =
      color[0];

    pixels[offset + 1] =
      color[1];

    pixels[offset + 2] =
      color[2];
  }

  return pixels;
}

function putPixel(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGB,
) {
  const px =
    Math.round(x);

  const py =
    Math.round(y);

  if (
    px < 0 ||
    py < 0 ||
    px >= width ||
    py >= height
  ) {
    return;
  }

  const offset =
    (
      py * width +
      px
    ) *
    3;

  pixels[offset] =
    color[0];

  pixels[offset + 1] =
    color[1];

  pixels[offset + 2] =
    color[2];
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: RGB,
) {
  const x0 =
    Math.max(
      0,
      Math.floor(x),
    );

  const y0 =
    Math.max(
      0,
      Math.floor(y),
    );

  const x1 =
    Math.min(
      width,
      Math.ceil(
        x +
        rectWidth,
      ),
    );

  const y1 =
    Math.min(
      height,
      Math.ceil(
        y +
        rectHeight,
      ),
    );

  for (
    let py = y0;
    py < y1;
    py += 1
  ) {
    for (
      let px = x0;
      px < x1;
      px += 1
    ) {
      putPixel(
        pixels,
        width,
        height,
        px,
        py,
        color,
      );
    }
  }
}

function drawLine(
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGB,
  thickness = 1,
) {
  let ax =
    Math.round(x0);

  let ay =
    Math.round(y0);

  const bx =
    Math.round(x1);

  const by =
    Math.round(y1);

  const dx =
    Math.abs(
      bx - ax,
    );

  const sx =
    ax < bx
      ? 1
      : -1;

  const dy =
    -Math.abs(
      by - ay,
    );

  const sy =
    ay < by
      ? 1
      : -1;

  let err =
    dx + dy;

  while (true) {
    fillRect(
      pixels,
      width,
      height,
      ax -
        Math.floor(
          thickness / 2,
        ),
      ay -
        Math.floor(
          thickness / 2,
        ),
      thickness,
      thickness,
      color,
    );

    if (
      ax === bx &&
      ay === by
    ) {
      break;
    }

    const e2 =
      2 * err;

    if (
      e2 >= dy
    ) {
      err += dy;
      ax += sx;
    }

    if (
      e2 <= dx
    ) {
      err += dx;
      ay += sy;
    }
  }
}

function fillCircle(
  pixels: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: RGB,
) {
  const r2 =
    radius *
    radius;

  const minY =
    Math.floor(
      cy - radius,
    );

  const maxY =
    Math.ceil(
      cy + radius,
    );

  for (
    let y = minY;
    y <= maxY;
    y += 1
  ) {
    const dy =
      y - cy;

    const span =
      Math.sqrt(
        Math.max(
          0,
          r2 -
            dy * dy,
        ),
      );

    const minX =
      Math.ceil(
        cx - span,
      );

    const maxX =
      Math.floor(
        cx + span,
      );

    for (
      let x = minX;
      x <= maxX;
      x += 1
    ) {
      putPixel(
        pixels,
        width,
        height,
        x,
        y,
        color,
      );
    }
  }
}

function strokeCircle(
  pixels: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  color: RGB,
  inner: RGB,
) {
  fillCircle(
    pixels,
    width,
    height,
    cx,
    cy,
    radius,
    color,
  );

  fillCircle(
    pixels,
    width,
    height,
    cx,
    cy,
    Math.max(
      0,
      radius -
        thickness,
    ),
    inner,
  );
}

function drawGlyph(
  pixels: Uint8Array,
  width: number,
  height: number,
  char: string,
  x: number,
  y: number,
  scale: number,
  color: RGB,
) {
  const glyph =
    FONT[char] ??
    FONT['?'];

  if (!glyph) {
    return;
  }

  for (
    let row = 0;
    row <
    glyph.length;
    row += 1
  ) {
    const line =
      glyph[row];

    if (!line) {
      continue;
    }

    for (
      let col = 0;
      col <
      line.length;
      col += 1
    ) {
      if (
        line[col] !== '1'
      ) {
        continue;
      }

      fillRect(
        pixels,
        width,
        height,
        x +
          col * scale,
        y +
          row * scale,
        scale,
        scale,
        color,
      );
    }
  }
}

function measureText(
  value: string,
  scale: number,
) {
  const text =
    bitmapText(value);

  if (!text) return 0;

  return (
    text.length *
      6 *
      scale -
    scale
  );
}

function drawText(
  pixels: Uint8Array,
  width: number,
  height: number,
  value: string,
  x: number,
  y: number,
  scale: number,
  color: RGB,
  options?: {
    center?: boolean;
    maxChars?: number;
  },
) {
  let text =
    bitmapText(value);

  if (
    options?.maxChars &&
    text.length >
      options.maxChars
  ) {
    text =
      text.slice(
        0,
        Math.max(
          1,
          options.maxChars -
            1,
        ),
      ) +
      '.';
  }

  let cursorX =
    options?.center
      ? x -
        measureText(
          text,
          scale,
        ) /
          2
      : x;

  for (
    const char
    of text
  ) {
    drawGlyph(
      pixels,
      width,
      height,
      char,
      cursorX,
      y,
      scale,
      color,
    );

    cursorX +=
      6 * scale;
  }
}

function pngCrc32(
  data: Uint8Array,
) {
  let crc =
    0xffffffff;

  for (
    const byte
    of data
  ) {
    crc ^= byte;

    for (
      let bit = 0;
      bit < 8;
      bit += 1
    ) {
      crc =
        (
          crc >>> 1
        ) ^
        (
          crc & 1
            ? 0xedb88320
            : 0
        );
    }
  }

  return (
    crc ^ 0xffffffff
  ) >>> 0;
}

function be32(
  value: number,
) {
  return new Uint8Array([
    (
      value >> 24
    ) & 255,
    (
      value >> 16
    ) & 255,
    (
      value >> 8
    ) & 255,
    value & 255,
  ]);
}

function concatBytes(
  parts: Uint8Array[],
) {
  const length =
    parts.reduce(
      (
        total,
        part,
      ) =>
        total +
        part.length,
      0,
    );

  const output =
    new Uint8Array(
      length,
    );

  let offset = 0;

  for (
    const part
    of parts
  ) {
    output.set(
      part,
      offset,
    );

    offset +=
      part.length;
  }

  return output;
}

function asciiBytes(
  value: string,
) {
  return new Uint8Array(
    [...value].map(
      (char) =>
        char.charCodeAt(
          0,
        ) & 255,
    ),
  );
}

function pngChunk(
  type: string,
  data: Uint8Array,
) {
  const typeBytes =
    asciiBytes(type);

  const body =
    concatBytes([
      typeBytes,
      data,
    ]);

  return concatBytes([
    be32(data.length),
    body,
    be32(
      pngCrc32(body),
    ),
  ]);
}

function adler32(
  data: Uint8Array,
) {
  let a = 1;
  let b = 0;

  for (
    const byte
    of data
  ) {
    a =
      (
        a + byte
      ) %
      65521;

    b =
      (
        b + a
      ) %
      65521;
  }

  return (
    (
      b << 16
    ) |
    a
  ) >>> 0;
}

function zlibStored(
  data: Uint8Array,
) {
  const chunks:
    Uint8Array[] = [
      new Uint8Array([
        0x78,
        0x01,
      ]),
    ];

  let offset = 0;

  while (
    offset <
    data.length
  ) {
    const remaining =
      data.length -
      offset;

    const size =
      Math.min(
        65535,
        remaining,
      );

    const final =
      offset +
        size >=
      data.length;

    const nlen =
      (
        ~size
      ) & 0xffff;

    chunks.push(
      new Uint8Array([
        final
          ? 0x01
          : 0x00,
        size & 255,
        (
          size >> 8
        ) & 255,
        nlen & 255,
        (
          nlen >> 8
        ) & 255,
      ]),
    );

    chunks.push(
      data.slice(
        offset,
        offset +
          size,
      ),
    );

    offset +=
      size;
  }

  chunks.push(
    be32(
      adler32(data),
    ),
  );

  return concatBytes(
    chunks,
  );
}

function encodePng(
  width: number,
  height: number,
  pixels: Uint8Array,
) {
  const stride =
    width * 3;

  const raw =
    new Uint8Array(
      height *
        (
          stride + 1
        ),
    );

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    const rawOffset =
      y *
      (
        stride + 1
      );

    raw[rawOffset] = 0;

    raw.set(
      pixels.subarray(
        y * stride,
        (
          y + 1
        ) *
          stride,
      ),
      rawOffset + 1,
    );
  }

  const ihdr =
    new Uint8Array(
      13,
    );

  ihdr.set(
    be32(width),
    0,
  );

  ihdr.set(
    be32(height),
    4,
  );

  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    new Uint8Array([
      137, 80, 78, 71,
      13, 10, 26, 10,
    ]),
    pngChunk(
      'IHDR',
      ihdr,
    ),
    pngChunk(
      'IDAT',
      zlibStored(raw),
    ),
    pngChunk(
      'IEND',
      new Uint8Array(),
    ),
  ]);
}

export function portableVisualPng(
  pack: LjinglePortablePackage,
) {
  const width = 720;
  const height = 900;

  const pixels =
    createCanvas(
      width,
      height,
      PALETTE.paper,
    );

  // Simple editorial border. No LJ sidebar.
  drawLine(
    pixels,
    width,
    height,
    18,
    18,
    width - 18,
    18,
    PALETTE.gold,
    1,
  );

  drawLine(
    pixels,
    width,
    height,
    18,
    18,
    18,
    height - 18,
    PALETTE.gold,
    1,
  );

  drawLine(
    pixels,
    width,
    height,
    width - 18,
    18,
    width - 18,
    height - 18,
    PALETTE.gold,
    1,
  );

  drawLine(
    pixels,
    width,
    height,
    18,
    height - 18,
    width - 18,
    height - 18,
    PALETTE.gold,
    1,
  );

  // authVisualCardCelestialV1: celestial archive frame from the canonical LJingle visual language.
  const stars = [
    [56, 64], [115, 104], [178, 58], [548, 74], [622, 118], [671, 62],
    [64, 774], [130, 820], [586, 808], [658, 764],
  ] as Array<[number, number]>;
  stars.forEach(([x, y], index) => {
    fillCircle(pixels, width, height, x, y, index % 3 === 0 ? 3 : 2, PALETTE.gold);
  });
  drawLine(pixels, width, height, 56, 64, 115, 104, PALETTE.gold, 1);
  drawLine(pixels, width, height, 115, 104, 178, 58, PALETTE.gold, 1);
  drawLine(pixels, width, height, 548, 74, 622, 118, PALETTE.gold, 1);
  drawLine(pixels, width, height, 622, 118, 671, 62, PALETTE.gold, 1);

  // Bell seal: loop, crown, body, rim, clapper and central star.
  strokeCircle(pixels, width, height, 360, 55, 11, 2, PALETTE.navy, PALETTE.paper);
  strokeCircle(pixels, width, height, 360, 88, 29, 2, PALETTE.navy, PALETTE.paper);
  drawLine(pixels, width, height, 329, 84, 391, 84, PALETTE.navy, 2);
  drawLine(pixels, width, height, 352, 116, 368, 116, PALETTE.navy, 2);
  fillCircle(pixels, width, height, 360, 119, 4, PALETTE.gold);
  drawLine(pixels, width, height, 354, 88, 366, 88, PALETTE.gold, 2);
  drawLine(pixels, width, height, 360, 82, 360, 94, PALETTE.gold, 2);

  const root =
    rootObject(pack);

  const edges =
    connectionRows(pack)
      .slice(0, 6);

  drawText(
    pixels, width, height, 'LJINGLE', 360, 135, 3, PALETTE.navy,
    { center: true, maxChars: 12 },
  );
  drawLine(pixels, width, height, 300, 164, 344, 164, PALETTE.gold, 1);
  fillCircle(pixels, width, height, 360, 164, 4, PALETTE.gold);
  drawLine(pixels, width, height, 376, 164, 420, 164, PALETTE.gold, 1);
  drawText(
    pixels, width, height,
    (root ? entityLabel(root) : pack.kind) + '  MEMORY GRAPH',
    360, 184, 1, PALETTE.gold,
    { center: true, maxChars: 38 },
  );

  const titleLines =
    words(
      bitmapText(
        pack.title,
      ),
      28,
      2,
    );

  titleLines.forEach(
    (
      line,
      index,
    ) =>
      drawText(
        pixels,
        width,
        height,
        line,
        360,
        214 +
          index * 34,
        4,
        PALETTE.navy,
        {
          center: true,
          maxChars: 28,
        },
      ),
  );

  drawText(
    pixels,
    width,
    height,
    pack.objects.length +
      ' OBJECTS  ' +
      pack.relationships.length +
      ' RELATIONS  ' +
      pack.assets.length +
      ' ASSETS',
    360,
    294,
    2,
    PALETTE.navy,
    {
      center: true,
      maxChars: 48,
    },
  );

  const cx = 360;
  const cy = 520;

  const positions =
    simpleGraphPositions(
      edges.length,
      cx,
      cy,
      235,
      215,
    );

  positions.forEach(
    (
      position,
      index,
    ) => {
      const edge =
        edges[index];

      if (!edge) {
        return;
      }

      drawLine(
        pixels,
        width,
        height,
        cx,
        cy,
        position.x,
        position.y,
        PALETTE.navy,
        2,
      );

      const mx =
        (
          cx +
          position.x
        ) /
        2;

      const my =
        (
          cy +
          position.y
        ) /
        2;

      fillCircle(
        pixels,
        width,
        height,
        mx,
        my,
        5,
        PALETTE.gold,
      );

      drawText(
        pixels,
        width,
        height,
        edge.label,
        mx,
        my - 15,
        1,
        PALETTE.gold,
        {
          center: true,
          maxChars: 16,
        },
      );
    },
  );

  positions.forEach(
    (
      position,
      index,
    ) => {
      const edge =
        edges[index];

      if (!edge) {
        return;
      }

      strokeCircle(
        pixels,
        width,
        height,
        position.x,
        position.y,
        47,
        2,
        PALETTE.navy,
        PALETTE.paper,
      );

      drawText(
        pixels,
        width,
        height,
        entityLabel(
          edge.object,
        ),
        position.x,
        position.y - 23,
        1,
        PALETTE.gold,
        {
          center: true,
          maxChars: 12,
        },
      );

      const nodeLines =
        words(
          bitmapText(
            edge.object.title,
          ),
          14,
          2,
        );

      nodeLines.forEach(
        (
          line,
          lineIndex,
        ) =>
          drawText(
            pixels,
            width,
            height,
            line,
            position.x,
            position.y +
              2 +
              lineIndex *
                13,
            1,
            PALETTE.navy,
            {
              center: true,
              maxChars: 14,
            },
          ),
      );
    },
  );

  // Root is deliberately only slightly larger:
  // it reads as a graph node, not a decorative medallion.
  strokeCircle(
    pixels,
    width,
    height,
    cx,
    cy,
    82,
    3,
    PALETTE.navy,
    PALETTE.paper,
  );

  drawText(
    pixels,
    width,
    height,
    root
      ? entityLabel(root)
      : pack.kind,
    cx,
    cy - 44,
    1,
    PALETTE.gold,
    {
      center: true,
      maxChars: 12,
    },
  );

  const rootLines =
    words(
      bitmapText(
        root?.title ??
          pack.title,
      ),
      18,
      3,
    );

  rootLines.forEach(
    (
      line,
      index,
    ) =>
      drawText(
        pixels,
        width,
        height,
        line,
        cx,
        cy -
          9 +
          index *
            18,
        2,
        PALETTE.navy,
        {
          center: true,
          maxChars: 18,
        },
      ),
  );

  if (
    edges.length === 0
  ) {
    drawText(
      pixels,
      width,
      height,
      'NO DIRECT CONNECTIONS',
      cx,
      cy + 112,
      1,
      PALETTE.muted,
      {
        center: true,
        maxChars: 26,
      },
    );
  }

  drawLine(
    pixels,
    width,
    height,
    54,
    826,
    666,
    826,
    PALETTE.gold,
    1,
  );

  fillCircle(
    pixels,
    width,
    height,
    360,
    826,
    4,
    PALETTE.gold,
  );

  drawText(
    pixels,
    width,
    height,
    pack.provenance
      ? 'STABLE ORIGIN  DIRECTED GRAPH'
      : 'PORTABLE MEMORY GRAPH',
    54,
    850,
    1,
    PALETTE.navy,
    {
      maxChars: 36,
    },
  );

  drawText(
    pixels,
    width,
    height,
    'LJINGLE',
    666,
    850,
    2,
    PALETTE.navy,
    {
      center: true,
      maxChars: 12,
    },
  );

  return encodePng(
    width,
    height,
    pixels,
  );
}

async function webShareOrDownloadPng(
  png: Uint8Array,
  filename: string,
  title: string,
) {
  const web =
    globalThis as unknown as {
      Blob?: typeof Blob;
      File?: new (
        bits: BlobPart[],
        name: string,
        options?: FilePropertyBag,
      ) => globalThis.File;
      URL?: typeof URL;
      document?: Document;
      navigator?: Navigator & {
        canShare?: (
          data: ShareData,
        ) => boolean;
      };
    };

  if (
    !web.Blob
  ) {
    throw new Error(
      'Web PNG export nije dostupan.',
    );
  }

  const pngBuffer =
    new ArrayBuffer(
      png.byteLength,
    );

  new Uint8Array(
    pngBuffer,
  ).set(png);

  const blob =
    new web.Blob(
      [pngBuffer],
      {
        type: 'image/png',
      },
    );

  if (
    web.File &&
    web.navigator?.share &&
    web.navigator.canShare
  ) {
    const file =
      new web.File(
        [blob],
        filename,
        {
          type: 'image/png',
        },
      );

    const data: ShareData = {
      title,
      files: [file],
    };

    if (
      web.navigator.canShare(
        data,
      )
    ) {
      await web.navigator.share(
        data,
      );

      return filename;
    }
  }

  if (
    !web.URL ||
    !web.document
  ) {
    throw new Error(
      'Web download nije dostupan.',
    );
  }

  const href =
    web.URL.createObjectURL(
      blob,
    );

  const anchor =
    web.document.createElement(
      'a',
    );

  anchor.href = href;
  anchor.download = filename;
  anchor.click();

  web.URL.revokeObjectURL(
    href,
  );

  return filename;
}

export async function sharePortableVisualCard(
  pack: LjinglePortablePackage,
) {
  const filename =
    safeName(pack.title) +
    '-ljingle-graph.png';

  const png =
    portableVisualPng(pack);

  if (
    Platform.OS === 'web'
  ) {
    return webShareOrDownloadPng(
      png,
      filename,
      pack.title,
    );
  }

  const file =
    new ExpoFile(
      Paths.cache,
      filename,
    );

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(png);

  const available =
    await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error(
      'System share nije dostupan na ovom uređaju.',
    );
  }

  await Sharing.shareAsync(
    file.uri,
    {
      dialogTitle:
        'Share LJingle visual graph',
      mimeType: 'image/png',
      UTI: 'public.png',
    },
  );

  return filename;
}

// sharingSimpleGraphCardV1_1
