// Mock TensorFlow.js for Jest/JSDOM environment
// This allows tests to run without WebGL/WebAssembly

const createMockTensor = (shape = [1, 1]) => ({
  shape,
  dtype: 'float32',
  dispose: jest.fn(),
  data: jest.fn().mockResolvedValue(new Float32Array([0.33, 0.33, 0.34])),
  arraySync: jest.fn().mockReturnValue([[0.33, 0.33, 0.34]]),
  dataSync: jest.fn().mockReturnValue(new Float32Array([0.33, 0.33, 0.34])),
});

const createMockModel = () => {
  const model = {
    add: jest.fn(),
    predict: jest.fn().mockReturnValue(createMockTensor([1, 3])),
    fit: jest.fn().mockResolvedValue({
      history: {
        loss: [0.5, 0.4, 0.3],
        accuracy: [0.6, 0.7, 0.8],
        acc: [0.6, 0.7, 0.8],
      },
    }),
    compile: jest.fn(),
    dispose: jest.fn(),
    save: jest.fn().mockResolvedValue({ modelArtifactsInfo: { dateSaved: new Date() } }),
    getWeights: jest.fn().mockReturnValue([]),
    setWeights: jest.fn(),
    summary: jest.fn(),
    layers: [],
  };
  return model;
};

const mockLayer = {
  apply: jest.fn(),
  getWeights: jest.fn().mockReturnValue([]),
  setWeights: jest.fn(),
};

// Create the mock tf object
const tf = {
  // Ready function
  ready: jest.fn().mockResolvedValue(true),

  // Tensor creation
  tensor: jest.fn((data, shape) => createMockTensor(shape)),
  tensor1d: jest.fn((data) => createMockTensor([data?.length || 1])),
  tensor2d: jest.fn((data, shape) => createMockTensor(shape || [1, data?.[0]?.length || 1])),
  zeros: jest.fn((shape) => createMockTensor(shape)),
  ones: jest.fn((shape) => createMockTensor(shape)),
  scalar: jest.fn(() => createMockTensor([1])),

  // Model creation
  sequential: jest.fn(() => createMockModel()),
  model: jest.fn(() => createMockModel()),
  loadLayersModel: jest.fn().mockResolvedValue(createMockModel()),

  // Layers
  layers: {
    dense: jest.fn(() => mockLayer),
    dropout: jest.fn(() => mockLayer),
    flatten: jest.fn(() => mockLayer),
    conv2d: jest.fn(() => mockLayer),
    maxPooling2d: jest.fn(() => mockLayer),
    batchNormalization: jest.fn(() => mockLayer),
    lstm: jest.fn(() => mockLayer),
    gru: jest.fn(() => mockLayer),
  },

  // Regularizers
  regularizers: {
    l1: jest.fn(() => ({})),
    l2: jest.fn(() => ({})),
    l1l2: jest.fn(() => ({})),
  },

  // Optimizers
  train: {
    adam: jest.fn(() => ({})),
    sgd: jest.fn(() => ({})),
    rmsprop: jest.fn(() => ({})),
    adagrad: jest.fn(() => ({})),
  },

  // Memory management
  dispose: jest.fn(),
  disposeVariables: jest.fn(),
  tidy: jest.fn((fn) => fn()),
  keep: jest.fn((tensor) => tensor),
  memory: jest.fn(() => ({ numTensors: 0, numBytes: 0 })),

  // Math operations
  add: jest.fn(() => createMockTensor()),
  sub: jest.fn(() => createMockTensor()),
  mul: jest.fn(() => createMockTensor()),
  div: jest.fn(() => createMockTensor()),
  matMul: jest.fn(() => createMockTensor()),
  softmax: jest.fn(() => createMockTensor()),
  argMax: jest.fn(() => createMockTensor()),

  // Backend
  setBackend: jest.fn().mockResolvedValue(true),
  getBackend: jest.fn(() => 'cpu'),
  backend: jest.fn(() => ({})),

  // IO handlers for model saving/loading
  io: {
    browserHTTPRequest: jest.fn(),
    browserDownloads: jest.fn(),
    browserLocalStorage: jest.fn(),
    indexedDB: jest.fn(),
    withSaveHandler: jest.fn(),
    withLoadHandler: jest.fn(),
    listModels: jest.fn().mockResolvedValue({}),
    removeModel: jest.fn().mockResolvedValue(true),
  },
};

module.exports = tf;
module.exports.default = tf;
