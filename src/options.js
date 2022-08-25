

const { getName } = require('./utils/getName');
const { groupExperiments } = require('./utils/groupExperiments');

const process2DOptions = {
  zonesPicking: {
    tolerances: [5, 100],
    nuclei: ['1H', '1H'],
    realTopDetection: false,
  },
  jResAnalyzer: { reference: 0, getZones: true },
};

const gsdOptions = {
  minMaxRatio: 0.0005,
  broadRatio: 0.00025,
  smoothY: true,
  realTopDetection: true,
};

const converterOptions = {
  converter: { xy: true },
  filter: {
    experimentNumber: [40, 50],
    onlyFirstProcessedData: true,
    ignoreFID: true,
    ignore2D: true,
  },
};

let optimizationOptions = {
  groupingFactor: 8,
  factorLimits: 2,
  shape: {
    kind: 'pseudoVoigt',
  },
  optimization: {
    kind: 'lm',
    parameters: {
      x: {
        max: (peak) => peak.x + peak.width * 2,
        min: (peak) => peak.x - peak.width * 2,
      },
      y: {
        max: () => 1.05,
      },
    },
    options: {
      maxIterations: 300,
    },
  },
};

let alignmentOptions = {
  // reference peaks is the pattern to use only relative intensity import
  referencePeaks: [
    { x: 0, y: 1 },
  ],
  // the expected delta of reference signal,
  delta: 0,
  // the region to make the PP and search the reference signal
  ppOptions: {
    from: -1,
    to: 1,
    // peak detection options
    minMaxRatio: 0.5,
    broadRatio: 0.00025,
    smoothY: true,
    realTopDetection: true,
    optimize: false,
    shape: { kind: 'lorentzian' },
    groupingFactor: 2.5,
  }
};

// alignment2D is succetible of changes
let alignment2DOptions = {
  // reference peaks is the pattern to use only relative intensity import
  referencePeaks: [
    { x: 0, y: 0 },
  ],
  // the expected delta of reference signal [x, y],
  delta: [0, 0],
  // the region to make the PP and search the reference signal
  fromTo: {
    x: { from: 5.1, to: 5.4 },
    y: { from: -0.001, to: 0.001 }
  }
  // peak detection options /TODO/
};

function getNameNormal(data) {
  const sourceName = data.source.name;
  const expno = data.source.expno;
  return `${sourceName}_${expno}`;
}

module.exports = {
  getName: getName || getNameNormal,
  groupExperiments,
  alignmentOptions,
  alignment2DOptions,
  process2DOptions,
  gsdOptions,
  converterOptions,
  optimizationOptions
  ,
}