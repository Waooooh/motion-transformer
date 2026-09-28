// Every piece of on-screen text lives here, so wording can be tuned in one
// place. `tools/fetch-fonts.mjs` scans this file to build the Chinese font
// subset — re-run `npm run fonts` after adding new Chinese characters.

export const CAPTIONS = {
  number: { en: 'It begins with a number.', zh: '一切，始于一个数字。' },
  neuron: { en: 'Numbers in. A decision out.', zh: '输入数字，输出决定。' },
  perceptron: { en: 'A machine that learns its own weights.', zh: '一台自己学习权重的机器。' },
  deepnet: { en: 'Errors flow backward. Networks grow deep.', zh: '误差反向流动，网络越来越深。' },
  lstm: { en: 'Reading one word at a time… and forgetting.', zh: '一次只读一个词……然后渐渐遗忘。' },
  attention2014: { en: 'What if every word could see every other word?', zh: '如果每个词，都能看见其他所有词？' },
  architecture: { en: 'No recurrence. Only attention.', zh: '不再循环，只用注意力。' },
  tokens: { en: 'Words become tokens. Tokens become vectors.', zh: '文字化为词元，词元化为向量。' },
  position: { en: 'Order becomes a wave.', zh: '顺序，化作波。' },
  selfattention: { en: 'Every word looks at every other word.', zh: '每个词，都在注视其他所有词。' },
  multihead: { en: 'Many heads. Many ways of seeing.', zh: '多个注意力头，多种观察方式。' },
  block: { en: 'Attend. Think. Pass it on.', zh: '注意，思考，传递下去。' },
  stack: { en: 'Stack them. Deeper. Deeper.', zh: '层层堆叠，越来越深。' },
  training: { en: 'Predict the next word. Trillions of times.', zh: '预测下一个词，重复数万亿次。' },
  scale: { en: 'Then scale it up.', zh: '然后，把它放大。' },
  galaxy: { en: 'Everything attends to everything.', zh: '万物，彼此注视。' },
  generation: { en: 'One token at a time, a world is written.', zh: '一次一个词元，写出整个世界。' },
  modalities: { en: 'One architecture. Every modality.', zh: '同一个架构，理解万物。' },
  equation: { en: 'All of it — from one equation.', zh: '这一切，都源于一个公式。' },
  ending: { en: '…and it all began with a number.', zh: '……而这一切，始于一个数字。' },
};

export const MILESTONES = {
  neuron: { year: '1943', en: 'THE ARTIFICIAL NEURON', zh: '人工神经元', who: 'McCulloch & Pitts' },
  perceptron: { year: '1958', en: 'THE PERCEPTRON', zh: '感知机', who: 'Frank Rosenblatt' },
  deepnet: { year: '1986', en: 'BACKPROPAGATION', zh: '反向传播', who: 'Rumelhart · Hinton · Williams' },
  lstm: { year: '1997', en: 'LONG SHORT-TERM MEMORY', zh: '长短期记忆网络', who: 'Hochreiter & Schmidhuber' },
  attention: { year: '2014', en: 'NEURAL ATTENTION', zh: '注意力机制', who: 'Bahdanau · Cho · Bengio' },
  transformer: { year: '2017', en: 'THE TRANSFORMER', zh: 'Transformer', who: 'Vaswani et al.' },
};

export const TITLE = {
  main: ['ATTENTION IS', 'ALL YOU NEED'],
  script: 'Transformer',
  zh: '注意力就是你所需要的一切',
  sub: 'VASWANI ET AL. · NEURIPS 2017',
};

// The running example: GPT-2 BPE tokens and their real ids.
export const SENTENCE = [
  ['The', 464], [' animal', 5044], [' didn', 1422], ["'t", 470], [' cross', 3272], [' the', 262],
  [' street', 4675], [' because', 780], [' it', 340], [' was', 373], [' too', 1165], [' tired', 10032],
];
export const SENTENCE_ZH = '这只动物没有过马路，因为它太累了。';

// Words shown in the LSTM / attention history scenes.
export const LSTM_WORDS = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it'];

