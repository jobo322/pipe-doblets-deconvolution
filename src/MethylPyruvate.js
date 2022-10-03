'use strict';

const { optimizeROI } = require('./optimization/optimizeROI');

const { writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
// const { argv } = require('yargs');
const { xyExtract, xMinMaxValues, xMedian } = require('ml-spectra-processing');
const { generateSpectrum } = require('spectrum-generator');
const { isAnyArray } = require('is-any-array');
const { xyAutoRangesPicking } = require('nmr-processing');
const { fileListFromPath } = require('filelist-utils');
const { convertFileList, groupByExperiments } = require('brukerconverter');
const { converterOptions, getName, paths } = require('./options');
const { getLorentzianArea, getPseudoVoigtArea } = require('ml-peak-shape-generator');
const exp = require('constants');

const line = `${new Array(40).fill('-').join('')}\n`;

(async () => {
  const pathToWrite = '/home/centos/Biolog/MethylPyruvate';// Biolog sample Methyl Pyruvate
  
  // const {
  //   path = join(__dirname, './data'),
  //   pathToWrite = join(__dirname, '../results'),
  // } = argv;

  if (!existsSync(pathToWrite)) {
    mkdirSync(pathToWrite);
  }

  // const fileList = fileListFromPath(path);
  // const tempExperiments = groupByExperiments(fileList, converterOptions.filter);
  // const experiments = tempExperiments.filter((exp) => exp.expno % 10 === 0);

  for (const path of paths) {
    const fileList = fileListFromPath(path);

    //  
    const tempExperiments = groupByExperiments(fileList, converterOptions.filter);
    const experiments = tempExperiments.filter((exp) => exp.expno % 10 === 0);


    for (let i = 0; i < experiments.length; i++) {
      const data = (await convertFileList(experiments[i].fileList, converterOptions))[0];

      console.log(`${line}Data No.${i + 1} of ${experiments.length} \nSource: ${data.source.name}, expno: ${data.source.expno}`)

      const frequency = data.meta.SF;
      const name = getName(data);   // for those with sampleID
      // const name = data.source.name; // for those that does not have sampleID  
      // console.log(data.source.name)
      let spectrum = data.spectra[0].data;
      if (spectrum.x[0] > spectrum.x[1]) {
        spectrum.x = spectrum.x.reverse();
        spectrum.re = spectrum.re.reverse();
      }

      const xyData = { x: spectrum.x, y: spectrum.re };

      process({ xyData, name, pathToWrite, frequency })
    }
  }
})()

function process(options) {
  const { xyData, name, pathToWrite, frequency } = options;

  const fromTo = { from: 0.0, to:0.1 };

  const experimental = xyExtract(xyData, {
    zones: [fromTo],
  });

  const medianOfAll = xMedian(xyData.y);
  const medianOfROI = xMedian(xyExtract(xyData, {
    zones: [{ from: 0.0, to: 0.4 }], // bigger reference range that covers all compounds
  }).y);

  if (medianOfAll * 3 > medianOfROI) return;
  const ranges = xyAutoRangesPicking(experimental, { peakPicking: { frequency }, ranges: { keepPeaks: true, compile: false, joinOverlapRanges: false, frequencyCluster: 6 } });
  if (ranges.length === 0) return;

  const { rangeIndex, signalIndex, peakIndex } = getBiggestPeak(ranges);

  const peaksCloseToBiggest = ranges[rangeIndex].signals[signalIndex].peaks
  const biggestPeak = ranges[rangeIndex]?.signals[signalIndex]?.peaks[peakIndex];
  const x1Limits = {
    min: biggestPeak
      ? biggestPeak.x
      : (ranges[ranges.length - 1].from + ranges[ranges.length - 1].to) / 2,
    max: biggestPeak
      ? peakIndex < peaksCloseToBiggest.length - 1
        ? peaksCloseToBiggest[peakIndex + 1].x
        : biggestPeak.x + biggestPeak.width / frequency * 2
      : biggestPeak.x,
    gradientDifference: 0.0001
  }
  const x2Limits = {
    min: biggestPeak
      ? peakIndex > 0
        ? peaksCloseToBiggest[peakIndex - 1].x
        : biggestPeak.x - biggestPeak.width / frequency * 2
      : ranges[ranges.length - 1].from,
    max: biggestPeak
      ? biggestPeak.x
      : (ranges[ranges.length - 1].from + ranges[ranges.length - 1].to) / 2,
    gradientDifference: 0.0001
  }
  const minMaxY = xMinMaxValues(experimental.y);
  const range = minMaxY.max - minMaxY.min;
  minMaxY.range = range;
  const normalized = experimental.y.map((e) => e / range);

  const js = 2.34 / frequency;   //  for ANPC
  // const js = 2.0 / frequency;
  const widthGuess = 0.97 / frequency;

  const signals = [
    {
      x: 6.290, // for ANPC
      // x: 6.296, // for heid timecurve??
      y: 1,
      coupling: js,
      pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
      parameters: {
        x: x1Limits,
        y: {
          min: 0,
          max: 1,
          gradientDifference: 0.001
        },
        fwhm: {
          min: widthGuess / 2,
          max: widthGuess * 1.2,
        },
        coupling: {
          min: js * 0.9,
          max: js * 1.2,
        }
      }
    },
    {
      x: 6.285, // for ANPC
      // x: 6.292, // for Heid??
      y: 0.5,
      coupling: js,
      pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
      parameters: {
        x: x2Limits,
        y: {
          min: 0,
          max: 1,
          gradientDifference: 0.001
        },
        fwhm: {
          min: widthGuess / 2,
          max: widthGuess * 1.2,
        },
        coupling: {
          min: js * 0.8,
          max: js * 1.2,
        }
      }
    },
  ];

  const tempSignals = optimizeROI({ x: experimental.x, y: normalized }, signals, {
    baseline: 0,
    shape: { kind: 'gaussian' },
    optimization: {
      kind: 'direct',
      options: {
        iterations: 25,
      }
    }
  });

  tempSignals.forEach((signal, i, arr) => {
    const fwhm = signal.shape.fwhm;
    arr[i].shape = {
      kind: 'pseudoVoigt',
      fwhm,
      mu: 0,
    }
  });
  const newSignals = optimizeROI({ x: experimental.x, y: normalized }, tempSignals, {
    baseline: 0,
    optimization: {
      kind: 'lm',
      options: {
        maxIterations: 2000,
      }
    }
  });

  const peaks = newSignals.flatMap((signal, i, arr) => {
    arr[i].y *= range;
    const { x: delta, y: height, coupling, pattern, shape } = arr[i];
    delete signal.pattern;
    const halfCoupling = coupling / 2;
    const { fwhm, mu } = shape;
    const integration = getPseudoVoigtArea({ height, fwhm, mu }) * pattern.length;
    newSignals[i].integration = integration;
    return pattern.map((peak) => {
      const { x, y } = peak;
      return {
        ...signal,
        x: delta + (x / Math.abs(x) * halfCoupling),
        y: height * y,
      }
    })
  })

  const fit = generateSpectrum(peaks, { generator: { nbPoints: experimental.x.length, ...fromTo } })
  const residual = experimental.y.map((e, i) => e - fit.y[i]);
  writeFileSync(join(pathToWrite, `${name}_twoDoublets.json`), JSON.stringify([{
    name,
    expno: 'null',
    fit: [
      {
        roi: fromTo,
        fit: Array.from(fit.y),
        residual: Array.from(residual),
        peaks: [],
        optimizedPeaks: peaks,
        signals: newSignals,
        ranges: ranges,
      }
    ],
    xyData: ensureArray(experimental),
    frequency
  }]));
}

function ensureArray(obj) {
  let result;
  if (isAnyArray(obj)) {
    result = obj.map((arr) => Array.from(arr));
  } else {
    result = {};
    for (let key in obj) {
      if (isAnyArray(obj[key])) {
        result[key] = Array.from(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }

  return result;
}

function getBiggestPeak(ranges) {
  let indices = { rangeIndex: -1, signalIndex: -1, peakIndex: -1 };
  let max = Number.MIN_SAFE_INTEGER;
  for (let i = 0; i < ranges.length; i++) {
    const signals = ranges[i].signals;
    for (let j = 0; j < signals.length; j++) {
      const peaks = signals[j].peaks;
      for (let k = 0; k < peaks.length; k++) {
        const peak = peaks[k];
        if (peak.y > max) {
          max = peak.y;
          indices =
            { rangeIndex: i, signalIndex: j, peakIndex: k }
        }
      }
    }
  }
  return indices;
}



