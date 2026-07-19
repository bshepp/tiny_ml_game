// Mock TensorFlow.js for the Vitest/jsdom environment.
// Wired up via the `test.alias` entry in vite.config.js, so both the app and
// the tests receive this module (and share its mock state) when importing
// '@tensorflow/tfjs'. The real package is only used in the browser build.

import { vi } from 'vitest';

// Live-tensor accounting: tf.memory().numTensors reflects created-but-not-
// disposed mock tensors, so tests can assert the app leaks nothing.
let liveTensors = 0;
const tidyScopes = [];

const createMockTensor = (shape = [1, 1]) => {
  liveTensors += 1;
  const tensor = {
    shape,
    dtype: 'float32',
    disposed: false,
    data: vi.fn().mockResolvedValue(new Float32Array([0.33, 0.33, 0.34])),
    arraySync: vi.fn().mockReturnValue([[0.33, 0.33, 0.34]]),
    dataSync: vi.fn().mockReturnValue(new Float32Array([0.33, 0.33, 0.34])),
  };
  tensor.dispose = vi.fn(() => {
    if (!tensor.disposed) {
      tensor.disposed = true;
      liveTensors -= 1;
    }
  });
  if (tidyScopes.length > 0) {
    tidyScopes[tidyScopes.length - 1].push(tensor);
  }
  return tensor;
};

const isMockTensor = (v) =>
  !!v && typeof v === 'object' && typeof v.dispose === 'function' && 'shape' in v;

const createMockModel = () => {
  const model = {
    add: vi.fn(),
    // A fresh tensor per call, like real TF.js — a shared mockReturnValue
    // tensor would escape tidy scopes and break dispose accounting.
    predict: vi.fn(() => createMockTensor([1, 3])),
    fit: vi.fn().mockResolvedValue({
      history: {
        loss: [0.5, 0.4, 0.3],
        accuracy: [0.6, 0.7, 0.8],
        acc: [0.6, 0.7, 0.8],
        val_acc: [0.45, 0.5, 0.55],
        val_accuracy: [0.45, 0.5, 0.55],
      },
    }),
    compile: vi.fn(),
    dispose: vi.fn(),
    save: vi.fn().mockResolvedValue({ modelArtifactsInfo: { dateSaved: new Date() } }),
    getWeights: vi.fn().mockReturnValue([]),
    setWeights: vi.fn(),
    summary: vi.fn(),
    layers: [],
  };
  return model;
};

const mockLayer = {
  apply: vi.fn(function () { return this; }),
  getWeights: vi.fn().mockReturnValue([]),
  setWeights: vi.fn(),
};

// Create the mock tf object
const tf = {
  // Ready function
  ready: vi.fn().mockResolvedValue(true),

  // Tensor creation
  tensor: vi.fn((data, shape) => createMockTensor(shape)),
  tensor1d: vi.fn((data) => createMockTensor([data?.length || 1])),
  tensor2d: vi.fn((data, shape) => createMockTensor(shape || [1, data?.[0]?.length || 1])),
  zeros: vi.fn((shape) => createMockTensor(shape)),
  ones: vi.fn((shape) => createMockTensor(shape)),
  scalar: vi.fn(() => createMockTensor([1])),

  // Model creation
  sequential: vi.fn(() => createMockModel()),
  model: vi.fn(() => createMockModel()),
  loadLayersModel: vi.fn().mockResolvedValue(createMockModel()),

  // Layers
  layers: {
    dense: vi.fn(() => mockLayer),
    dropout: vi.fn(() => mockLayer),
    flatten: vi.fn(() => mockLayer),
    conv2d: vi.fn(() => mockLayer),
    maxPooling2d: vi.fn(() => mockLayer),
    batchNormalization: vi.fn(() => mockLayer),
    layerNormalization: vi.fn(() => mockLayer),
    lstm: vi.fn(() => mockLayer),
    gru: vi.fn(() => mockLayer),
    reshape: vi.fn(() => mockLayer),
    add: vi.fn(() => mockLayer),
    attention: vi.fn(() => mockLayer),
    globalAveragePooling1d: vi.fn(() => mockLayer),
  },

  // Symbolic input + functional API
  input: vi.fn(() => mockLayer),

  // Regularizers
  regularizers: {
    l1: vi.fn(() => ({})),
    l2: vi.fn(() => ({})),
    l1l2: vi.fn(() => ({})),
  },

  // Optimizers
  train: {
    adam: vi.fn(() => ({})),
    sgd: vi.fn(() => ({})),
    rmsprop: vi.fn(() => ({})),
    adagrad: vi.fn(() => ({})),
  },

  // Memory management. tidy mirrors the real semantics: tensors created
  // inside the callback are disposed unless they're part of the return value.
  dispose: vi.fn(),
  disposeVariables: vi.fn(),
  tidy: vi.fn((fn) => {
    const scope = [];
    tidyScopes.push(scope);
    try {
      const out = fn();
      const kept = new Set();
      if (isMockTensor(out)) {
        kept.add(out);
      } else if (out && typeof out === 'object') {
        Object.values(out).forEach((v) => {
          if (isMockTensor(v)) kept.add(v);
        });
      }
      scope.forEach((t) => {
        if (!kept.has(t)) t.dispose();
      });
      return out;
    } finally {
      tidyScopes.pop();
    }
  }),
  keep: vi.fn((tensor) => tensor),
  memory: vi.fn(() => ({ numTensors: liveTensors, numBytes: 0 })),

  // Math operations
  add: vi.fn(() => createMockTensor()),
  sub: vi.fn(() => createMockTensor()),
  mul: vi.fn(() => createMockTensor()),
  div: vi.fn(() => createMockTensor()),
  matMul: vi.fn(() => createMockTensor()),
  softmax: vi.fn(() => createMockTensor()),
  argMax: vi.fn(() => createMockTensor()),

  // Backend
  setBackend: vi.fn().mockResolvedValue(true),
  getBackend: vi.fn(() => 'cpu'),
  backend: vi.fn(() => ({})),

  // IO handlers for model saving/loading
  io: {
    browserHTTPRequest: vi.fn(),
    browserDownloads: vi.fn(),
    browserLocalStorage: vi.fn(),
    indexedDB: vi.fn(),
    withSaveHandler: vi.fn(),
    withLoadHandler: vi.fn(),
    listModels: vi.fn().mockResolvedValue({}),
    removeModel: vi.fn().mockResolvedValue(true),
  },
};

export default tf;

// `import * as tf from '@tensorflow/tfjs'` consumes named exports, so mirror
// every key of the mock object as a named export.
export const {
  ready,
  tensor,
  tensor1d,
  tensor2d,
  zeros,
  ones,
  scalar,
  sequential,
  model,
  loadLayersModel,
  layers,
  input,
  regularizers,
  train,
  dispose,
  disposeVariables,
  tidy,
  keep,
  memory,
  add,
  sub,
  mul,
  div,
  matMul,
  softmax,
  argMax,
  setBackend,
  getBackend,
  backend,
  io,
} = tf;
