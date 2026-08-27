// sharingSimpleGraphCardV1_1

export type PortableShareChoice =
  | 'portable'
  | 'bridge'
  | 'visual';

export type PortableShareRequest = {
  id: number;
  title: string;
};

type Listener = (
  request:
    | PortableShareRequest
    | null,
) => void;

let listener:
  | Listener
  | null = null;

let active:
  | {
      request:
        PortableShareRequest;
      resolve: (
        choice:
          | PortableShareChoice
          | null,
      ) => void;
    }
  | null = null;

let nextRequestId = 1;

function publish(
  request:
    | PortableShareRequest
    | null,
) {
  listener?.(request);
}

export function subscribePortableShareSheet(
  next: Listener,
) {
  listener = next;

  publish(
    active?.request ??
      null,
  );

  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function requestPortableShareChoice(
  title: string,
) {
  if (
    active ||
    !listener
  ) {
    return Promise.resolve<
      PortableShareChoice |
      null
    >(null);
  }

  return new Promise<
    PortableShareChoice |
    null
  >((resolve) => {
    const request = {
      id:
        nextRequestId++,
      title,
    };

    active = {
      request,
      resolve,
    };

    publish(request);
  });
}

export function resolvePortableShareChoice(
  choice:
    | PortableShareChoice
    | null,
) {
  const current =
    active;

  if (!current) {
    return;
  }

  active = null;
  publish(null);

  current.resolve(choice);
}
