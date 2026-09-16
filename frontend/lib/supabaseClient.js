import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://placeholder.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'public-anon-key-placeholder';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Backend API
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

// Optional fallback API
export const API_FALLBACK_URL =
  process.env.NEXT_PUBLIC_API_FALLBACK_URL || '';

const API_TIMEOUT_MS = parseInt(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '20000',
  10
);

/**
 * Fetch API with optional fallback.
 */
export async function fetchApi(
  path,
  options = {}
) {
  const targets =
    API_FALLBACK_URL &&
    API_FALLBACK_URL !== API_URL
      ? [API_URL, API_FALLBACK_URL]
      : [API_URL];

  let lastRes = null;

  for (
    let i = 0;
    i < targets.length;
    i++
  ) {
    const base = targets[i];

    const isLast =
      i === targets.length - 1;

    const signal =
      !isLast && API_TIMEOUT_MS > 0
        ? AbortSignal.timeout(API_TIMEOUT_MS)
        : options.signal;

    try {
      const res = await fetch(
        `${base}${path}`,
        signal
          ? {
              ...options,
              signal,
            }
          : options
      );

      const gatewayDown =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504;

      if (!gatewayDown || isLast) {
        return res;
      }

      lastRes = res;

    } catch (error) {
      // Try fallback if available.
    }
  }

  if (lastRes) {
    return lastRes;
  }

  throw new Error(
    `Cannot reach API at ${targets.join(
      ' or '
    )}${path}`
  );
}

/**
 * Authenticated API helper.
 */
export async function api(
  path,
  options = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    'Content-Type':
      'application/json',

    ...(session?.access_token
      ? {
          Authorization:
            `Bearer ${session.access_token}`,
        }
      : {}),

    ...(options.headers || {}),
  };

  const res = await fetchApi(
    path,
    {
      ...options,
      headers,
    }
  );

  /*
   * Session expired.
   */
  if (
    res.status === 401 &&
    !path.startsWith('/api/auth')
  ) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out errors.
    }

    if (
      typeof window !== 'undefined'
    ) {
      window.location.href =
        '/chat/login';
    }

    throw new Error(
      'Your session expired. Please log in again.'
    );
  }

  const data =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        `Request failed (${res.status})`
    );
  }

  return data;
}

/**
 * Validate stored Supabase session.
 */
export async function getValidSession() {
  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (
      error ||
      !data?.user
    ) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore.
      }

      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session;

  } catch {
    return null;
  }
}

/* ---------- Manage as client ---------- */

const MANAGING_KEY =
  'OneWayChat-managing-org';

/**
 * Set the client workspace being managed.
 */
export function setManagingOrg(org) {
  try {
    if (
      org &&
      org.id
    ) {
      sessionStorage.setItem(
        MANAGING_KEY,
        JSON.stringify(org)
      );
    } else {
      sessionStorage.removeItem(
        MANAGING_KEY
      );
    }
  } catch {
    // Ignore storage errors.
  }

  window.dispatchEvent(
    new Event(
      'OneWayChat-managing-changed'
    )
  );
}

/**
 * Get currently managed organization.
 */
export function getManagingOrg() {
  try {
    return JSON.parse(
      sessionStorage.getItem(
        MANAGING_KEY
      ) || 'null'
    );
  } catch {
    return null;
  }
}