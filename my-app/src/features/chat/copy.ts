/** All chat-feature strings live here so future i18n can lift them out of screens. */
export const ChatCopy = {
  list: {
    /** Contact Page greeting prefix — "Hi, {firstName}". */
    greeting: (firstName: string) => `Hi, ${firstName}`,
    /** Fallback greeting when no profile is loaded. */
    greetingFallback: 'Hi there',
    searchPlaceholder: 'Search',
    filter: 'Filter Chats',
    selectedCount: (n: number) => `${n} Selected`,
    readAll: 'Read all',
    deleteAll: 'Delete all',
    empty: 'No conversations yet',
    emptyBody: 'Start a new chat to see it here.',
    /** Toast / banner shown after Read All. */
    allCaughtUp: 'All caught up',
    /** Custom filter dialog placeholder. */
    addFilterTitle: 'Custom filters',
    addFilterBody: 'Saved filters land in a future ticket.',
  },

  thread: {
    typePlaceholder: 'Type a Message',
    voiceCall: 'Voice Call',
    videoCall: 'Video Call',
    deliveredHint: 'Delivered',
    readHint: 'Read',
    todayLabel: 'Today',
    yesterdayLabel: 'Yesterday',
  },
} as const;
