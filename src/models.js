// Model factory. Three architectures, all consuming the same 15-feature
// flat input (encoded by encodeGameSequence) and emitting 3-class softmax
// over the player's next move. Sequence models reshape internally so the
// rest of the training/prediction pipeline is unchanged.

import * as tf from '@tensorflow/tfjs';
import { SEQUENCE_LENGTH, FEATURES_PER_STEP, SEQUENCE_FEATURES } from './gameLogic';

export const MODEL_ARCHITECTURES = ['dense', 'gru', 'transformer'];

export const ARCH_LABELS = {
  dense: 'Dense MLP',
  gru: 'GRU (recurrent)',
  transformer: 'Tiny Transformer',
};

export const ARCH_DESCRIPTIONS = {
  dense: 'Original 3-layer MLP. Fast to train, treats moves as flat features.',
  gru: 'Gated recurrent unit over the 5-step sequence. Better at order-sensitive patterns.',
  transformer: 'Single self-attention block + feed-forward. Tiny (~1k params) but architecturally the same family as modern LLMs.',
};

const compile = (model) => {
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
};

const createDense = () => {
  const m = tf.sequential();
  m.add(tf.layers.dense({
    inputShape: [SEQUENCE_FEATURES],
    units: 128,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
  }));
  m.add(tf.layers.dropout({ rate: 0.3 }));
  m.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
  }));
  m.add(tf.layers.dropout({ rate: 0.2 }));
  m.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  m.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
  return compile(m);
};

const createGRU = () => {
  const m = tf.sequential();
  // Reshape flat 15-feature input back into the (5, 3) sequence the GRU expects.
  m.add(tf.layers.reshape({
    targetShape: [SEQUENCE_LENGTH, FEATURES_PER_STEP],
    inputShape: [SEQUENCE_FEATURES],
  }));
  m.add(tf.layers.gru({ units: 32, returnSequences: false }));
  m.add(tf.layers.dropout({ rate: 0.2 }));
  m.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  m.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
  return compile(m);
};

// Minimal self-attention: built with the functional API since attention
// requires multiple inputs/outputs that don't compose in tf.sequential.
// Dimensions are tiny (d_model=8, single head) so total params stay small.
// `@tensorflow/tfjs` doesn't ship a dedicated Attention layer, so we build
// scaled dot-product attention from `tf.layers.dot` + softmax activation.
const createTransformer = () => {
  const D_MODEL = 8;
  const SCALE = 1 / Math.sqrt(D_MODEL);

  const input = tf.input({ shape: [SEQUENCE_FEATURES] });
  const reshaped = tf.layers.reshape({ targetShape: [SEQUENCE_LENGTH, FEATURES_PER_STEP] }).apply(input);

  // Project to d_model.
  const x = tf.layers.dense({ units: D_MODEL, activation: 'linear' }).apply(reshaped);

  // Single-head self-attention. Q, K, V projections.
  const q = tf.layers.dense({ units: D_MODEL }).apply(x);
  const k = tf.layers.dense({ units: D_MODEL }).apply(x);
  const v = tf.layers.dense({ units: D_MODEL }).apply(x);

  // scores = Q @ K^T   -> [batch, seq, seq]
  const scoresRaw = tf.layers.dot({ axes: [2, 2] }).apply([q, k]);
  // Scale, then softmax over the last axis.
  const scoresScaled = tf.layers.rescaling
    ? tf.layers.rescaling({ scale: SCALE }).apply(scoresRaw)
    : scoresRaw;
  const attnWeights = tf.layers.softmax({ axis: -1 }).apply(scoresScaled);
  // attended = softmax(QK^T) @ V  -> [batch, seq, d_model]
  const attended = tf.layers.dot({ axes: [2, 1] }).apply([attnWeights, v]);

  // Residual + layer norm.
  const added = tf.layers.add().apply([x, attended]);
  const normed = tf.layers.layerNormalization().apply(added);

  // Feed-forward.
  const ff1 = tf.layers.dense({ units: D_MODEL * 2, activation: 'relu' }).apply(normed);
  const ff2 = tf.layers.dense({ units: D_MODEL }).apply(ff1);
  const ffAdded = tf.layers.add().apply([normed, ff2]);
  const ffNormed = tf.layers.layerNormalization().apply(ffAdded);

  // Pool across the time axis and classify.
  const pooled = tf.layers.globalAveragePooling1d().apply(ffNormed);
  const output = tf.layers.dense({ units: 3, activation: 'softmax' }).apply(pooled);

  const model = tf.model({ inputs: input, outputs: output });
  return compile(model);
};

export const createModel = (arch = 'dense') => {
  switch (arch) {
    case 'gru': return createGRU();
    case 'transformer': return createTransformer();
    case 'dense':
    default: return createDense();
  }
};