export const ARCH_LABELS = {
  inputs: 'Inputs',
  outputs: 'Outputs (shifted right)',
  inEmb: 'Input Embedding',
  outEmb: 'Output Embedding',
  pe: 'Positional Encoding',
  mha: 'Multi-Head Attention',
  mmha: 'Masked Multi-Head Attention',
  addnorm: 'Add & Norm',
  ff: 'Feed Forward',
  linear: 'Linear',
  softmax: 'Softmax',
  probs: 'Output Probabilities',
  nx: 'N×',
};

export const HEAD_NAMES = [
  'previous word', 'self', 'coreference', 'sentence start',
  'next word', 'subject ↔ verb', 'broad context', 'verb ↔ object',
];

export const TRAINING_PROMPTS = [
  { text: 'The sun rises in the', answer: 'east', p: 0.93 },
  { text: 'To be, or not to', answer: 'be', p: 0.97 },
  { text: 'E = mc', answer: '²', p: 0.99 },
  { text: '床前明月', answer: '光', p: 0.98 },
];

// Parameter counts of landmark Transformer models (published figures).
export const SCALE_POINTS = [
  { name: 'Transformer', year: 2017.45, params: 65e6, label: '65M' },
  { name: 'BERT-Large', year: 2018.8, params: 340e6, label: '340M' },
  { name: 'GPT-2', year: 2019.12, params: 1.5e9, label: '1.5B' },
  { name: 'T5-11B', year: 2019.8, params: 11e9, label: '11B' },
  { name: 'GPT-3', year: 2020.4, params: 175e9, label: '175B' },
  { name: 'Switch-C', year: 2021.05, params: 1.6e12, label: '1.6T' },
];

export const ABILITIES = [
  ['TRANSLATE', '翻译'], ['SUMMARIZE', '总结'], ['ANSWER', '回答'], ['EXPLAIN', '解释'],
  ['WRITE', '写作'], ['CODE', '编程'], ['REASON', '推理'], ['PLAN', '规划'],
  ['SEE', '看见'], ['HEAR', '听见'], ['SPEAK', '说话'], ['DRAW', '绘画'],
  ['COMPOSE', '作曲'], ['DISCOVER', '发现'],
];

// What the model "writes" during the generation scene (GPT-2 tokens).
export const GENERATED = [
  'Once', ',', ' machines', ' could', ' only', ' count', '.', '\n',
  'Then', ' they', ' learned', ' to', ' read', ' —', ' one', ' word', ' at', ' a', ' time', '.', '\n',
  'Now', ' they', ' read', ' everything', ' at', ' once', ',', '\n',
  'and', ' every', ' word', ' remembers', ' every', ' other', '.',
];
export const GENERATED_ZH = [
  '曾经，机器只会计数。',
  '后来，它们学会了阅读——一次一个词。',
  '如今，它们一眼读尽一切，',
  '每个词都记得其他所有词。',
];

export const MODALITIES = [
  { en: 'TEXT', zh: '文本' },
  { en: 'IMAGES', zh: '图像' },
  { en: 'SOUND', zh: '声音' },
  { en: 'CODE', zh: '代码' },
  { en: 'PROTEINS', zh: '蛋白质' },
];

export const PEAK_WORDS = [
  { en: 'ATTENTION', zh: '注意力' },
  { en: 'IS ALL', zh: '就是' },
  { en: 'YOU', zh: '你所需要的' },
  { en: 'NEED', zh: '一切' },
];

export const EQUATION_PARTS = [
  { key: 'Q', en: 'Query — what am I looking for?', zh: '查询：我在寻找什么？' },
  { key: 'K', en: 'Key — what do I contain?', zh: '键：我包含什么？' },
  { key: 'V', en: 'Value — what do I offer?', zh: '值：我能提供什么？' },
  { key: 'softmax', en: 'Softmax — where to focus', zh: '归一化：聚焦于何处' },
  { key: 'sqrt', en: '√dₖ — keep it stable', zh: '缩放：保持稳定' },
];

export const CREDITS = {
  paper: 'Attention Is All You Need',
  authors: [
    'Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit',
    'Llion Jones', 'Aidan N. Gomez', 'Łukasz Kaiser', 'Illia Polosukhin',
  ],
  venue: 'NeurIPS 2017',
  logo: 'TRANSFORMER',
  since: '2017 → ∞',
  music: 'Music  “Hong Kong Story”  —  Lazer Boomerang',
};
