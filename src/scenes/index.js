// The film's running order. `from` / `to` are in bars (1 bar = 3 s at 80 BPM);
// `pre` / `post` (seconds) let a scene start early or linger for transitions.
import number from './01-number.js';
import neuron from './02-neuron.js';
import perceptron from './03-perceptron.js';
import deepnet from './04-deepnet.js';
import lstm from './05-lstm.js';
import attention2014 from './06-attention2014.js';
import title from './07-title.js';
import architecture from './08-architecture.js';
import tokens from './09-tokens.js';
import selfattention from './10-selfattention.js';
import multihead from './11-multihead.js';
import stack from './12-stack.js';
import training from './13-training.js';
import scale from './14-scale.js';
import buildup from './15-buildup.js';
import galaxy from './16-galaxy.js';
import generation from './17-generation.js';
import modalities from './18-modalities.js';
import peak from './19-peak.js';
import equation from './20-equation.js';
import credits from './21-credits.js';

export const SCHEDULE = [
  // ACT I — ORIGINS (drumless swell)
  { id: 'number', from: 0, to: 2, make: number },
  { id: 'neuron', from: 2, to: 4, make: neuron },
  { id: 'perceptron', from: 4, to: 6, make: perceptron },
  { id: 'deepnet', from: 6, to: 8, make: deepnet },
  { id: 'lstm', from: 8, to: 10, make: lstm },
  { id: 'attention2014', from: 10, to: 12, make: attention2014 },
  // ACT II — THE TRANSFORMER (drop 1)
  { id: 'title', from: 12, to: 14, make: title },
  { id: 'architecture', from: 14, to: 16, make: architecture },
  { id: 'tokens', from: 16, to: 20, make: tokens },
  { id: 'selfattention', from: 20, to: 24, make: selfattention },
  { id: 'multihead', from: 24, to: 28, make: multihead },
  // ACT III — DEPTH & SCALE (groove)
  { id: 'stack', from: 28, to: 32, make: stack },
  { id: 'training', from: 32, to: 36, make: training },
  { id: 'scale', from: 36, to: 40, make: scale },
  { id: 'buildup', from: 40, to: 44, make: buildup },
  // ACT IV — CLIMAX (drop 2)
  { id: 'galaxy', from: 44, to: 48, make: galaxy },
  { id: 'generation', from: 48, to: 52, make: generation },
  { id: 'modalities', from: 52, to: 56, make: modalities },
  { id: 'peak', from: 56, to: 60, make: peak },
  // ACT V — THE EQUATION (outro)
  { id: 'equation', from: 60, to: 69, make: equation },
  { id: 'credits', from: 69, to: 79, make: credits },
];
