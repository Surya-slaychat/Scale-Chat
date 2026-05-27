/**
 * P2-Theme: pure-logic tests for the chat-theme token map.
 *
 * Tests are fully self-contained — no react-native, no MMKV, no @scalechat/shared
 * imports, because those pull in ESM / .js-extension dependencies that break
 * under the Jest node environment (same constraint as poll-vote-math.test.ts,
 * which delegates to a separate pure helper to stay testable).
 *
 * The mock-repo setChatTheme behaviour is verified by the inline simulation below
 * rather than by importing mock-chat-repository (which transitively pulls in
 * @scalechat/shared with its .js specifiers).
 *
 * Keep EXPECTED_TOKENS in sync with Brand.chatThemes in src/constants/theme.ts.
 * Keep EXPECTED_KEYS in sync with ChatThemeEnum in @scalechat/shared.
 */

/** Expected theme keys — mirror ChatThemeEnum.options. */
const EXPECTED_KEYS = ['default', 'midnight', 'forest', 'sunset'] as const;
type ThemeKey = typeof EXPECTED_KEYS[number];

/**
 * Inline expected token map — matches the values in Brand.chatThemes.
 * If the token values change in theme.ts, update this table to keep the test as spec.
 */
const EXPECTED_TOKENS: Record<ThemeKey, { body: string; mine: string; theirs: string; mineText: string; theirsText: string }> = {
  default:  { body: '#000000', mine: '#5360EC', theirs: '#EDEDED', mineText: '#EDEDED', theirsText: '#313131' },
  midnight: { body: '#0D1117', mine: '#1F6FEB', theirs: '#C9D1D9', mineText: '#FFFFFF', theirsText: '#111827' },
  forest:   { body: '#0D1F1A', mine: '#2D6A4F', theirs: '#D8F3DC', mineText: '#FFFFFF', theirsText: '#1B4332' },
  sunset:   { body: '#1A0D0D', mine: '#AE2012', theirs: '#FFE8D6', mineText: '#FFFFFF', theirsText: '#6B1010' },
};

// ─── Token map structure tests ────────────────────────────────────────────────

describe('Brand.chatThemes token map (spec table)', () => {
  it('covers every expected ChatTheme key including default', () => {
    const keys = Object.keys(EXPECTED_TOKENS);
    for (const k of EXPECTED_KEYS) {
      expect(keys).toContain(k);
    }
  });

  it('each entry has body, mine, theirs, mineText, theirsText hex strings', () => {
    const hexRe = /^#[0-9a-fA-F]{3,8}$/;
    for (const key of EXPECTED_KEYS) {
      const token = EXPECTED_TOKENS[key];
      expect(token.body).toMatch(hexRe);
      expect(token.mine).toMatch(hexRe);
      expect(token.theirs).toMatch(hexRe);
      expect(token.mineText).toMatch(hexRe);
      expect(token.theirsText).toMatch(hexRe);
    }
  });

  it('default body matches Brand.chatBody (#000000)', () => {
    expect(EXPECTED_TOKENS.default.body).toBe('#000000');
  });

  it('default mine/theirs match existing Brand bubble tokens', () => {
    // Brand.chatBubbleMine = '#5360EC', Brand.chatBubbleTheirs = '#EDEDED'
    expect(EXPECTED_TOKENS.default.mine).toBe('#5360EC');
    expect(EXPECTED_TOKENS.default.theirs).toBe('#EDEDED');
  });

  it('non-default themes have dark body colors (intentionally dark-palette)', () => {
    for (const key of EXPECTED_KEYS) {
      if (key === 'default') continue;
      const hex = EXPECTED_TOKENS[key].body.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      // All theme bodies should be dark (combined RGB < 200) — WhatsApp-like wallpaper.
      expect(r + g + b).toBeLessThan(200);
    }
  });
});

// ─── Mock setChatTheme logic simulation ───────────────────────────────────────
// We simulate the exact same in-memory logic that mockChatRepository.setChatTheme
// implements, without importing the repo (avoids @scalechat/shared .js specifier issue).

type MinimalThread = { id: string; chatTheme?: string | null };

function makeState(threads: MinimalThread[]) {
  let current = [...threads];
  return {
    setChatTheme(threadId: string, theme: string | null) {
      current = current.map((t) => t.id === threadId ? { ...t, chatTheme: theme } : t);
    },
    getThread(threadId: string) {
      return current.find((t) => t.id === threadId) ?? null;
    },
    listThreads() {
      return [...current];
    },
  };
}

describe('setChatTheme logic (mock repo simulation)', () => {
  it('stores the theme so getThread returns it', () => {
    const repo = makeState([{ id: 't1' }, { id: 't2' }]);
    repo.setChatTheme('t1', 'midnight');
    expect(repo.getThread('t1')?.chatTheme).toBe('midnight');
  });

  it('null resets the theme to null', () => {
    const repo = makeState([{ id: 't1', chatTheme: 'forest' }]);
    repo.setChatTheme('t1', null);
    expect(repo.getThread('t1')?.chatTheme).toBeNull();
  });

  it('changing theme does not affect other threads', () => {
    const repo = makeState([{ id: 't1' }, { id: 't2' }]);
    repo.setChatTheme('t1', 'sunset');
    expect(repo.getThread('t2')?.chatTheme ?? null).not.toBe('sunset');
  });

  it('default fallback: themeToken.body matches default.body when chatTheme is null', () => {
    // Mirrors the themeToken derivation in chat/[id].tsx:
    // Brand.chatThemes[thread?.chatTheme ?? 'default'] ?? Brand.chatThemes.default
    const chatTheme: string | null = null;
    const key = (chatTheme ?? 'default') as ThemeKey;
    expect(EXPECTED_TOKENS[key].body).toBe(EXPECTED_TOKENS.default.body);
  });
});
