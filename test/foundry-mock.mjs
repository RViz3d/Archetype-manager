/**
 * FoundryVTT Mock Environment for Testing
 *
 * Provides mock implementations of FoundryVTT's core APIs
 * so we can test module logic without a running Foundry instance.
 */

// In-memory storage for persistence testing
const storage = {
  journals: new Map(),
  settings: new Map(),
  flags: new Map()
};

class MockJournalEntryPage {
  constructor(data) {
    this.id = data.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    this.name = data.name;
    this.type = data.type || 'text';
    this.text = { content: data.text?.content || '{}' };
  }

  async update(updateData) {
    if (updateData['text.content'] !== undefined) {
      this.text.content = updateData['text.content'];
    }
    return this;
  }
}

class MockCollection {
  constructor(items = []) {
    this._items = items;
  }

  getName(name) {
    return this._items.find(i => i.name === name) || null;
  }

  get length() {
    return this._items.length;
  }

  [Symbol.iterator]() {
    return this._items[Symbol.iterator]();
  }

  forEach(fn) {
    this._items.forEach(fn);
  }

  map(fn) {
    return this._items.map(fn);
  }

  filter(fn) {
    return this._items.filter(fn);
  }
}

class MockJournalEntry {
  constructor(data) {
    this.id = data.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    this.name = data.name;
    this.pages = new MockCollection(
      (data.pages || []).map(p => new MockJournalEntryPage(p))
    );
  }

  static async create(data) {
    const je = new MockJournalEntry(data);
    storage.journals.set(je.name, je);
    // Also add to game.journal
    globalThis.game.journal._items.push(je);
    return je;
  }
}

class MockHooks {
  constructor() {
    this._hooks = new Map();
    this._onceHooks = new Map();
  }

  on(event, fn) {
    if (!this._hooks.has(event)) this._hooks.set(event, []);
    this._hooks.get(event).push(fn);
  }

  once(event, fn) {
    if (!this._onceHooks.has(event)) this._onceHooks.set(event, []);
    this._onceHooks.get(event).push(fn);
  }

  async callAll(event, ...args) {
    const fns = this._hooks.get(event) || [];
    const onceFns = this._onceHooks.get(event) || [];
    this._onceHooks.delete(event);

    for (const fn of [...fns, ...onceFns]) {
      await fn(...args);
    }
  }
}

class MockSettings {
  constructor() {
    this._registered = new Map();
    this._values = new Map();
  }

  register(moduleId, key, config) {
    const fullKey = `${moduleId}.${key}`;
    this._registered.set(fullKey, config);
    if (config.default !== undefined) {
      this._values.set(fullKey, config.default);
    }
  }

  get(moduleId, key) {
    const fullKey = `${moduleId}.${key}`;
    if (!this._registered.has(fullKey)) {
      throw new Error(`Setting ${fullKey} is not registered`);
    }
    return this._values.get(fullKey) ?? this._registered.get(fullKey).default;
  }

  set(moduleId, key, value) {
    const fullKey = `${moduleId}.${key}`;
    this._values.set(fullKey, value);
  }

  isRegistered(moduleId, key) {
    return this._registered.has(`${moduleId}.${key}`);
  }

  getRegistration(moduleId, key) {
    return this._registered.get(`${moduleId}.${key}`);
  }
}

class MockUI {
  constructor() {
    this.notifications = {
      info: (msg) => console.log(`[INFO] ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${msg}`),
      error: (msg) => console.error(`[ERROR] ${msg}`)
    };
  }
}

/**
 * Set up the global FoundryVTT mock environment
 */
export function setupMockEnvironment() {
  const hooks = new MockHooks();
  const settings = new MockSettings();

  globalThis.Hooks = hooks;
  globalThis.JournalEntry = MockJournalEntry;

  // Create modules map with the module entry
  const modulesMap = new Map();
  modulesMap.set('archetype-manager', {
    id: 'archetype-manager',
    active: true,
    title: 'PF1e Archetype Manager'
  });

  globalThis.game = {
    modules: modulesMap,
    journal: new MockCollection([]),
    settings,
    user: { isGM: true },
    packs: new Map()
  };

  globalThis.ui = new MockUI();
  globalThis.ChatMessage = { create: async (data) => data };
  globalThis.canvas = { tokens: { controlled: [] } };

  // foundry utils
  globalThis.foundry = {
    utils: {
      deepClone: (obj) => JSON.parse(JSON.stringify(obj))
    }
  };

  // fromUuid mock
  globalThis.fromUuid = async (uuid) => null;

  // Dialog mock
  globalThis.Dialog = class {
    constructor(data) {
      this.data = data;
    }
    render(force) {
      return this;
    }
  };

  return { hooks, settings, storage };
}

/**
 * Reset the mock environment (simulates page reload)
 */
export function resetMockEnvironment() {
  // Preserve journal data (simulates persistence)
  const journals = [];
  if (globalThis.game?.journal) {
    for (const je of globalThis.game.journal._items || []) {
      journals.push(je);
    }
  }

  const env = setupMockEnvironment();

  // Restore journals (they persist across reloads in real Foundry)
  globalThis.game.journal = new MockCollection(journals);

  return env;
}

export { storage, MockCollection, MockJournalEntry, MockJournalEntryPage };
