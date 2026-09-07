import { useSyncExternalStore } from 'react';

// pushState doesn't fire popstate, so same-tab updates need their own event
// for useSyncExternalStore to notice the URL changed.
const URL_CHANGE_EVENT = 'aifinops:urlchange';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): string {
  return window.location.search;
}

/**
 * Reactive view of the URL's query string, backed by the History API instead
 * of component state, so state survives a copied link and responds to
 * browser back/forward.
 */
export function useUrlSearchParams(): [
  URLSearchParams,
  (mutate: (params: URLSearchParams) => void) => void,
] {
  const search = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const params = new URLSearchParams(search);

  const update = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(window.location.search);
    mutate(next);
    const query = next.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  };

  return [params, update];
}
