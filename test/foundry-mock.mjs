/**
 * FoundryVTT Mock Environment for Testing
 *
 * Provides mock implementations of FoundryVTT's core APIs
 * so we can test module logic without a running Foundry instance.
 */

// Set up jsdom for DOM support in Node.js
let _jsdomSetup = false;
async function ensureDOM() {
  if (_jsdomSetup) return;
  if (typeof document === 'undefined') {
    try {
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true
      });
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      globalThis.HTMLElement = dom.window.HTMLElement;
      globalThis.Event = dom.window.Event;
      globalThis.DOMParser = dom.window.DOMParser;
      globalThis.Node = dom.window.Node;
      globalThis.NodeList = dom.window.NodeList;
      _jsdomSetup = true;
    } catch (e) {
      // jsdom not available, DOM tests will be limited
      console.warn('jsdom not available, DOM-dependent tests may fail');
    }
  }
}

// Initialize DOM eagerly
await ensureDOM();

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
 * Create a mock class item (PF1e class)
 */
export function createMockClassItem(name, level, tag = null) {
  const flags = {};
  const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  const classTag = tag || name.toLowerCase().replace(/\s+/g, '-');

  return {
    id,
    name,
    type: 'class',
    system: {
      level,
      levels: level,
      tag: classTag,
      links: {
        classAssociations: []
      }
    },
    flags,
    getFlag(scope, key) {
      return flags[scope]?.[key] ?? null;
    },
    async setFlag(scope, key, value) {
      if (!flags[scope]) flags[scope] = {};
      flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (flags[scope]) delete flags[scope][key];
    },
    async update(data) {
      // Handle dot-notation updates
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split('.');
        let current = this;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
      }
    }
  };
}

/**
 * Create a mock actor
 */
export function createMockActor(name, classItems = []) {
  const flags = {};
  const items = [...classItems];
  const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  return {
    id,
    name,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags,
    getFlag(scope, key) {
      return flags[scope]?.[key] ?? null;
    },
    async setFlag(scope, key, value) {
      if (!flags[scope]) flags[scope] = {};
      flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (flags[scope]) delete flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      return data.map(d => ({ ...d, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2) }));
    },
    async deleteEmbeddedDocuments(type, ids) {
      return ids;
    }
  };
}

/**
 * Set up the global FoundryVTT mock environment
 */
export function setupMockEnvironment() {
  const hooks = new MockHooks();
  const settings = new MockSettings();

  // FoundryVTT adds slugify to String.prototype
  if (!String.prototype.slugify) {
    String.prototype.slugify = function() {
      return this.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };
  }

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

  // Register default module settings so tests don't fail on settings.get()
  settings.register('archetype-manager', 'lastSelectedClass', { default: '' });
  settings.register('archetype-manager', 'showParseWarnings', { default: true });
  settings.register('archetype-manager', 'autoCreateJEDB', { default: true });
  settings.register('archetype-manager', 'chatNotifications', { default: true });
  settings.register('archetype-manager', 'defaultCompendiumSource', { default: 'pf1e-archetypes' });
  settings.register('archetype-manager', 'debugLogging', { default: false });

  // foundry utils
  globalThis.foundry = {
    utils: {
      deepClone: (obj) => JSON.parse(JSON.stringify(obj))
    }
  };

  // fromUuid mock
  globalThis.fromUuid = async (uuid) => null;

  // Dialog mock - captures render callback for testing
  globalThis.Dialog = class MockDialog {
    constructor(data, options = {}) {
      this.data = data;
      this.options = options;
    }
    render(force) {
      // If there's a render callback, fire it with a mock HTML element
      if (this.data.render && typeof document !== 'undefined') {
        try {
          const container = document.createElement('div');
          container.innerHTML = this.data.content || '';
          this.data.render(container);
          this._element = container;
        } catch (e) {
          // DOM may not be available in Node, that's ok
        }
      }
      return this;
    }
    close() {
      if (this.data.close) this.data.close();
    }
  };
  // Keep track of last dialog for testing
  globalThis.Dialog._lastInstance = null;
  const OriginalDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OriginalDialog {
    constructor(data, options) {
      super(data, options);
      globalThis.Dialog._lastInstance = this;
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
